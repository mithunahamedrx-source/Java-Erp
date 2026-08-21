package com.trioloo.erp.integration.application;

import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.integration.infrastructure.daraz.DarazAccessTokenProvider;
import com.trioloo.erp.integration.infrastructure.daraz.DarazProperties;
import com.trioloo.erp.integration.infrastructure.daraz.DarazRequestSigner;
import com.trioloo.erp.integration.infrastructure.daraz.DarazTransport;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingSkuEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingSkuRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceEntity;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.net.URLEncoder;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The controlled, same-value price and stock write probe for {@code /product/price_quantity/update}.
 *
 * <p>🔴 IT EXISTS TO ANSWER THREE QUESTIONS THE PROVIDER DOES NOT DOCUMENT, and nothing else:
 * whether {@code SellerSku} alone addresses a SKU ({@code DZC-039.e}), whether a plain
 * {@code <Quantity>} is accepted or a {@code WarehouseCode} is mandatory ({@code DZC-039.b}), and
 * what envelope this seller's account actually returns. ⚠ Every one of those is a gap in DARAZ'S
 * OWN published documentation ({@code DZC-039}), not a Trioloo decision — which is why they can be
 * settled by asking and by nothing else.
 *
 * <p>🔴 IT SENDS THE VALUES THE CHANNEL ALREADY REPORTS, SO THE LISTING DOES NOT CHANGE. The price
 * and quantity in the payload are read from the stored REPORTED side — what Daraz itself last told
 * us it is showing. ⚠ A probe that sent a different value would be a real price change dressed as
 * a diagnostic, and there would be no honest way to undo it.
 *
 * <p>🔴 IT IS NOT {@code pushUpdate} AND MUST NEVER BECOME IT. It writes nothing to Trioloo, records
 * no operation, touches no listing, product or inventory row, and returns no {@code OutboundResult}.
 * The adapter's outbound half still refuses ({@code PRD-204.g}) and no field became writable.
 *
 * <p>🔴 PROMOTION IS DELIBERATELY ABSENT. The same endpoint carries {@code SalePrice},
 * {@code SaleStartDate} and {@code SaleEndDate}, and this payload carries none of them
 * ({@code DZC-040.e}): a promotion window cannot be read back ({@code DZC-035.b}), so sending one
 * could not be verified — and an unverifiable write is exactly what a probe must not perform.
 *
 * <p>⚠ THE ONLY PERMITTED PERSISTENT SIDE EFFECT IS A TOKEN REFRESH, which
 * {@link DarazAccessTokenProvider} performs on its own terms when a credential has expired.
 */
@Service
public class DarazPriceStockProbe {

    /** 🔴 {@code DZC-033} — the path is signed verbatim, so it is written once and never built. */
    private static final String PRICE_QUANTITY_PATH = "/product/price_quantity/update";

    /** 🔴 {@code DZC-034.a} — Bangladesh. The probe is not a place to discover a base URL. */
    private static final String BANGLADESH_REST_BASE = "https://api.daraz.com.bd/rest";

    /** 🔴 {@code DZC-033} — this endpoint's body parameter is {@code payload}, not the other two. */
    private static final String PAYLOAD_PARAMETER = "payload";

    private static final String FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

    private final DarazProperties properties;
    private final DarazRequestSigner signer;
    private final DarazTransport transport;
    private final DarazAccessTokenProvider tokens;
    private final ChannelListingRepository listings;
    private final ChannelListingSkuRepository skus;
    private final ChannelInstanceRepository channels;
    private final ChannelConnectionRepository connections;
    private final ObjectMapper json = new ObjectMapper();

    public DarazPriceStockProbe(DarazProperties properties,
                                DarazRequestSigner signer,
                                DarazTransport transport,
                                DarazAccessTokenProvider tokens,
                                ChannelListingRepository listings,
                                ChannelListingSkuRepository skus,
                                ChannelInstanceRepository channels,
                                ChannelConnectionRepository connections) {
        this.properties = properties;
        this.signer = signer;
        this.transport = transport;
        this.tokens = tokens;
        this.listings = listings;
        this.skus = skus;
        this.channels = channels;
        this.connections = connections;
    }

    /** A refusal an operator caused and can act on. ⚠ Its message is safe to print by construction. */
    public static class ProbeRefusedException extends RuntimeException {
        public ProbeRefusedException(String message) {
            super(message);
        }
    }

    /**
     * Builds the payload this probe WOULD send, without contacting anything.
     *
     * <p>🔴 SEPARATED FROM {@link #probe} ON PURPOSE. It is what the tests assert against and what
     * an operator can inspect before authorising a live run, so the shape can be reviewed without
     * a single byte leaving the host.
     */
    public String payloadFor(UUID channelListingId) {
        Selection selection = select(channelListingId);
        return payload(selection);
    }

