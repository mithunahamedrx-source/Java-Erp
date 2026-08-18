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

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * One live {@code /products/get}, reporting SHAPE and nothing else.
 *
 * <p>🔴 IT EXISTS BECAUSE THE LAST UNKNOWN COST US A GATE. The connection gate stalled on one
 * unguessable fact — a Bangladesh local seller returns {@code user_info}, not
 * {@code country_user_info} — and the only thing that settled it was a live response reported as
 * field NAMES. {@code DZC-024} records four more unpublished facts about this endpoint. This asks
 * the provider once, before an adapter that trusts those facts is ever deployed.
 *
 * <p>🔴 IT WRITES NOTHING, AND CANNOT. It holds no listing repository, no
 * {@code ChannelListingOperationService}, no snapshot mapper. There is no code path from here to
 * {@code channel_listing}, {@code channel_listing_sku}, {@code channel_listing_activity} or
 * {@code channel_listing_operation}. ⚠ The one write it could cause is a token refresh, which is
 * {@link DarazAccessTokenProvider}'s own business and only happens if the credential needed it.
 *
 * <p>🔴 NO PROVIDER VALUE IS EVER REPORTED. Not a title, price, stock figure, image URL, item id
 * or seller SKU — only field NAMES, node TYPES and counts. A diagnostic that printed a body to
 * "help" would put a seller's catalogue and an access token into a terminal scrollback.
 */
@Service
public class DarazListingShapeDiagnostic {

    /** ⚠ The smallest page the endpoint accepts: this is a shape probe, not a read. */
    private static final int PROBE_LIMIT = 1;

    private static final String PRODUCTS_GET_PATH = "/products/get";
    private static final String BANGLADESH_REST_BASE = "https://api.daraz.com.bd/rest";

    private final DarazProperties properties;
    private final DarazRequestSigner signer;
    private final DarazTransport transport;
    private final DarazAccessTokenProvider tokens;
    private final ChannelInstanceRepository channels;
    private final ChannelConnectionRepository connections;
    private final ObjectMapper json = new ObjectMapper();

