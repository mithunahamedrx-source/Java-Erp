package com.trioloo.erp.integration.application;

import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.integration.infrastructure.daraz.DarazAccessTokenProvider;
import com.trioloo.erp.integration.infrastructure.daraz.DarazProperties;
import com.trioloo.erp.integration.infrastructure.daraz.DarazRequestSigner;
import com.trioloo.erp.integration.infrastructure.daraz.DarazTransport;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The controlled, read-only Daraz order pull probe for {@code /orders/get}.
 *
 * <p>🔴 IT EXISTS TO PROVE THE {@code §12} READ PROTOCOL AGAINST A REAL ACCOUNT, and nothing else.
 * {@code DZC-045} was written from the provider's rendered reference; this asks whether the
 * account answers the way the reference says. ⚠ It settles the {@code limt} / {@code limit}
 * contradiction the provider's own documentation carries ({@code DZC-050.d}), which can be settled
 * by asking and by nothing else.
 *
 * <p>🔴 IT IS A READ AND IT WRITES NOTHING. No order, listing, product, inventory or payment row is
 * touched, no operation is recorded, and no imported order is stored. ⚠ Storing orders is a LATER
 * slice that needs a migration, and no migration number may be assigned while the {@code V15}
 * production contradiction stands ({@code OSC-060}, {@code DEP-070.b}).
 *
 * <p>🔴 ITS COLLABORATORS ARE THE BLAST RADIUS, AND THEY ARE DELIBERATELY FEW. It holds two
 * repositories — channel identity and connection state — and calls only finders on them. There is
 * no repository here that could write an Order, a Listing, an Inventory position or a Payment,
 * whatever the probe were asked to do.
 *
 * <p>🔴 DRY RUN CONTACTS NOTHING AT ALL, INCLUDING THE TOKEN ENDPOINT. ⚠ That is not a detail:
 * {@link DarazAccessTokenProvider} performs an on-demand REFRESH when a credential has expired,
 * which is itself a call to Daraz. A dry run that resolved a token would therefore contact the
 * provider while claiming not to.
 *
 * <p>🔴 THE REPORT CARRIES NO SELLER DATA. Every line it can emit is an outcome, a provider code, a
 * count or a field NAME. No buyer name, address, phone, price, order number or item SKU can reach
 * it ({@code AUD-004} attribution discipline, {@code API-070} secret boundary).
 */
@Service
public class DarazOrderPullProbe {

    /** 🔴 {@code DZC-044} — the path is signed verbatim, so it is written once and never built. */
    private static final String ORDERS_GET_PATH = "/orders/get";

    /** 🔴 {@code DZC-043.c} — Bangladesh. A probe is not a place to discover a base URL. */
    private static final String BANGLADESH_REST_BASE = "https://api.daraz.com.bd/rest";

    /**
     * 🔴 {@code DZC-050.d} — THE PROVIDER CONTRADICTS ITSELF AND THIS PROBE PICKS ONE.
     *
     * <p>Daraz's parameter table prints {@code limt}; its own {@code E019} error text says "the
     * limit parameter"; the corroborating platform page prints {@code limit}. ⚠ This sends
     * {@code limit} and the report names the other spelling as the next thing to try, because a
     * probe settles a question by asking rather than by choosing quietly.
     */
    static final String PAGE_SIZE_PARAMETER = "limit";

    /** ⚠ The published ceiling is 100 ({@code DZC-045.b}); a probe asks for far less. */
    private static final int PROBE_PAGE_SIZE = 10;

    /** 🔴 {@code DZC-045.b} — offset paging. There is no cursor ({@code DZC-049.d}). */
    private static final int PROBE_OFFSET = 0;

    /** ⚠ {@code DZC-045.a} — one of the two after-dates is mandatory in practice. */
    private static final String CREATED_AFTER = "created_after";
    private static final String CREATED_BEFORE = "created_before";

    /** ⚠ {@code DZC-045} — sorting by creation keeps a probe window deterministic. */
    private static final String SORT_BY = "sort_by";
    private static final String SORT_DIRECTION = "sort_direction";