    /**
     * Sends ONE same-value update and reports only what is safe to print.
     *
     * @return report lines carrying outcome, provider code and envelope shape — never a value.
     */
    public List<String> probe(UUID channelListingId) {
        Selection selection = select(channelListingId);

        /* 🔴 FAIL CLOSED — no credential, no call. The provider is never asked to reject us. */
        String accessToken;
        try {
            accessToken = tokens.accessTokenFor(selection.channelInstanceId());
        } catch (RuntimeException e) {
            throw new ProbeRefusedException(
                    "Refused: no usable Daraz credential for this shop (" + e.getClass().getSimpleName() + ").");
        }

        String payload = payload(selection);

        /*
          🔴 `DZC-034.c` — THE XML TRAVELS AS AN ORDINARY SIGNED PARAMETER, NOT AS THE HTTP BODY.
          It is placed in the parameter map so the signer folds its exact string into the canonical
          string. ⚠ Re-serialising or re-indenting it after this point breaks the signature.
        */
        Map<String, String> params = new LinkedHashMap<>();
        params.put("app_key", properties.require().appKey());
        params.put("timestamp", Long.toString(Instant.now().toEpochMilli()));
        params.put("sign_method", DarazRequestSigner.SIGN_METHOD);
        params.put("access_token", accessToken);
        params.put(PAYLOAD_PARAMETER, payload);

        String signature = signer.sign(PRICE_QUANTITY_PATH, params, null, properties.require().appSecret());

        /* ⚠ The signed parameters are form-encoded into the POST body; the URI carries no secret. */
        StringBuilder form = new StringBuilder();
        params.forEach((name, value) -> {
            if (form.length() > 0) {
                form.append('&');
            }
            form.append(encode(name)).append('=').append(encode(value));
        });
        form.append('&').append(DarazRequestSigner.SIGNATURE_PARAMETER).append('=').append(encode(signature));

        URI uri = URI.create(BANGLADESH_REST_BASE + PRICE_QUANTITY_PATH);

        String body;
        try {
            body = transport.post(uri, form.toString(), FORM_CONTENT_TYPE);
        } catch (RuntimeException e) {
            /* 🔴 The transport's own message is safe by construction; its class name is enough. */
            return List.of(
                    "outcome        : TRANSPORT FAILED (" + e.getClass().getSimpleName() + ")",
                    "note           : nothing was written in Trioloo. Whether Daraz applied the"
                            + " same-value update is UNKNOWN — re-read the listing to settle it.");
        }
        return describe(body);
    }

    /**
     * Everything the probe needs, or a refusal naming what is missing.
     *
     * <p>🔴 EVERY CHECK HERE FAILS CLOSED. A probe that guessed past a missing fact would sign a
     * write for a shop, a channel or a SKU nobody chose.
     */
    private Selection select(UUID channelListingId) {
        if (channelListingId == null) {
            throw new ProbeRefusedException("A channel listing id is required.");
        }
        ChannelListingEntity listing = listings.findById(channelListingId)
                .orElseThrow(() -> new ProbeRefusedException("Refused: no Listing with that id."));

        ChannelInstanceEntity channel = channels.findById(listing.getChannelInstanceId())
                .orElseThrow(() -> new ProbeRefusedException("Refused: the Listing's shop is not registered."));

        /* 🔴 FAIL CLOSED — signing a Daraz write for a shop that is not on Daraz is a call nobody asked for. */
        if (!"DARAZ".equalsIgnoreCase(channel.getChannelType())) {
            throw new ProbeRefusedException(
                    "Refused: this Listing is on " + channel.getChannelType() + ", not Daraz.");
        }

        /* 🔴 FAIL CLOSED — an unconnected shop has nothing to write on behalf of. */
        ConnectionState state = connections.findByChannelInstanceIdIn(List.of(channel.getId()))
                .stream().map(c -> c.getState()).findFirst().orElse(null);
        if (state != ConnectionState.CONNECTED) {
            throw new ProbeRefusedException(
                    "Refused: this shop is not connected (" + (state == null ? "no connection record" : state)
                            + "). Authorise it before probing.");
        }

        /* 🔴 `DZC-037` — ItemId is the product join key and Trioloo stores it as the external id. */
        String itemId = listing.getExternalListingId();
        if (itemId == null || itemId.isBlank()) {
            throw new ProbeRefusedException(
                    "Refused: this Listing has no marketplace identity, so there is nothing to address.");
        }

        List<ChannelListingSkuEntity> found = skus.findByChannelListingIdOrderByPositionAsc(channelListingId);
        if (found.size() != 1) {
            /*
              ⚠ ONE SKU ONLY, DELIBERATELY. A variation listing would make the probe choose which
              unit to write, and a probe must never make a business choice on an operator's behalf.
            */
            throw new ProbeRefusedException(
                    "Refused: this probe writes one orderable SKU and this Listing has " + found.size() + ".");
        }
        ChannelListingSkuEntity sku = found.getFirst();

        if (sku.getChannelSku() == null || sku.getChannelSku().isBlank()) {
            throw new ProbeRefusedException("Refused: this SKU has no SellerSku, so it cannot be addressed.");
        }

        /*
          🔴 THE SAME-VALUE GUARANTEE LIVES HERE. Both figures must be present AND readable, because
          the probe sends back exactly what the channel last reported. ⚠ An unreadable figure would
          leave the probe inventing one, which is precisely the change it must never make.
        */
        BigDecimal price = sku.getReportedSalePrice();
        if (price == null || !sku.isReportedSalePriceReadable()) {
            throw new ProbeRefusedException(
                    "Refused: no readable marketplace price is stored, so no same-value price can be sent.");
        }
        BigDecimal stock = sku.getReportedStock();
        if (stock == null || !sku.isReportedStockReadable()) {
            throw new ProbeRefusedException(
                    "Refused: no readable marketplace stock is stored, so no same-value quantity can be sent.");
        }

        return new Selection(channel.getId(), itemId, sku.getChannelSku(), price, stock);
    }

