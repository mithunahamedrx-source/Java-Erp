package com.trioloo.erp.integration.infrastructure.steadfast;

import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The Steadfast read-only client — {@code STF-005}.
 *
 * <p>🔴 READ ONLY, AND THAT IS A BOUNDARY RATHER THAN A STAGE OF WORK. No booking, no bulk create,
 * no cancellation and no return request exists here, for two independent reasons and either alone
 * would be sufficient:
 *
 * <ul>
 *   <li>🔴 {@code PRM-089.f} — <em>a capability whose code is not yet ratified is not
 *       implementable, and implementation may never coin one.</em> No {@code delivery.*} capability
 *       code exists anywhere in {@code PERMISSION_ARCHITECTURE.md}, while {@code DLV §22} requires
 *       every dispatch to be permissioned and attributable ({@code DLV-011}, {@code AGV-001}).</li>
 *   <li>🔴 {@code STF-010.b} — whether Steadfast REJECTS a duplicate {@code invoice} or silently
 *       books a second parcel is UNKNOWN. {@code BR-023} as amended allows an order at most ONE
 *       ACTIVE shipment, so a silent double booking would violate that invariant at the courier,
 *       where the ERP cannot see it and cannot undo it.</li>
 * </ul>
 *
 * <p>⚠ NOTHING HERE IS WIRED TO AN HTTP ENDPOINT, A SCHEDULER OR A USER ACTION. It is the same
 * shape the first Daraz code took: infrastructure with tests, no surface.
 */
@Component
public class SteadfastCourierClient {

    private final SteadfastTransport transport;
    private final SteadfastProperties properties;
    private final ObjectMapper json = new ObjectMapper();

    public SteadfastCourierClient(SteadfastTransport transport, SteadfastProperties properties) {
        this.transport = transport;
        this.properties = properties;
    }

    /**
     * The credential health check — and the ONLY reliable one ({@code STF-007.e}).
     *
     * <p>🔴 A {@code 401} HERE REALLY IS AN AUTHENTICATION FAILURE, WHICH IS NOT TRUE ANYWHERE ELSE
     * ON THIS API. {@code /get_balance} takes no identifier, so there is no "not yours" and no "not
     * found" for the provider to conflate with "not authenticated" — which is precisely what it
     * does on every status read. Any code wanting to know whether the Steadfast credential works
     * must ask here and nowhere else.
     *
     * <p>⚠ {@code STF-012} — the account balance was observed at {@code 1} on 2026-08-24. Whether
     * Steadfast refuses a booking on insufficient balance was NOT established, so a first booking
     * may fail for a reason that has nothing to do with this code.
     */
    public BigDecimal balance() {
        Response response = call("/get_balance");
        if (response.status() == 401) {
            throw new SteadfastCredentialException(
                    "Steadfast refused the merchant credential on /get_balance. Unlike a status "
                            + "read, a 401 here is unambiguous (STF-007.e): the key or secret is "
                            + "wrong, or it has been rotated in the Steadfast panel.");
        }
        JsonNode root = parse(response, "/get_balance");
        JsonNode balance = root.path("current_balance");
        if (balance.isMissingNode() || balance.isNull()) {
            throw new SteadfastProtocolException(
                    "Steadfast returned no current_balance on /get_balance.");
        }
        // ⚠ Read as a string then converted, so a provider float never becomes the authoritative
        // number by way of a double (TEC-015, DB-079).
        return new BigDecimal(balance.asString());
    }

    /**
     * The COD remittance feed — {@code STF-008}.
     *
     * <p>🔴 THIS RETURNS THE COURIER'S CLAIM, NEVER TRIOLOO'S RECEIPT, AND NOTHING DOWNSTREAM MAY
     * FORGET THAT. {@code BR-035} — money held or reported by an intermediary is not money received
     * by Trioloo — and {@code SM-5}'s {@code COLLECTED_BY_INTERMEDIARY → RECEIVED} is MANUAL
     * precisely because <em>"a courier statement saying money was remitted is not the same fact as
     * receipt"</em> ({@code PAY-070}, {@code PAY-072}, {@code SMA-079}).
     *
     * <p>🔴 NO CALLER MAY AUTO-ADVANCE {@code SM-5} FROM {@code statusLabel}. The three timestamps
     * are returned separately because {@code BD-438} found three distinct facts where the
     * architecture had two, and flattening them here would destroy the distinction.
     *
     * <p>⚠ WHICH CONSIGNMENTS A REMITTANCE COVERS IS NOT IN THIS FEED ({@code STF-008.d}).
     * {@code BD-439} forbids inferring it from the amount.
     */
    public List<Remittance> remittances(int page) {
        Response response = call("/payments?page=" + Math.max(page, 1));
        JsonNode root = parse(response, "/payments");
        List<Remittance> out = new ArrayList<>();
        for (JsonNode node : root.path("payments")) {
            out.add(new Remittance(
                    text(node, "payment_id"),
                    decimal(node, "amount"),
                    decimal(node, "charges"),
                    decimal(node, "total"),
                    text(node, "method"),
                    text(node, "status_label"),
                    text(node, "created_at"),
                    text(node, "ready_at"),
                    text(node, "paid_at")));
        }
        return List.copyOf(out);
    }