    private final DarazProperties properties;
    private final DarazRequestSigner signer;
    private final DarazTransport transport;
    private final DarazAccessTokenProvider tokens;
    private final ChannelInstanceRepository channels;
    private final ChannelConnectionRepository connections;
    private final ObjectMapper json = new ObjectMapper();

    public DarazOrderPullProbe(DarazProperties properties,
                               DarazRequestSigner signer,
                               DarazTransport transport,
                               DarazAccessTokenProvider tokens,
                               ChannelInstanceRepository channels,
                               ChannelConnectionRepository connections) {
        this.properties = properties;
        this.signer = signer;
        this.transport = transport;
        this.tokens = tokens;
        this.channels = channels;
        this.connections = connections;
    }

    /** A refusal an operator caused and can act on. ⚠ Its message is safe to print by construction. */
    public static class ProbeRefusedException extends RuntimeException {
        public ProbeRefusedException(String message) {
            super(message, null, false, false);
        }
    }

    /**
     * Describes the request this probe WOULD send, without contacting anything.
     *
     * <p>🔴 NOTHING LEAVES THE HOST ON THIS PATH — not the marketplace, not the token endpoint. The
     * shop is resolved from local state so the refusals are real, and then the endpoint, the
     * parameter NAMES and the operator's own window are printed.
     *
     * <p>⚠ NO PARAMETER VALUE THAT IS A SECRET IS PRINTED. {@code app_key}, {@code access_token}
     * and {@code sign} are named and never rendered ({@code API-070}).
     */
    public List<String> describeRequest(UUID channelInstanceId, Instant createdAfter, Instant createdBefore) {
        Window window = window(createdAfter, createdBefore);
        ChannelInstanceEntity channel = selectShop(channelInstanceId);

        List<String> out = new ArrayList<>();
        out.add("mode           : DRY RUN — nothing was contacted, including the token endpoint.");
        out.add("shop           : registered, channel type " + channel.getChannelType() + ", CONNECTED");
        out.add("method         : GET");
        out.add("endpoint       : " + BANGLADESH_REST_BASE + ORDERS_GET_PATH);
        out.add("window from    : " + window.after());
        out.add("window to      : " + window.before());
        out.add("signed params  : " + String.join(", ", parameterNames()));
        out.add("page size      : " + PROBE_PAGE_SIZE + " (published ceiling is 100 — `DZC-045.b`)");
        out.add("offset         : " + PROBE_OFFSET + " (offset paging; NO cursor exists — `DZC-049.d`)");
        out.add("page-size name : " + PAGE_SIZE_PARAMETER
                + "  ⚠ the provider also prints `limt` — `DZC-050.d` is unsettled");
        out.add("credentials    : app_key, access_token and sign are SENT but never printed.");
        out.add("expected shape : data{ countTotal, count, orders[] } — `DZC-045.d`");
        out.add("would report   : outcome, provider code, countTotal, count, envelope field names,");
        out.add("                 and order field NAMES only. No buyer, address, phone, price,");
        out.add("                 order number or SKU value is ever printed.");
        out.add("trioloo writes : NONE, on this path and on the live one alike.");
        return out;
    }