    /**
     * The {@code DZC-035} payload, carrying price and quantity and NOTHING else.
     *
     * <p>🔴 NO {@code SalePrice}, NO {@code SaleStartDate}, NO {@code SaleEndDate}. A promotion
     * cannot be read back, so it cannot be verified, so this probe does not touch it.
     *
     * <p>⚠ {@code <Quantity>} IS SENT IN ITS PLAIN FORM ON PURPOSE — settling whether Daraz accepts
     * it without a {@code WarehouseCode} is one of the three questions this probe exists to answer
     * ({@code DZC-039.b}). A refusal here is a RESULT, not a failure.
     */
    private String payload(Selection s) {
        return "<Request><Product><Skus><Sku>"
                + "<ItemId>" + xml(s.itemId()) + "</ItemId>"
                + "<SellerSku>" + xml(s.sellerSku()) + "</SellerSku>"
                + "<Price>" + s.price().toPlainString() + "</Price>"
                + "<Quantity>" + s.stock().toPlainString() + "</Quantity>"
                + "</Sku></Skus></Product></Request>";
    }

    /**
     * Turns the response into report lines that carry no listing value.
     *
     * <p>⚠ Every line below is an outcome, a provider code, a request id or a field NAME. Nothing
     * here can render a price, a quantity, a SellerSku, an item id or a token.
     */
    private List<String> describe(String body) {
        List<String> out = new ArrayList<>();
        JsonNode root;
        try {
            root = json.readTree(body == null ? "" : body);
        } catch (Exception e) {
            out.add("outcome        : UNREADABLE RESPONSE (" + e.getClass().getSimpleName() + ")");
            out.add("note           : the provider replied with something that is not JSON.");
            return out;
        }

        /* 🔴 `DZC-010` — `code` is a STRING and "0" is the only success. */
        String code = text(root, "code");
        String type = text(root, "type");
        String requestId = text(root, "request_id");

        boolean accepted = "0".equals(code);
        out.add("outcome        : " + (accepted ? "ACCEPTED by Daraz" : "REFUSED by Daraz"));
        out.add("provider code  : " + (code == null ? "(absent)" : code));
        out.add("provider type  : " + (type == null ? "(absent)" : type));
        out.add("request id     : " + (requestId == null ? "(absent)" : requestId));

        /*
          ⚠ THE PROVIDER'S OWN MESSAGE IS NOT PRINTED. It can echo a SellerSku or a price back, and
          this probe promises to print no listing value. Its PRESENCE is reported instead.
        */
        out.add("message present: " + (root.hasNonNull("message") && !root.get("message").asText().isBlank()));
        out.add("envelope fields: " + names(root));
        out.add("data node type : " + (root.has("data") ? root.get("data").getNodeType().toString() : "(absent)"));
        out.add("detail present : " + (root.has("detail") || root.has("errors")));

        if (accepted) {
            out.add("answers        : SellerSku addressed the SKU and a plain <Quantity> was accepted"
                    + " (`DZC-039.b`, `DZC-039.e`).");
        } else {
            out.add("answers        : the refusal code above is the answer — record it against"
                    + " `DZC-038.d` and do not retry blind.");
        }
        out.add("trioloo writes : NONE. No listing, product or inventory row was touched.");
        return out;
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

    /** ⚠ The payload is signed verbatim, so an unescaped value would break the signature AND the XML. */
    private static String xml(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    /** What the probe resolved, so {@link #probe} never re-reads and never re-decides. */
    private record Selection(UUID channelInstanceId,
                             String itemId,
                             String sellerSku,
                             BigDecimal price,
                             BigDecimal stock) {
    }
}
