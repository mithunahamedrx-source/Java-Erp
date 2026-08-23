package com.trioloo.erp.integration.infrastructure.steadfast;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The Steadfast read-only client, tested against the shapes {@code STEADFAST_PROVIDER_CONTRACT.md}
 * recorded from live read-only observation on 2026-08-24.
 *
 * <p>🔴 EVERY FIXTURE BELOW IS A REAL OBSERVED SHAPE, NOT AN IMAGINED ONE. That matters more than
 * usual here: the provider's envelope is inconsistent in ways nobody would invent, and a test
 * written against a tidy imaginary API would pass while the adapter failed in production.
 */
@DisplayName("Steadfast read-only client")
class SteadfastCourierClientTest {

    private final RecordingTransport transport = new RecordingTransport();
    private final SteadfastProperties properties =
            new SteadfastProperties("test-key", "test-secret", SteadfastProperties.DEFAULT_BASE_URL);
    private final SteadfastCourierClient client = new SteadfastCourierClient(transport, properties);

    @Test
    @DisplayName("sends both credential headers and targets portal.packzy.com, not the brand domain")
    void sendsCredentialHeadersToTheApiHost() {
        transport.reply(200, "{\"status\":200,\"current_balance\":1}");

        client.balance();

        // 🔴 STF-001 — the host is the platform's, not the brand's. An egress rule written
        // against steadfast.com.bd fails, and this is where that would be caught.
        assertThat(transport.lastUrl).startsWith("https://portal.packzy.com/api/v1");
        // ✅ STF-002 — two static headers, exactly these names.
        assertThat(transport.lastHeaders).containsEntry("Api-Key", "test-key");
        assertThat(transport.lastHeaders).containsEntry("Secret-Key", "test-secret");
    }

    @Test
    @DisplayName("reads the balance without letting a provider number become the authoritative one")
    void readsBalanceAsExactDecimal() {
        transport.reply(200, "{\"status\":200,\"current_balance\":1250.75}");

        // ⚠ TEC-015 / DB-079 — via the string form. A double round-trip is how an amount stops
        // being the exact amount.
        assertThat(client.balance()).isEqualByComparingTo(new BigDecimal("1250.75"));
    }

    @Test
    @DisplayName("treats 401 on a status read as NOT FOUND, never as a credential failure")
    void statusRead401MeansNotFound() {
        /*
          🔴 THE MOST IMPORTANT TEST IN THIS FILE. STF-007 — observed live: /status_by_cid/1 and
          /status_by_invoice/NOT-A-REAL-INVOICE-ZZZ BOTH returned 401 with the PLAIN TEXT body
          "Unauthorized Access", using the same credential that returned 200 on /get_balance
          seconds earlier. The provider conflates "not found", "not yours" and "not
          authenticated" into one status.

          An adapter that read this as an auth failure would mark a healthy integration broken,
          or trigger credential rotation because one parcel was untraceable.
        */
        transport.reply(401, "Unauthorized Access");

        assertThat(client.statusByInvoice("TR0001")).isEmpty();
    }

    @Test
    @DisplayName("does not try to parse the plain-text 401 body as JSON")
    void doesNotParsePlainTextErrorBody() {
        // ⚠ STF-007.d — the body is not JSON. A client that parsed every response would throw a
        // JSON error here and report a cause that has nothing to do with what happened.
        transport.reply(401, "Unauthorized Access");

        assertThat(client.statusByInvoice("TR0001")).isEmpty();
        assertThat(transport.lastUrl).endsWith("/status_by_invoice/TR0001");
    }

    @Test
    @DisplayName("raises a credential failure ONLY from the balance endpoint")
    void credentialFailureComesFromBalanceAlone() {
        // ✅ STF-007.e — /get_balance takes no identifier, so there is no "not yours" and no "not
        // found" for the provider to conflate with "not authenticated". It is the one endpoint
        // where 401 is unambiguous, and therefore the only honest credential health check.
        transport.reply(401, "Unauthorized Access");

        assertThatThrownBy(client::balance)
                .isInstanceOf(SteadfastCredentialException.class)
                .hasMessageContaining("STF-007.e");
    }