    /**
     * Performs ONE read and reports only what is safe to print.
     *
     * <p>🔴 EXACTLY ONE REQUEST. There is no loop, no paging and no retry: a second call would make
     * this an import rather than a probe.
     *
     * @return report lines carrying outcome, counts and field names — never a seller value.
     */
    public List<String> probe(UUID channelInstanceId, Instant createdAfter, Instant createdBefore) {
        Window window = window(createdAfter, createdBefore);
        selectShop(channelInstanceId);

        /* 🔴 FAIL CLOSED — no credential, no call. The provider is never asked to reject us. */
        String accessToken;
        try {
            accessToken = tokens.accessTokenFor(channelInstanceId);
        } catch (RuntimeException e) {
            throw new ProbeRefusedException(
                    "Refused: no usable Daraz credential for this shop (" + e.getClass().getSimpleName() + ").");
        }

        Map<String, String> params = new LinkedHashMap<>();
        params.put("app_key", properties.require().appKey());
        params.put("timestamp", Long.toString(Instant.now().toEpochMilli()));
        params.put("sign_method", DarazRequestSigner.SIGN_METHOD);
        params.put("access_token", accessToken);
        params.put(CREATED_AFTER, window.after());
        params.put(CREATED_BEFORE, window.before());
        params.put(SORT_BY, "created_at");
        params.put(SORT_DIRECTION, "ASC");
        params.put("offset", Integer.toString(PROBE_OFFSET));
        params.put(PAGE_SIZE_PARAMETER, Integer.toString(PROBE_PAGE_SIZE));

        String signature = signer.sign(ORDERS_GET_PATH, params, null, properties.require().appSecret());
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(BANGLADESH_REST_BASE + ORDERS_GET_PATH);
        params.forEach(uri::queryParam);
        uri.queryParam(DarazRequestSigner.SIGNATURE_PARAMETER, signature);

        String body;
        try {
            URI target = uri.build().encode().toUri();
            body = transport.get(target);
        } catch (RuntimeException e) {
            /* 🔴 The transport's own message is safe by construction; its class name is enough. */
            return List.of("outcome        : TRANSPORT FAILED (" + e.getClass().getSimpleName() + ")",
                    "note           : nothing was read and nothing was written in Trioloo.");
        }
        return describe(body);
    }

    /** The parameter names a live call would sign, for the dry run to print. */
    static List<String> parameterNames() {
        return List.of("app_key", "timestamp", "sign_method", "access_token",
                CREATED_AFTER, CREATED_BEFORE, SORT_BY, SORT_DIRECTION,
                "offset", PAGE_SIZE_PARAMETER, DarazRequestSigner.SIGNATURE_PARAMETER);
    }

    /**
     * The shop, or a refusal naming what is missing.
     *
     * <p>🔴 EVERY CHECK FAILS CLOSED. A probe that guessed past a missing fact would sign a read for
     * a shop nobody chose.
     */
    private ChannelInstanceEntity selectShop(UUID channelInstanceId) {
        if (channelInstanceId == null) {
            throw new ProbeRefusedException("Refused: a channel instance id is required.");
        }
        ChannelInstanceEntity channel = channels.findById(channelInstanceId)
                .orElseThrow(() -> new ProbeRefusedException("Refused: no registered shop with that id."));

        /* 🔴 FAIL CLOSED — signing a Daraz read for a shop that is not on Daraz is a call nobody asked for. */
        if (!"DARAZ".equalsIgnoreCase(channel.getChannelType())) {
            throw new ProbeRefusedException(
                    "Refused: this shop is on " + channel.getChannelType() + ", not Daraz.");
        }

        /* 🔴 FAIL CLOSED — an unconnected shop has nothing to read on behalf of. */
        ConnectionState state = connections.findByChannelInstanceIdIn(List.of(channelInstanceId))
                .stream().map(c -> c.getState()).findFirst().orElse(null);
        if (state != ConnectionState.CONNECTED) {
            throw new ProbeRefusedException(
                    "Refused: this shop is not connected (" + (state == null ? "no connection record" : state)
                            + "). Authorise it before probing.");
        }
        return channel;
    }

    /**
     * The window, validated.
     *
     * <p>🔴 {@code DZC-045.a} — an after-date is mandatory in practice, so its absence is a refusal
     * rather than an unbounded read. ⚠ A probe must never ask a marketplace for everything.
     */
    private Window window(Instant createdAfter, Instant createdBefore) {
        if (createdAfter == null) {
            throw new ProbeRefusedException(
                    "Refused: a created-after instant is required — `DZC-045.a` makes one of the"
                            + " after-dates mandatory, and a probe never reads unbounded.");
        }
        if (createdBefore == null) {
            throw new ProbeRefusedException(
                    "Refused: a created-before instant is required — a probe reads a SMALL window.");
        }
        if (!createdBefore.isAfter(createdAfter)) {
            throw new ProbeRefusedException(
                    "Refused: the created-before instant must be later than created-after.");
        }
        return new Window(createdAfter.toString(), createdBefore.toString());
    }