    /**
     * Coverage reference data — {@code STF-009}.
     *
     * <p>⚠ {@code big_parcel} is a per-station capability flag, which is the shape {@code E-036}'s
     * coverage and fragility-handling attributes anticipate ({@code DLV-012}).
     *
     * <p>🔴 NO RATE, ZONE PRICE OR DELIVERY TIME IS IN THIS FEED, so {@code DLV §11}'s rate
     * structure is NOT derivable from it and none is inferred.
     */
    public List<CoverageArea> coverage() {
        Response response = call("/police_stations");
        JsonNode root = parse(response, "/police_stations");
        List<CoverageArea> out = new ArrayList<>();
        for (JsonNode district : root.path("data")) {
            List<CoverageStation> stations = new ArrayList<>();
            for (JsonNode station : district.path("policestations")) {
                stations.add(new CoverageStation(
                        station.path("id").asInt(),
                        text(station, "name"),
                        station.path("big_parcel").asInt() == 1,
                        // ⚠ BR-134 — observed null on sampled rows. The field exists and the
                        // provider did not fill it; absent is not empty.
                        Optional.ofNullable(text(station, "post_code"))));
            }
            out.add(new CoverageArea(district.path("id").asInt(), text(district, "name"),
                    List.copyOf(stations)));
        }
        return List.copyOf(out);
    }

    /**
     * A consignment status read, by the merchant's own invoice reference.
     *
     * <p>🔴 AN EMPTY RESULT IS NOT AN ERROR, AND THIS IS THE METHOD {@code STF-007} EXISTS FOR.
     * Steadfast answers {@code 401 Unauthorized Access} — as PLAIN TEXT, not JSON — for an invoice
     * that does not exist AND for one belonging to another merchant, using a credential that is
     * perfectly valid. So {@code 401} here is mapped to {@link Optional#empty()}, never to a
     * credential failure.
     *
     * <p>🔴 THE CONSEQUENCE OF GETTING THIS WRONG IS NOT COSMETIC: an adapter that read this as an
     * auth failure would mark a healthy integration broken, or drive a credential-rotation path,
     * because one parcel could not be found.
     *
     * <p>⚠ NO {@code SM-4} MAPPING IS APPLIED. {@code STF-011} — no {@code delivery_status} value
     * has ever been observed, so the raw provider word is returned untranslated and the
     * {@code BR-005} / {@code OM §4.3} adapter translation cannot yet be written.
     */
    public Optional<ConsignmentStatus> statusByInvoice(String invoice) {
        if (invoice == null || invoice.isBlank()) {
            throw new IllegalArgumentException("An invoice reference is required.");
        }
        Response response = call("/status_by_invoice/" + invoice.trim());
        if (response.status() == 401 || response.status() == 404) {
            return Optional.empty();
        }
        JsonNode root = parse(response, "/status_by_invoice");
        return Optional.of(new ConsignmentStatus(
                text(root, "consignment_id"),
                text(root, "tracking_code"),
                text(root, "delivery_status")));
    }

    /* ------------------------------------------------------------------ internals */

    private Response call(String path) {
        properties.require();
        SteadfastTransport.Response response = transport.get(
                properties.baseUrl() + path,
                Map.of("Api-Key", properties.apiKey(),
                        "Secret-Key", properties.secretKey(),
                        "Accept", "application/json"));
        return new Response(response.status(), response.body());
    }

    /**
     * 🔴 THE HTTP STATUS DECIDES, NOT THE BODY'S {@code status} FIELD ({@code STF-004}).
     * Three endpoints returned three different types for that field in one session — {@code 200},
     * {@code 1} and {@code "success"} — so any code branching on it succeeds at one endpoint and
     * silently fails at another.
     *
     * <p>⚠ A NON-2xx BODY IS NOT PARSED AS JSON. {@code STF-007.d} — the {@code 401} body is the
     * plain string {@code Unauthorized Access}, and parsing it would throw a JSON error that
     * reports the wrong cause entirely.
     */
    private JsonNode parse(Response response, String endpoint) {
        if (response.status() < 200 || response.status() >= 300) {
            throw new SteadfastTransportException(
                    "Steadfast returned an unusable HTTP status on " + endpoint + ".",
                    response.status());
        }
        try {
            return json.readTree(response.body() == null ? "" : response.body());
        } catch (RuntimeException e) {
            // 🔴 The body is NOT quoted: it is provider data and may carry customer detail.
            throw new SteadfastProtocolException(
                    "Steadfast returned a body on " + endpoint + " that could not be read as JSON.");
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        String asText = value.asString();
        return asText == null || asText.isBlank() ? null : asText;
    }

    private static BigDecimal decimal(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        // ⚠ Via the string form, never via a double (TEC-015).
        return new BigDecimal(value.asString());
    }

    private record Response(int status, String body) {
    }

    /**
     * One courier remittance, as the courier reports it.
     *
     * <p>🔴 THREE TIMESTAMPS, KEPT APART ON PURPOSE ({@code BD-438}): the courier readied it, the
     * courier says it paid, and the money arrives — and they can be days apart.
     */
    public record Remittance(String paymentId, BigDecimal amount, BigDecimal charges,
                             BigDecimal total, String method, String statusLabel,
                             String createdAt, String readyAt, String paidAt) {
    }

    public record CoverageArea(int id, String name, List<CoverageStation> stations) {
    }

    public record CoverageStation(int id, String name, boolean acceptsBigParcel,
                                  Optional<String> postCode) {
    }

    /**
     * ⚠ {@code deliveryStatus} IS THE PROVIDER'S RAW WORD, UNTRANSLATED ({@code STF-011}).
     * It is deliberately not an {@code SM-4} state: no value has ever been observed, and
     * {@code BR-007} / {@code SYS-034} forbid coercing an unknown one into a canonical state.
     */
    public record ConsignmentStatus(String consignmentId, String trackingCode,
                                    String deliveryStatus) {
    }
}