    @Test
    @DisplayName("branches on the HTTP status, not on the body's inconsistent status field")
    void ignoresTheBodyStatusField() {
        /*
          🔴 STF-004 — three endpoints returned three different types for `status` in ONE session:
          200 (int), 1 (int), "success" (string). Code testing body.status == 200 succeeds on
          balance and silently fails on payments. This asserts the client reads a payments body
          whose status is 1, without complaint.
        */
        transport.reply(200, """
                {"status":1,"alertClass":"success","message":"Fetched successfully!","payments":[
                  {"payment_id":"SFC-20580605","amount":12500,"method":"Bank","due_bills":270,
                   "paid_bills":0,"charges":122,"total":12108,"status_label":"paid",
                   "created_at":"2024-02-20 18:47:26","ready_at":"2024-02-22 04:47:14",
                   "paid_at":"2024-02-22 10:12:00"}]}
                """);

        List<SteadfastCourierClient.Remittance> remittances = client.remittances(1);

        assertThat(remittances).hasSize(1);
        SteadfastCourierClient.Remittance one = remittances.getFirst();
        assertThat(one.paymentId()).isEqualTo("SFC-20580605");
        assertThat(one.amount()).isEqualByComparingTo("12500");
        assertThat(one.charges()).isEqualByComparingTo("122");
        assertThat(one.total()).isEqualByComparingTo("12108");
    }

    @Test
    @DisplayName("keeps the courier's three remittance moments apart")
    void keepsThreeRemittanceMomentsApart() {
        transport.reply(200, """
                {"status":1,"payments":[{"payment_id":"SFC-1","amount":100,"charges":2,"total":98,
                 "method":"Bank","status_label":"paid","created_at":"2024-02-20 18:47:26",
                 "ready_at":"2024-02-22 04:47:14","paid_at":"2024-02-25 09:00:00"}]}
                """);

        SteadfastCourierClient.Remittance one = client.remittances(1).getFirst();

        /*
          🔴 BD-438 found THREE facts where the architecture had two: the courier collects, the
          courier states it has remitted, and the money arrives — days apart. BR-035 and SMA-079
          make COLLECTED_BY_INTERMEDIARY → RECEIVED a MANUAL transition precisely because a
          courier statement is not receipt. Flattening these into one timestamp here would
          destroy the distinction that rule depends on.
        */
        assertThat(one.createdAt()).isEqualTo("2024-02-20 18:47:26");
        assertThat(one.readyAt()).isEqualTo("2024-02-22 04:47:14");
        assertThat(one.paidAt()).isEqualTo("2024-02-25 09:00:00");
        // ⚠ And the courier's own word is carried as ITS claim, never mapped to an SM-5 state.
        assertThat(one.statusLabel()).isEqualTo("paid");
    }

    @Test
    @DisplayName("reads coverage and keeps an unfilled post code absent rather than empty")
    void readsCoverage() {
        transport.reply(200, """
                {"status":"success","data":[{"id":66,"name":"Bagerhat","policestations":[
                  {"id":127,"name":"Bagerhat sadar","hub_id":78,"district_id":66,"ps_type":3,
                   "big_parcel":1,"post_code":null,"address":null}]}]}
                """);

        List<SteadfastCourierClient.CoverageArea> coverage = client.coverage();

        // ✅ Note this body's status is the STRING "success" — a third shape again (STF-004).
        assertThat(coverage).hasSize(1);
        SteadfastCourierClient.CoverageStation station = coverage.getFirst().stations().getFirst();
        assertThat(station.name()).isEqualTo("Bagerhat sadar");
        // ⚠ DLV-012 — big_parcel is the per-station capability flag E-036's coverage anticipates.
        assertThat(station.acceptsBigParcel()).isTrue();
        // ⚠ BR-134 — the field exists and the provider did not fill it. Absent is not empty.
        assertThat(station.postCode()).isEmpty();
    }

    @Test
    @DisplayName("returns the courier's raw delivery word untranslated")
    void returnsRawDeliveryStatus() {
        transport.reply(200,
                "{\"status\":200,\"consignment_id\":\"123\",\"tracking_code\":\"ABC\","
                        + "\"delivery_status\":\"in_review\"}");

        SteadfastCourierClient.ConsignmentStatus status = client.statusByInvoice("TR0001").orElseThrow();

        /*
          🔴 STF-011 — no delivery_status value has ever been observed live, so NO SM-4 mapping
          exists and none is guessed. BR-007 / SYS-034 forbid coercing an unknown value into a
          canonical state, and BR-005 / OM §4.3 put the translation in the adapter once the
          vocabulary is actually known.
        */
        assertThat(status.deliveryStatus()).isEqualTo("in_review");
        assertThat(status.trackingCode()).isEqualTo("ABC");
    }

