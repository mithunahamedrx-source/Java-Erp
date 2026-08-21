package com.trioloo.erp.integration.infrastructure.daraz;

import com.trioloo.erp.product.application.channel.ChannelAdapterPort;
import com.trioloo.erp.product.application.channel.ChannelCapabilityDeclaration;
import com.trioloo.erp.product.application.channel.DiscoveryPage;
import com.trioloo.erp.product.application.channel.OutboundListingPayload;
import com.trioloo.erp.product.application.channel.OutboundResult;
import com.trioloo.erp.product.application.channel.ReportedListingSnapshot;
import com.trioloo.erp.product.domain.ListingFieldKey;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.net.URI;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * The production Daraz listing adapter — the READ half, {@code DZC-020}–{@code DZC-029}.
 *
 * <p>🔴 IT ONLY EXISTS WHERE DARAZ IS CONFIGURED. An adapter with no App Key would resolve in the
 * registry, claim capability, and then fail on every call — which reads to an operator as a broken
 * integration rather than an absent one. {@link ChannelAdapterRegistry#noAdapterDetail} is the
 * honest message in that case, and it only appears while no bean is registered, so the bean is
 * conditional on the credentials it needs.
 *
 * <p>🔴 EVERY CALL TAKES A FRESH, VALID TOKEN FIRST ({@code DZC-030.c}). {@link
 * DarazAccessTokenProvider} refuses rather than hands back a token believed dead, and this adapter
 * asks it before it builds a request — so a listing API is never called on an expired credential.
 *
 * <p>🔴 THE OUTBOUND HALF IS NOT IMPLEMENTED AND SAYS SO. {@code pushUpdate}, {@code publishCreate}
 * and {@code withdraw} refuse loudly and contact nothing. ⚠ An adapter that quietly returned a
 * successful-looking {@link OutboundResult} would tell an operator their price reached Daraz.
 *
 * <p>🔴 NOTHING HERE LOGS. No token, signature, request URI, body or provider response text is
 * written anywhere; failures carry {@code DarazProtocolException}'s safe classification, which is
 * names and types only.
 */
@Component
@ConditionalOnProperty(prefix = "integration.daraz", name = {"app-key", "app-secret"})
public class DarazChannelAdapter implements ChannelAdapterPort {

    /** {@code E-016}'s channel type. */
    public static final String CHANNEL_TYPE = "DARAZ";

    /** {@code DZC-020} — the listing enumeration, a GET. */
    /**
     * The provenance of a push result is THE CHANNEL, because the outcome is the channel's own
     * verdict on the request rather than Trioloo's opinion of it.
     */
    private static final String PROVENANCE_ADAPTER = "CHANNEL";

    /** The write path. Signed verbatim, so it is written once and never built. */
    private static final String PRICE_QUANTITY_PATH = "/product/price_quantity/update";

    static final String PRODUCTS_GET_PATH = "/products/get";

    /** {@code DZC-028} — active listings only in this gate. */
    static final String LIVE_FILTER = "live";

    /** {@code DZC-022} — the documented maximum. */
    static final int PAGE_SIZE = 50;

    /**
     * ISO 8601 in UTC, written with the {@code Z} designator rather than a numeric offset.
     *
     * <p>🔴 THE {@code Z} FORM IS CHOSEN TO REMOVE A TRANSMISSION HAZARD, NOT FOR TASTE. The
     * documented sample writes the offset numerically ({@code +0800}), and a literal {@code +} in a
     * query value is decoded as a SPACE by many servers. The signature is computed over the raw
     * value ({@code DZC-008}) while the provider would verify it against the corrupted one, so the
     * call fails with a signature error that looks like a signing defect and is not one.
     *
     * <p>⚠ {@code Z} IS VALID ISO 8601 AND CANNOT BE MISREAD, but the reference does not publish
     * which spellings the parameter accepts. If a live diagnostic later shows {@code Z} is
     * rejected, the fix is percent-encoding the offset form — never sending a bare {@code +}.
     */
    private static final DateTimeFormatter SCROLL_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'").withZone(ZoneOffset.UTC);

    private final DarazProperties properties;
    private final DarazRequestSigner signer;
    private final DarazTransport transport;
    private final DarazAccessTokenProvider tokens;
    private final ObjectMapper json = new ObjectMapper();

    public DarazChannelAdapter(DarazProperties properties,
                               DarazRequestSigner signer,
                               DarazTransport transport,
                               DarazAccessTokenProvider tokens) {
        this.properties = properties;
        this.signer = signer;
        this.transport = transport;
        this.tokens = tokens;
    }

    @Override
    public String channelType() {
        return CHANNEL_TYPE;
    }

    /**
     * What this adapter can actually do today — {@code API-063}, {@code PRD-125}.
     *
     * <p>🔴 NOTHING IS WRITABLE, BECAUSE NOTHING IS WRITTEN. Declaring a field writable while
     * {@code pushUpdate} refuses would offer the operator a control that cannot work.
     *
     * <p>🔴 {@code PROMOTION_WINDOW} IS NOT READABLE, AND THAT IS A DELIBERATE UNDER-CLAIM.
     * {@code DZC-024.c} records that the promotion date format is NOT PUBLISHED — the official
     * sample shows {@code "2015-07-3100:00"} — so the window cannot be parsed reliably and this
     * adapter does not promise it. ⚠ {@code PUBLICATION_INTENT} is ERP-owned and never channel-read.
     *
     * <p>⚠ THE DECLARATION IS THE SAME FOR EVERY INSTANCE, AND THE SIGNATURE STILL TAKES ONE.
     * {@code PRD-125} exists because two shops on one marketplace MAY differ; discovering that
     * needs asking each shop, which no documented API offers. Declaring uniformly is what can be
     * stated honestly, and the per-instance shape keeps the door open.
     */
    @Override
    public ChannelCapabilityDeclaration declareCapability(UUID channelInstanceId) {
        Map<String, ChannelCapabilityDeclaration.FieldCapability> fields = new LinkedHashMap<>();
        for (String key : ListingFieldKey.all()) {
            fields.put(key, new ChannelCapabilityDeclaration.FieldCapability(readable(key), writable(key)));
        }
        return new ChannelCapabilityDeclaration(fields);
    }

    /**
     * ✅ {@code PRD-205.a} — SALE PRICE AND LISTING STOCK, AND NOTHING ELSE.
     *
     * <p>🔴 THE SLICE IS TWO FIELDS BECAUSE A PUSH MUST BE VERIFIABLE ({@code PRD-186}). These are
     * the only fields Trioloo both WRITES and READS BACK, so a later pull can confirm what the
     * marketplace actually did. ⚠ A field that cannot be read back cannot be verified.
     *
     * <p>🔴 EVERY OTHER FIELD IS LOCAL-ONLY AND STAYS FALSE, each blocked by a named reason —
     * {@code DZC-039.a} for content, {@code DZC-039.c} for attributes, {@code DZC-039.d} for media,
     * {@code DZC-037.b} for publication state. ⚠ Not by preference.
     */
    private static boolean writable(String key) {
        return ListingFieldKey.SALE_PRICE.equals(key)
                || ListingFieldKey.LISTING_STOCK.equals(key);
    }

    /** ✅ Exactly the fields {@code DZC-026} maps from a documented source. */
    private static boolean readable(String key) {
        return ListingFieldKey.TITLE.equals(key)
                || ListingFieldKey.DESCRIPTION.equals(key)
                || ListingFieldKey.SALE_PRICE.equals(key)
                || ListingFieldKey.PROMOTION_PRICE.equals(key)
                || ListingFieldKey.LISTING_STOCK.equals(key)
                || ListingFieldKey.MEDIA.equals(key)
                || ListingFieldKey.CHANNEL_CATEGORY.equals(key)
                || ListingFieldKey.ATTRIBUTES.equals(key)
                || ListingFieldKey.ORDERABLE_SKUS.equals(key);
    }

    /**
     * Enumerates the channel's live listings, one page at a time — {@code DZC-028}.
     *
     * <p>🔴 DATE SCROLLING, NOT OFFSET. {@code offset} is documented as DEPRECATED and capped at
     * 10000 ({@code DZC-022.b}), so a seller past that count could not be paged by it at all. The
     * cursor carries the newest {@code updated_time} seen and the next page asks for
     * {@code update_after} it.
     *
     * <p>🔴 A RUN THAT CANNOT FINISH SAYS SO ({@code API-066.b}, {@code PRD-177}). Absence is never
     * deletion, and the caller only treats a page as the end of the catalogue when this says the
     * run completed.
     */
    @Override
    public DiscoveryPage discoverActive(UUID channelInstanceId, String cursor) {
        /* 🔴 DZC-030 — a usable token first, or no call at all. */
        String accessToken = tokens.accessTokenFor(channelInstanceId);

        Map<String, String> params = new LinkedHashMap<>();
        params.put("app_key", properties.require().appKey());
        params.put("timestamp", Long.toString(Instant.now().toEpochMilli()));   // DZC-009
        params.put("sign_method", DarazRequestSigner.SIGN_METHOD);
        params.put("access_token", accessToken);
        params.put("filter", LIVE_FILTER);
        params.put("limit", Integer.toString(PAGE_SIZE));
        if (cursor != null && !cursor.isBlank()) {
            params.put("update_after", cursor);
        }

        String signature = signer.sign(PRODUCTS_GET_PATH, params, null, properties.require().appSecret());

        UriComponentsBuilder uri = UriComponentsBuilder
                .fromUriString(DarazAuthorisationAdapter.BANGLADESH_REST_BASE + PRODUCTS_GET_PATH);
        params.forEach(uri::queryParam);
        uri.queryParam(DarazRequestSigner.SIGNATURE_PARAMETER, signature);

        JsonNode body = parse(transport.get(uri.build().encode().toUri()));
        JsonNode data = requireEnvelope(body);

        JsonNode products = data.get("products");
        List<ReportedListingSnapshot> listings = new ArrayList<>();
        Instant newest = null;
        if (products != null && products.isArray()) {
            for (JsonNode product : products) {
                if (product == null || !product.isObject()) {
                    continue;
                }
                listings.add(DarazListingMapper.toSnapshot(product));
                Instant updated = epochMillis(product.get("updated_time"));
                if (updated != null && (newest == null || updated.isAfter(newest))) {
                    newest = updated;
                }
            }
        }

        /* A short page is the end of the catalogue: there is nothing further to scroll to. */
        if (listings.size() < PAGE_SIZE) {
            return new DiscoveryPage(listings, null, true, null);
        }

        if (newest == null) {
            /*
              ⚠ A FULL PAGE WE CANNOT SCROLL PAST. `updated_time` is NOT PUBLISHED as a guaranteed
              field (`DZC-024.c`), and without it there is no next cursor. Reporting the run
              COMPLETE here would silently present a partial catalogue as the whole one.
            */
            return new DiscoveryPage(listings, null, false,
                    "The channel returned a full page carrying no update time, so the remaining "
                            + "listings could not be reached. Nothing has been changed for listings "
                            + "this run did not return.");
        }

        String next = SCROLL_FORMAT.format(newest);
        if (next.equals(cursor)) {
            /*
              🔴 THE PAGE DID NOT ADVANCE. Every listing on it shares one update time, so asking for
              the same instant again would return the same page forever. Stopping and saying so is
              the only honest option; looping would hang a discovery run.
            */
            return new DiscoveryPage(listings, null, false,
                    "More listings share one update time than a single page can carry, so the "
                            + "run could not scroll past them. Nothing has been changed for "
                            + "listings this run did not return.");
        }
        return new DiscoveryPage(listings, next, true, null);
    }

    /**
     * 🔴 DEFERRED, AND DELIBERATELY NOT FAKED — {@code DZC-021.c}, {@code DZC-029}.
     *
     * <p>{@code /product/item/get} is the documented single read and takes {@code item_id}. It is a
     * POST, and the transport can now POST — but the reference does NOT publish which content type
     * the endpoint expects, and this gate forbids the live call that would settle it. Shipping a
     * guessed header into the production adapter is exactly the invention {@code DZC-024} refuses.
     *
     * <p>⚠ IT REFUSES RATHER THAN RETURNING EMPTY. An empty result means "the channel did not
     * return this listing", and the caller reports precisely that to the operator
     * ({@code PRD-177}). Saying it here would be false: nothing was asked.
     */
    @Override
    public Optional<ReportedListingSnapshot> readListing(UUID channelInstanceId, String externalListingId) {
        throw new UnsupportedOperationException(
                "Reading one Daraz listing on its own is not available yet, and the request was "
                        + "not sent. Discovery reads this channel's live listings instead.");
    }

    /**
     * Sends SALE PRICE and LISTING STOCK, and nothing else ({@code PRD-205.a}).
     *
     * <p>🔴 THE SLICE IS DELIBERATE AND NARROW. Both fields go through the one documented endpoint
     * ({@code DZC-035}) and both are addressable with {@code ItemId} + {@code SellerSku}, which the
     * live probe proved sufficient ({@code DZC-042.a}) — no {@code SkuId}, no schema change.
     *
     * <p>🔴 PROMOTION IS NEVER SENT, though the same endpoint carries it ({@code PRD-205.d}): the
     * window cannot be read back, so a promotion push could not be verified.
     *
     * <p>🔴 A FIELD ABSENT FROM THE PAYLOAD IS NOT SENT. Only what the caller actually changed goes
     * on the wire — sending a value nobody edited would overwrite the marketplace with a figure the
     * operator never chose.
     *
     * <p>⚠ IT REFUSES RATHER THAN SENDING NOTHING. A payload carrying no push-supported change is a
     * caller mistake, and an empty write would report success for an act that never happened.
     */
    @Override
    public OutboundResult pushUpdate(UUID channelInstanceId, OutboundListingPayload payload) {
        if (payload == null || payload.externalListingId() == null || payload.externalListingId().isBlank()) {
            throw outboundUnavailable("Sending updates for a Listing with no marketplace identity");
        }

        /*
          🔴 THE ORDERABLE UNIT CARRIES THE FIGURES (`PRD-190.b`). One SKU only: a variation listing
          would make the adapter choose which unit to write, which is a business choice.
        */
        List<OutboundListingPayload.OutboundSku> skus = payload.skus() == null ? List.of() : payload.skus();
        if (skus.size() != 1) {
            return OutboundResult.manualRequired(
                    "This Listing has " + skus.size() + " orderable SKUs. Daraz price and stock are sent per"
                            + " SKU, and choosing which one is not the adapter's decision.",
                    PROVENANCE_ADAPTER);
        }
        OutboundListingPayload.OutboundSku sku = skus.getFirst();
        if (sku.channelSku() == null || sku.channelSku().isBlank()) {
            return OutboundResult.manualRequired(
                    "This SKU has no Seller SKU, so Daraz cannot be told which unit to change.",
                    PROVENANCE_ADAPTER);
        }

        BigDecimal price = sku.salePrice();
        BigDecimal quantity = sku.listingStock();
        if (price == null && quantity == null) {
            return OutboundResult.manualRequired(
                    "Nothing in this change can be sent to Daraz. Sale Price and Listing stock are the only"
                            + " fields this channel accepts today; everything else stays local.",
                    PROVENANCE_ADAPTER);
        }

        StringBuilder xml = new StringBuilder("<Request><Product><Skus><Sku>");
        xml.append("<ItemId>").append(xmlText(payload.externalListingId())).append("</ItemId>");
        xml.append("<SellerSku>").append(xmlText(sku.channelSku())).append("</SellerSku>");
        if (price != null) {
            xml.append("<Price>").append(price.toPlainString()).append("</Price>");
        }
        if (quantity != null) {
            /* ✅ `DZC-042.b` — the plain form, which the live probe proved accepted. */
            xml.append("<Quantity>").append(quantity.toPlainString()).append("</Quantity>");
        }
        xml.append("</Sku></Skus></Product></Request>");

        String accessToken = tokens.accessTokenFor(channelInstanceId);

        /*
          🔴 `DZC-034.c` — THE XML IS A SIGNED PARAMETER, NOT THE HTTP BODY. Its exact string is
          folded into the canonical string, so it must not be re-serialised after signing.
        */
        Map<String, String> params = new LinkedHashMap<>();
        params.put("app_key", properties.require().appKey());
        params.put("timestamp", Long.toString(Instant.now().toEpochMilli()));
        params.put("sign_method", DarazRequestSigner.SIGN_METHOD);
        params.put("access_token", accessToken);
        params.put("payload", xml.toString());

        String signature = signer.sign(PRICE_QUANTITY_PATH, params, null, properties.require().appSecret());

        StringBuilder form = new StringBuilder();
        params.forEach((name, value) -> {
            if (form.length() > 0) {
                form.append('&');
            }
            form.append(urlEncode(name)).append('=').append(urlEncode(value));
        });
        form.append('&').append(DarazRequestSigner.SIGNATURE_PARAMETER).append('=').append(urlEncode(signature));

        String body = transport.post(
                URI.create(DarazAuthorisationAdapter.BANGLADESH_REST_BASE + PRICE_QUANTITY_PATH),
                form.toString(),
                "application/x-www-form-urlencoded");

        return classifyWrite(body, price != null, quantity != null);
    }

    /**
     * Turns the provider's envelope into an outcome, WITHOUT requiring a {@code data} node.
     *
     * <p>🔴 {@code DZC-042.c} — A WRITE SUCCESS CARRIES NO {@code data}. The live account returned
     * exactly {@code code}, {@code request_id} and {@code _trace_id_}. ⚠ THIS IS WHY THE WRITE PATH
     * DOES NOT SHARE {@link #requireEnvelope}: that reader demands {@code data} — correctly, for a
     * read — and would treat this success as a malformed response.
     *
     * <p>🔴 UNKNOWN TOP-LEVEL FIELDS ARE TOLERATED, NOT REJECTED ({@code DZC-042.d}).
     *
     * <p>🔴 NO VALUE AND NO PROVIDER MESSAGE REACHES THE DETAIL. The message can echo a Seller SKU
     * or a price back, and an operation record is read by people who need neither.
     */
    private OutboundResult classifyWrite(String body, boolean sentPrice, boolean sentQuantity) {
        JsonNode root;
        try {
            root = json.readTree(body == null ? "" : body);
        } catch (RuntimeException e) {
            return OutboundResult.failed(
                    "Daraz replied with something that is not a readable response. Nothing can be concluded"
                            + " about whether the change was applied; re-read the Listing to settle it.",
                    PROVENANCE_ADAPTER);
        }

        String code = text(root, "code");
        String requestId = text(root, "request_id");
        String providerType = text(root, "type");

        /* ✅ `DZC-042.c` — `0` is success whether or not `data` is present. */
        if ("0".equals(code)) {
            StringBuilder what = new StringBuilder();
            if (sentPrice) {
                what.append("Sale Price");
            }
            if (sentQuantity) {
                what.append(what.length() > 0 ? " and Listing stock" : "Listing stock");
            }
            return OutboundResult.succeeded(
                    what + " sent to Daraz and accepted."
                            + (requestId == null ? "" : " Provider reference " + requestId + "."),
                    PROVENANCE_ADAPTER);
        }

        /*
          🔴 `DZC-038.d`/`.e` — `901` IS THROTTLING, AND THROTTLING IS NOT A VERDICT. It says the
          request was not processed, never that the change was refused, so it is reported as needing
          another attempt rather than as a failure of the change itself.
        */
        if ("901".equals(code)) {
            return OutboundResult.manualRequired(
                    "Daraz declined to process the request because calls are arriving too quickly. The change"
                            + " was not applied and was not refused; send it again shortly."
                            + (requestId == null ? "" : " Provider reference " + requestId + "."),
                    PROVENANCE_ADAPTER);
        }

        return OutboundResult.failed(
                "Daraz refused the change" + (code == null ? "" : " with code " + code)
                        + (providerType == null ? "" : " (" + providerType + ")") + "."
                        + (requestId == null ? "" : " Provider reference " + requestId + "."),
                PROVENANCE_ADAPTER);
    }

    @Override
    public OutboundResult publishCreate(UUID channelInstanceId, OutboundListingPayload payload) {
        throw outboundUnavailable("Publishing a new Listing to Daraz");
    }

    @Override
    public OutboundResult withdraw(UUID channelInstanceId, String externalListingId) {
        throw outboundUnavailable("Withdrawing a Listing from Daraz");
    }

    /**
     * 🔴 IT THROWS RATHER THAN RETURNING A FAILED {@link OutboundResult}. A returned result is the
     * shape of an ATTEMPT, and this is not one — nothing was signed, sent or received. The caller
     * settles a thrown failure onto that member alone, which is the accurate record.
     */
    private static UnsupportedOperationException outboundUnavailable(String what) {
        return new UnsupportedOperationException(
                what + " is not available yet, and the request was not sent. This adapter reads "
                        + "from the channel; it does not write to it.");
    }

    /** ⚠ The payload is signed verbatim, so an unescaped value breaks the signature AND the XML. */
    private static String xmlText(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static String urlEncode(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
    }

    // ================================================================= safe parsing

    /** ⚠ Daraz reports application failures inside an HTTP 200 ({@code DZC-023.a}). */
    private JsonNode requireEnvelope(JsonNode body) {
        String requestId = text(body, "request_id");
        String providerType = text(body, "type");
        DarazResponseShape shape = new DarazResponseShape(topLevelFieldNames(body), Map.of());

        JsonNode code = body.get("code");
        if (code != null && !code.asText("").isEmpty() && !"0".equals(code.asText())) {
            /* 🔴 DZC-025 — including `901`, the per-second throttle, which is an ERROR and says
               nothing whatever about the credential. */
            throw new DarazProtocolException(DarazProtocolException.Reason.ENVELOPE_CODE,
                    null, code.asText(), providerType, requestId, shape);
        }
        JsonNode data = body.get("data");
        if (data == null || !data.isObject()) {
            throw new DarazProtocolException(DarazProtocolException.Reason.MISSING_FIELD,
                    "data", null, providerType, requestId, shape);
        }
        return data;
    }

    /** ⚠ {@code DZC-024.c} — epoch-millisecond strings. Anything else is simply not a time. */
    private static Instant epochMillis(JsonNode node) {
        if (node == null) {
            return null;
        }
        try {
            return Instant.ofEpochMilli(Long.parseLong(node.asText("").trim()));
        } catch (RuntimeException e) {
            return null;
        }
    }

    private JsonNode parse(String body) {
        if (body == null || body.isBlank()) {
            throw new DarazProtocolException(DarazProtocolException.Reason.EMPTY_RESPONSE);
        }
        try {
            JsonNode parsed = json.readTree(body);
            if (parsed == null || !parsed.isObject()) {
                throw new DarazProtocolException(DarazProtocolException.Reason.MALFORMED_RESPONSE);
            }
            return parsed;
        } catch (DarazProtocolException e) {
            throw e;
        } catch (Exception e) {
            /* 🔴 Not chained and the body is not quoted: it may carry seller data. */
            throw new DarazProtocolException(DarazProtocolException.Reason.NON_JSON);
        }
    }

    private static List<String> topLevelFieldNames(JsonNode body) {
        List<String> names = new ArrayList<>();
        if (body != null && body.isObject()) {
            body.properties().forEach(entry -> names.add(entry.getKey()));
        }
        return names;
    }

    private static String text(JsonNode body, String field) {
        JsonNode value = body == null ? null : body.get(field);
        return value == null || value.asText("").isBlank() ? null : value.asText();
    }
}
