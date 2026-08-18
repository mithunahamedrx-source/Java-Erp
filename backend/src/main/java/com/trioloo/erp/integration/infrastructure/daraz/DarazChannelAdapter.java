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
            fields.put(key, new ChannelCapabilityDeclaration.FieldCapability(readable(key), false));
        }
        return new ChannelCapabilityDeclaration(fields);
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

    @Override
    public OutboundResult pushUpdate(UUID channelInstanceId, OutboundListingPayload payload) {
        throw outboundUnavailable("Sending updates to Daraz");
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