    @Test
    @DisplayName("refuses to act unconfigured, and names the missing variable")
    void refusesToActUnconfigured() {
        SteadfastCourierClient unconfigured = new SteadfastCourierClient(
                transport, new SteadfastProperties("", "", null));

        // ⚠ Fails by NAME rather than surfacing a provider error that means something else.
        assertThatThrownBy(unconfigured::balance)
                .isInstanceOf(SteadfastConfigurationException.class)
                .hasMessageContaining("integration.steadfast.api-key");
    }

    @Test
    @DisplayName("never puts either key into its own string form")
    void neverPrintsTheCredential() {
        // 🔴 DEP-021.d / STF-003.b — the key is static and never expires, so a leak into a log
        // line persists until a human rotates it. A configuration object is exactly the kind of
        // thing that ends up in a debug log.
        assertThat(properties.toString())
                .doesNotContain("test-key")
                .doesNotContain("test-secret");
    }

    /** Records what was sent and replies with what the test stages. */
    private static final class RecordingTransport implements SteadfastTransport {
        private final List<String> urls = new ArrayList<>();
        private String lastUrl;
        private Map<String, String> lastHeaders = Map.of();
        private int status = 200;
        private String body = "{}";

        void reply(int status, String body) {
            this.status = status;
            this.body = body;
        }

        @Override
        public Response get(String url, Map<String, String> headers) {
            urls.add(url);
            lastUrl = url;
            lastHeaders = headers;
            return new Response(status, body);
        }
    }

    @Test
    @DisplayName("asks for a sane page even when handed a nonsense one")
    void clampsPage() {
        transport.reply(200, "{\"status\":1,\"payments\":[]}");

        client.remittances(0);
        assertThat(transport.lastUrl).endsWith("/payments?page=1");

        client.remittances(-5);
        assertThat(transport.lastUrl).endsWith("/payments?page=1");
    }

    @Test
    @DisplayName("reports an unusable status as transport, not as unreadable JSON")
    void reportsBadStatusAsTransportFailure() {
        // ⚠ A 500 is a provider fault; a malformed body is a protocol fault. Collapsing them
        // makes an outage look like a parsing bug and sends an operator to the wrong place.
        transport.reply(500, "<html>Server Error</html>");

        assertThatThrownBy(() -> client.remittances(1))
                .isInstanceOf(SteadfastTransportException.class)
                .satisfies(e -> assertThat(((SteadfastTransportException) e).status()).isEqualTo(500));
    }

    @Test
    @DisplayName("requires an invoice reference rather than calling with a blank path")
    void requiresAnInvoice() {
        // ⚠ A blank reference would build /status_by_invoice/ and ask the provider a question
        // about nothing, then interpret its 401 as "not found" — a wrong answer arrived at twice.
        assertThatThrownBy(() -> client.statusByInvoice("  "))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(transport.urls).isEmpty();
    }

    @Test
    @DisplayName("carries no booking, bulk, cancel or return capability at all")
    void carriesNoWriteCapability() {
        /*
          🔴 A STRUCTURAL ASSERTION, AND IT IS DELIBERATE. Two independent rules each forbid a
          booking path here, and either alone would be sufficient:

            - PRM-089.f — a capability whose code is not ratified is not implementable, and
              implementation may never coin one. No delivery.* code exists anywhere in
              PERMISSION_ARCHITECTURE.md, while DLV §22 requires every dispatch permissioned and
              attributable.
            - STF-010.b — whether Steadfast rejects a duplicate `invoice` or silently books a
              SECOND parcel is unknown. BR-023 allows an order at most ONE active shipment, so a
              silent double booking violates that invariant at the courier, where the ERP can
              neither see it nor undo it.

          If someone adds a booking method, this test fails and they must read both rules first.
        */
        List<String> methods = java.util.Arrays.stream(SteadfastCourierClient.class.getDeclaredMethods())
                .map(java.lang.reflect.Method::getName)
                .filter(name -> !name.startsWith("lambda$"))
                .toList();

        assertThat(methods).noneSatisfy(name ->
                assertThat(name.toLowerCase()).containsAnyOf("book", "create", "cancel", "return", "bulk"));
    }
}