    public DarazListingShapeDiagnostic(DarazProperties properties,
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

    /** ⚠ A refusal the operator can act on. Carries no provider text and no credential. */
    public static class DiagnosticRefusedException extends RuntimeException {
        public DiagnosticRefusedException(String message) {
            super(message, null, false, false);
        }
    }

    /**
     * Runs the probe once and returns the safe report lines.
     *
     * <p>🔴 EXACTLY ONE REQUEST. There is no loop, no paging and no retry: a second call would
     * make this a read rather than a probe.
     */
    public List<String> probe(UUID channelInstanceId) {
        if (channelInstanceId == null) {
            throw new DiagnosticRefusedException("A channel instance id is required.");
        }
        ChannelInstanceEntity channel = channels.findById(channelInstanceId)
                .orElseThrow(() -> new DiagnosticRefusedException(
                        "Refused: no registered shop with that id."));

        /* 🔴 FAIL CLOSED — the wrong channel type would sign a Daraz request for a shop that is
           not on Daraz, which is a call nobody asked for. */
        if (!"DARAZ".equalsIgnoreCase(channel.getChannelType())) {
            throw new DiagnosticRefusedException(
                    "Refused: this shop is on " + channel.getChannelType() + ", not Daraz.");
        }

        /* 🔴 FAIL CLOSED — an unconnected shop has nothing to ask on behalf of. */
        ConnectionState state = connections.findByChannelInstanceIdIn(List.of(channelInstanceId))
                .stream().map(c -> c.getState()).findFirst().orElse(null);
        if (state != ConnectionState.CONNECTED) {
            throw new DiagnosticRefusedException(
                    "Refused: this shop is not connected (" + (state == null ? "no connection record" : state)
                            + "). Authorise it before probing.");
        }

        /* 🔴 FAIL CLOSED — no credential, no call. The provider is never asked to reject us. */
        String accessToken;
        try {
            accessToken = tokens.accessTokenFor(channelInstanceId);
        } catch (RuntimeException e) {
            throw new DiagnosticRefusedException(
                    "Refused: no usable Daraz credential for this shop (" + e.getClass().getSimpleName() + ").");
        }

        Map<String, String> params = new LinkedHashMap<>();
        params.put("app_key", properties.require().appKey());
        params.put("timestamp", Long.toString(Instant.now().toEpochMilli()));
        params.put("sign_method", DarazRequestSigner.SIGN_METHOD);
        params.put("access_token", accessToken);
        params.put("filter", "live");
        params.put("limit", Integer.toString(PROBE_LIMIT));

        String signature = signer.sign(PRODUCTS_GET_PATH, params, null, properties.require().appSecret());
        UriComponentsBuilder uri = UriComponentsBuilder.fromUriString(BANGLADESH_REST_BASE + PRODUCTS_GET_PATH);
        params.forEach(uri::queryParam);
        uri.queryParam(DarazRequestSigner.SIGNATURE_PARAMETER, signature);

        String body;
        try {
            body = transport.get(uri.build().encode().toUri());
        } catch (RuntimeException e) {
            /* 🔴 The transport's own message is safe by construction; its class name is enough. */
            return List.of("transport      : FAILED (" + e.getClass().getSimpleName() + ")",
                    "note           : nothing was read and nothing was written.");
        }
        return describe(body);
    }

    /**
     * Turns the response into report lines that carry no value.
     *
     * <p>⚠ Every line below is a field NAME, a node TYPE, a boolean or a count. Nothing here can
     * render a title, a price, an image URL, an item id or a seller SKU.
     */
    private List<String> describe(String body) {
        List<String> out = new ArrayList<>();
        if (body == null || body.isBlank()) {
            out.add("response       : EMPTY");
            return out;
        }
        JsonNode root;
        try {
            root = json.readTree(body);
        } catch (Exception e) {
            /* 🔴 The body is NOT quoted: it may carry a whole catalogue. */
            out.add("response       : NOT JSON");
            return out;
        }
        if (root == null || !root.isObject()) {
            out.add("response       : JSON but not an object (" + typeOf(root) + ")");
            return out;
        }

        out.add("top-level      : " + names(root));

        JsonNode code = root.get("code");
        boolean refused = code != null && !code.asText("").isEmpty() && !"0".equals(code.asText());
        /* ✅ The envelope code is the provider's classification of its own refusal, and DZC-011
           already treats it as safe to log. `message` and `type` text is NOT reported. */
        out.add("envelope code  : " + (code == null ? "ABSENT" : code.asText()) + (refused ? "  (REFUSED)" : ""));
        if (refused) {
            out.add("note           : the provider refused; no shape can be read from a refusal.");
            return out;
        }

        JsonNode data = root.get("data");
        if (data == null || !data.isObject()) {
            out.add("data           : " + typeOf(data));
            return out;
        }
        out.add("data fields    : " + names(data));

        JsonNode total = data.get("total_products");
        out.add("total_products : " + (total == null ? "ABSENT" : total.asText("") + "  (count only)"));

        JsonNode products = data.get("products");
        out.add("products node  : " + typeOf(products)
                + (products != null && products.isArray() ? "  size=" + products.size() : ""));

        if (products == null || !products.isArray() || products.isEmpty()) {
            out.add("note           : no product returned, so no product or SKU shape is available.");
            return out;
        }

        JsonNode product = products.get(0);
        out.add("product fields : " + names(product));
        /* 🔴 THE SCROLLING QUESTION. Date scrolling is the only viable paging (`DZC-028`), and it
           depends entirely on this field existing. Its PRESENCE is reported; its value is not. */
        out.add("updated_time   : " + presence(product, "updated_time")
                + "   created_time: " + presence(product, "created_time"));
        out.add("images node    : " + typeOf(product.get("images"))
                + "   marketImages: " + typeOf(product.get("marketImages")));

        JsonNode attributes = product.get("attributes");
        out.add("attributes     : " + typeOf(attributes)
                + (attributes != null && attributes.isObject() ? "  " + names(attributes) : ""));

        JsonNode skus = product.get("skus");
        out.add("skus node      : " + typeOf(skus)
                + (skus != null && skus.isArray() ? "  size=" + skus.size() : ""));
        if (skus != null && skus.isArray() && !skus.isEmpty()) {
            out.add("sku fields     : " + names(skus.get(0)));
            for (String key : List.of("SellerSku", "ShopSku", "SkuId", "price", "special_price",
                    "quantity", "special_from_time", "special_to_time")) {
                out.add("  " + pad(key) + ": " + presence(skus.get(0), key)
                        + "  type=" + typeOf(skus.get(0).get(key)));
            }
        }
        return out;
    }

    private static String pad(String key) {
        return (key + "                 ").substring(0, 17);
    }

    /** 🔴 Names only, joined. Never a value. */
    private static String names(JsonNode node) {
        if (node == null || !node.isObject()) {
            return typeOf(node);
        }
        List<String> keys = new ArrayList<>();
        node.properties().forEach(entry -> keys.add(entry.getKey()));
        return "[" + String.join(", ", keys) + "]";
    }

    private static String presence(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? "ABSENT" : "PRESENT";
    }

    private static String typeOf(JsonNode node) {
        if (node == null) {
            return "ABSENT";
        }
        return node.getNodeType().name();
    }
}