    /**
     * Turns the response into report lines that carry no seller value.
     *
     * <p>⚠ Every line below is an outcome, a provider code, a COUNT or a field NAME. Nothing here
     * can render a buyer name, an address, a phone number, a price, an order number or a SKU.
     */
    private List<String> describe(String body) {
        List<String> out = new ArrayList<>();
        if (body == null || body.isBlank()) {
            out.add("outcome        : EMPTY RESPONSE");
            return out;
        }
        JsonNode root;
        try {
            root = json.readTree(body);
        } catch (Exception e) {
            out.add("outcome        : UNREADABLE RESPONSE (" + e.getClass().getSimpleName() + ")");
            out.add("note           : the provider replied with something that is not JSON.");
            return out;
        }

        /* 🔴 `DZC-010` — `code` is a STRING and "0" is the only success. */
        String code = text(root, "code");
        boolean accepted = "0".equals(code);

        out.add("outcome        : " + (accepted ? "ACCEPTED by Daraz" : "REFUSED by Daraz"));
        out.add("provider code  : " + (code == null ? "(absent)" : code));
        out.add("provider type  : " + orAbsent(text(root, "type")));
        out.add("request id     : " + orAbsent(text(root, "request_id")));

        /* ⚠ THE PROVIDER'S OWN MESSAGE IS NOT PRINTED. It can echo a filter value back. */
        out.add("message present: " + (root.hasNonNull("message") && !root.get("message").asText().isBlank()));
        out.add("envelope fields: " + names(root));

        JsonNode data = root.get("data");
        if (data == null || data.isNull()) {
            out.add("data node      : (absent)");
        } else {
            out.add("data fields    : " + names(data));
            out.add("countTotal     : " + orAbsent(text(data, "countTotal")));
            out.add("count          : " + orAbsent(text(data, "count")));

            JsonNode orders = data.get("orders");
            if (orders == null || !orders.isArray()) {
                out.add("orders node    : (absent or not an array)");
            } else {
                out.add("orders returned: " + orders.size());
                if (!orders.isEmpty()) {
                    /* 🔴 FIELD NAMES ONLY. The first element is inspected for its KEYS and for
                       nothing else — no value from it reaches this report. */
                    out.add("order fields   : " + names(orders.get(0)));
                    out.add("address nodes  : "
                            + (orders.get(0).has("address_billing") ? "address_billing " : "")
                            + (orders.get(0).has("address_shipping") ? "address_shipping" : ""));
                }
            }
        }

        if (accepted) {
            out.add("answers        : `" + PAGE_SIZE_PARAMETER + "` was accepted as the page-size"
                    + " parameter — `DZC-050.d` settled for this account.");
        } else if ("19".equals(code) || (code != null && code.contains("E019"))) {
            out.add("answers        : E019 names the page-size parameter — re-run against `limt`,"
                    + " the other spelling `DZC-050.d` records.");
        } else {
            out.add("answers        : the refusal code above is the answer — record it against"
                    + " `DZC-045.g` and do not retry blind.");
        }
        out.add("trioloo writes : NONE. No order, listing, inventory or payment row was touched.");
        return out;
    }

    private static String orAbsent(String value) {
        return value == null ? "(absent)" : value;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static String names(JsonNode node) {
        if (node == null || !node.isObject()) {
            return "(not an object)";
        }
        List<String> fields = new ArrayList<>();
        node.properties().forEach(entry -> fields.add(entry.getKey()));
        return fields.isEmpty() ? "(none)" : String.join(", ", fields);
    }

    /** The validated window, held as the ISO 8601 strings the provider expects. */
    private record Window(String after, String before) {
    }
}
