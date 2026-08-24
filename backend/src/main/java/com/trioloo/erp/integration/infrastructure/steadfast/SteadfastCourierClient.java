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
 * <p>⚠ AMENDED 2026-08-24. THIS CLASS WAS READ-ONLY FOR TWO REASONS, AND EXACTLY ONE OF THEM HAS
 * BEEN DISCHARGED.
 *
 * <ul>
 *   <li>✅ <b>Discharged.</b> {@code PRM-089.f} — <em>a capability whose code is not yet ratified
 *       is not implementable</em> — held while no {@code delivery.*} code existed.
 *       {@code PRM-092} now ratifies {@code delivery.shipment.book}, so the authority exists.
 *       🔴 It is enforced in the APPLICATION SERVICE, never here: a transport-level client is not
 *       an authorisation boundary ({@code PRM-004}).</li>
 *   <li>🔴 <b>NOT discharged.</b> {@code STF-010.b} — whether Steadfast REJECTS a duplicate
 *       {@code invoice} or silently books a SECOND parcel is still UNKNOWN, and one controlled
 *       booking is what will settle it. ⚠ {@code BR-023} as amended allows an order at most ONE
 *       ACTIVE shipment, so the ERP does NOT rely on the provider to enforce this: {@code V21}
 *       carries a unique index on a booked invoice and another on an active shipment per order.
 *       <b>The database refuses a second booking whether or not Steadfast would.</b></li>
 * </ul>
 *
 * <p>🔴 STILL NO BULK CREATE, NO CANCELLATION AND NO RETURN REQUEST. {@code STF-006} found no
 * endpoint for the latter two under the names probed, and {@code GAP-034} keeps the bulk path
 * blocked for want of a permitted-action inventory.
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

    /**
     * Books ONE consignment with the courier — {@code STF-010}.
     *
     * <p>🔴 THIS SPENDS MONEY AND DISPATCHES A RIDER. It is the only method on this class with an
     * effect outside Trioloo, and deliberately the only one.
     *
     * <p>🔴 IT ENFORCES NO AUTHORITY AND NO IDEMPOTENCY, BY DESIGN. {@code delivery.shipment.book}
     * ({@code PRM-092}) is checked in the application service, and the once-only guarantee lives in
     * {@code V21}'s unique indexes. ⚠ A transport client that also policed those rules would put the
     * authorisation boundary in the wrong layer ({@code PRM-004}).
     *
     * <p>⚠ {@code cod_amount} CROSSES AS A JSON NUMBER BECAUSE THE PROVIDER'S API IS SHAPED THAT WAY
     * ({@code STF-010.d}). The conversion happens exactly once, here at the edge, from the
     * authoritative {@code BigDecimal}. 🔴 A provider number never becomes the authoritative amount
     * travelling the other way ({@code TEC-015}, {@code DB-079}).
     */
    public Booking book(BookingRequest request) {
        properties.require();
        String payload = json.writeValueAsString(Map.of(
                "invoice", request.invoice(),
                "recipient_name", request.recipientName(),
                "recipient_phone", request.recipientPhone(),
                "recipient_address", request.recipientAddress(),
                "cod_amount", request.codAmount(),
                "note", request.note() == null ? "" : request.note(),
                "item_description", request.itemDescription() == null ? "" : request.itemDescription()));

        SteadfastTransport.Response raw = transport.post(
                properties.baseUrl() + "/create_order",
                payload,
                Map.of("Api-Key", properties.apiKey(),
                        "Secret-Key", properties.secretKey(),
                        "Content-Type", "application/json",
                        "Accept", "application/json"));

        Response response = new Response(raw.status(), raw.body());
        if (response.status() == 401) {
            /*
              🔴 UNLIKE A STATUS READ, A 401 HERE IS A REFUSAL AND NOT "not found". STF-007
              conflates not-found with unauthorised on reads that carry an identifier; create_order
              carries no lookup, so nothing can be "not yours". ⚠ It still may not be read as a
              credential failure outright - /get_balance is the only honest check (STF-007.e) - so
              the message says what is known and no more.
            */
            throw new SteadfastProtocolException(
                    "Steadfast refused the booking with 401. On this endpoint that is a refusal, "
                            + "not a missing record; confirm the credential with /get_balance "
                            + "before concluding anything about it (STF-007.e).");
        }
        JsonNode root = parse(response, "/create_order");

        JsonNode consignment = root.path("consignment");
        JsonNode source = consignment.isMissingNode() ? root : consignment;
        String consignmentId = text(source, "consignment_id");
        if (consignmentId == null) {
            /*
              🔴 NO CONSIGNMENT ID MEANS NO EVIDENCE THE PARCEL EXISTS. Recording a booking
              without one would create a shipment the ERP believes is with the courier and cannot
              track, cancel or claim on - worse than no record at all.
            */
            throw new SteadfastProtocolException(
                    "Steadfast accepted the booking request but returned no consignment_id, so "
                            + "there is no evidence the consignment exists. Nothing is recorded.");
        }
        return new Booking(
                consignmentId,
                text(source, "tracking_code"),
                // ⚠ Raw, untranslated. STF-011 - no SM-4 mapping exists yet.
                text(source, "status"),
                response.body());
    }

    /**
     * The booking payload.
     *
     * <p>⚠ IT CARRIES NO WEIGHT, NO DIMENSIONS AND NO DECLARED VALUE, AND THAT IS A RECORDED
     * MISMATCH RATHER THAN AN OMISSION. {@code E-037} holds all three; Steadfast's published
     * {@code create_order} accepts none of them. 🔴 The consequence is real: {@code DLV §19}
     * claims and {@code DLV-012}'s declared-value limit rest on a value the courier was never
     * told, so a claim cannot cite a declared value the courier acknowledged.
     */
    public record BookingRequest(String invoice, String recipientName, String recipientPhone,
                                 String recipientAddress, java.math.BigDecimal codAmount,
                                 String note, String itemDescription) {
    }

    /**
     * ⚠ {@code rawBody} is retained so the first real booking's response can be READ rather than
     * guessed at ({@code DLV-037}, {@code AUD-009} - the provider's raw word is kept as received).
     */
    public record Booking(String consignmentId, String trackingCode, String providerStatusRaw,
                          String rawBody) {
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
