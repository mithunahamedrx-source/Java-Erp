package com.trioloo.erp.integration.infrastructure.daraz;

import com.trioloo.erp.product.application.channel.ChannelCapabilityDeclaration;
import com.trioloo.erp.product.application.channel.DiscoveryPage;
import com.trioloo.erp.product.application.channel.ReportedListingSnapshot;
import com.trioloo.erp.product.application.channel.ReportedSkuSnapshot;
import com.trioloo.erp.product.domain.ListingFieldKey;
import com.trioloo.erp.product.domain.ListingStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import org.junit.jupiter.api.Nested;
import com.trioloo.erp.product.application.channel.OutboundListingPayload;
import com.trioloo.erp.product.application.channel.OutboundResult;
import com.trioloo.erp.product.domain.OperationOutcome;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The production Daraz listing adapter — {@code DZC-020}–{@code DZC-029}.
 *
 * <p>🔴 NO MARKETPLACE IS CONTACTED. The transport is a controlled double and the token provider is
 * a stub, so the whole read surface — signing parameters, paging, mapping, refusals — is proven
 * without a seller account, a real App Secret or a single live request.
 */
class DarazChannelAdapterTest {

    private static final String KEY = "000000-test-app-key";
    private static final String SECRET = "test-app-secret-not-a-real-value";
    private static final UUID SHOP = UUID.fromString("bbbbbbbb-0000-0000-0000-000000000001");

    private final AtomicReference<URI> captured = new AtomicReference<>();
    private final AtomicInteger transportCalls = new AtomicInteger();
    private final AtomicInteger tokenCalls = new AtomicInteger();
    private final List<String> order = new java.util.ArrayList<>();

    private String response = "";
    /* ✅ The write path's captures. No marketplace is contacted by any of it. */
    private final AtomicInteger postCalls = new AtomicInteger();
    private final AtomicReference<URI> postUri = new AtomicReference<>();
    private final AtomicReference<String> postBody = new AtomicReference<>();
    private String postResponse = "";

    private String sentBody() {
        return postBody.get() == null ? "" : postBody.get();
    }
    private RuntimeException tokenFailure;

    /** 🔴 A stub token provider that RECORDS when it was asked, so ordering can be proven. */
    private DarazAccessTokenProvider tokens() {
        return new DarazAccessTokenProvider(
                new DarazProperties(KEY, SECRET, "https://example.test/cb"),
                new DarazRequestSigner(),
                uriOnly(),
                null, java.time.Clock.systemUTC(), java.time.Duration.ofHours(24)) {
            @Override
            public String accessTokenFor(UUID channelInstanceId) {
                tokenCalls.incrementAndGet();
                order.add("token");
                if (tokenFailure != null) {
                    throw tokenFailure;
                }
                return "test-access-token";
            }
        };
    }

    private DarazTransport uriOnly() {
        return new DarazTransport() {
            @Override
            public String get(URI uri) {
                transportCalls.incrementAndGet();
                order.add("transport");
                captured.set(uri);
                return response;
            }

            @Override
            public String post(URI uri, String body, String contentType) {
                /* ✅ `PRD-205` — the write path. Captured, never forwarded anywhere. */
                postCalls.incrementAndGet();
                order.add("transport");
                postUri.set(uri);
                postBody.set(body);
                return postResponse;
            }
        };
    }

    private DarazChannelAdapter adapter() {
        return new DarazChannelAdapter(
                new DarazProperties(KEY, SECRET, "https://example.test/cb"),
                new DarazRequestSigner(), uriOnly(), tokens());
    }

    private static Map<String, String> query(URI uri) {
        Map<String, String> params = new HashMap<>();
        String raw = uri.getRawQuery();
        if (raw == null) {
            return params;
        }
        for (String pair : raw.split("&")) {
            int eq = pair.indexOf('=');
            params.put(URLDecoder.decode(pair.substring(0, eq), StandardCharsets.UTF_8),
                    URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8));
        }
        return params;
    }

    private static String json(String singleQuoted) {
        return singleQuoted.replace('\'', '"');
    }

    /** One product, one SKU — the unambiguous case. */
    private static String oneProduct() {
        return json("{'code':'0','request_id':'r-1','data':{'total_products':'1','products':[{"
                + "'item_id':'180226526','primary_category':'10000211','status':'Active',"
                + "'updated_time':'1611554725000','created_time':'1611554725000',"
                + "'images':['https://img.test/a.jpg','https://img.test/b.jpg'],"
                + "'attributes':{'name':'Hi-Power 22 Inch IPS Monitor','description':'<p>Crisp</p>',"
                + "'brand':'Zeon','short_description':'Crisp panel'},"
                + "'skus':[{'SkuId':314525867,'SellerSku':'ZT-MON-22','ShopSku':'BU565-1104491',"
                + "'Status':'active','quantity':7,'price':10900,'special_price':9900,"
                + "'special_from_time':'2015-07-3100:00','special_to_time':'2020-02-0300:00'}]}]}}");
    }

    // ================================================================ identity + capability

    @Test
    @DisplayName("the adapter declares DARAZ")
    void declaresDaraz() {
        assertThat(adapter().channelType()).isEqualTo("DARAZ");
    }

    @Test
    @DisplayName("capability declares exactly the fields DZC-026 maps, and nothing writable")
    void capabilityIsHonest() {
        ChannelCapabilityDeclaration declaration = adapter().declareCapability(SHOP);

        for (String key : List.of(ListingFieldKey.TITLE, ListingFieldKey.DESCRIPTION,
                ListingFieldKey.SALE_PRICE, ListingFieldKey.PROMOTION_PRICE,
                ListingFieldKey.LISTING_STOCK, ListingFieldKey.MEDIA,
                ListingFieldKey.CHANNEL_CATEGORY, ListingFieldKey.ATTRIBUTES,
                ListingFieldKey.ORDERABLE_SKUS)) {
            assertThat(declaration.forField(key).readable()).as("%s readable", key).isTrue();
        }

        /* 🔴 The window's format is NOT PUBLISHED (`DZC-024.c`) — a deliberate under-claim. */
        assertThat(declaration.forField(ListingFieldKey.PROMOTION_WINDOW).readable()).isFalse();
        /* ⚠ Publication intent is ERP-owned and never channel-read. */
        assertThat(declaration.forField(ListingFieldKey.PUBLICATION_INTENT).readable()).isFalse();

        /*
          ✅ `PRD-205.a` — SALE PRICE AND LISTING STOCK ARE WRITABLE, AND NOTHING ELSE IS. They are
          the only fields Trioloo both writes and reads back, so a push can be VERIFIED (`PRD-186`).
        */
        assertThat(declaration.forField(ListingFieldKey.SALE_PRICE).writable()).isTrue();
        assertThat(declaration.forField(ListingFieldKey.LISTING_STOCK).writable()).isTrue();

        /* 🔴 EVERY OTHER FIELD STAYS LOCAL-ONLY, each blocked by a named reason. */
        ListingFieldKey.all().stream()
                .filter(key -> !ListingFieldKey.SALE_PRICE.equals(key)
                        && !ListingFieldKey.LISTING_STOCK.equals(key))
                .forEach(key ->
                        assertThat(declaration.forField(key).writable()).as("%s writable", key).isFalse());
    }

    // ================================================================ the request

    @Test
    @DisplayName("🔴 the token is obtained BEFORE the channel is called")
    void tokenComesFirst() {
        response = oneProduct();
        adapter().discoverActive(SHOP, null);

        assertThat(order).containsExactly("token", "transport");
        assertThat(tokenCalls.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("🔴 a refused token means no call at all")
    void refusedTokenSendsNothing() {
        tokenFailure = DarazCredentialException.reauthorisationRequired("expired");

        assertThatThrownBy(() -> adapter().discoverActive(SHOP, null))
                .isInstanceOf(DarazCredentialException.class);
        assertThat(transportCalls.get()).isZero();
    }

    @Test
    @DisplayName("discovery asks for live listings, 50 at a time, signed")
    void requestIsCorrect() {
        response = oneProduct();
        adapter().discoverActive(SHOP, null);

        Map<String, String> params = query(captured.get());
        assertThat(captured.get().toString())
                .startsWith("https://api.daraz.com.bd/rest/products/get");
        assertThat(params).containsEntry("filter", "live");
        assertThat(Integer.parseInt(params.get("limit"))).isLessThanOrEqualTo(50);
        assertThat(params).containsEntry("sign_method", "sha256");
        assertThat(params).containsEntry("access_token", "test-access-token");
        assertThat(params).containsKey("sign");
        /* 🔴 The App Secret is never a parameter — only the signature derived from it. */
        assertThat(captured.get().toString()).doesNotContain(SECRET);
        /* 🔴 DZC-022.b — offset is deprecated and capped; it is not the paging mechanism. */
        assertThat(params).doesNotContainKey("offset");
        /* The first page carries no scroll position. */
        assertThat(params).doesNotContainKey("update_after");
    }

    @Test
    @DisplayName("a cursor becomes update_after on the next page")
    void cursorScrollsByDate() {
        response = oneProduct();
        adapter().discoverActive(SHOP, "2026-01-25T09:25:25Z");

        assertThat(query(captured.get())).containsEntry("update_after", "2026-01-25T09:25:25Z");
        /* 🔴 No bare '+' reaches the wire, where a server would read it as a space. */
        assertThat(captured.get().getRawQuery()).doesNotContain("+");
    }

    @Test
    @DisplayName("no live Daraz host is ever contacted by these tests")
    void nothingLeavesTheProcess() {
        response = oneProduct();
        adapter().discoverActive(SHOP, null);
        /* The URI is built and captured; the transport double returns a canned string. */
        assertThat(transportCalls.get()).isEqualTo(1);
        assertThat(captured.get().getHost()).isEqualTo("api.daraz.com.bd");
    }

    // ================================================================ mapping, DZC-026

    @Test
    @DisplayName("a one-SKU product maps every documented field")
    void mapsOneSkuProduct() {
        response = oneProduct();
        ReportedListingSnapshot listing = adapter().discoverActive(SHOP, null).listings().getFirst();

        assertThat(listing.externalListingId()).isEqualTo("180226526");
        assertThat(listing.title()).isEqualTo("Hi-Power 22 Inch IPS Monitor");
        assertThat(listing.titleReadable()).isTrue();
        assertThat(listing.description()).isEqualTo("<p>Crisp</p>");
        assertThat(listing.descriptionReadable()).isTrue();
        assertThat(listing.channelCategory()).isEqualTo("10000211");
        assertThat(listing.listingStatus()).isEqualTo(ListingStatus.ACTIVE);
        assertThat(listing.mediaReferences()).containsExactly("https://img.test/a.jpg", "https://img.test/b.jpg");
        assertThat(listing.attributes()).containsEntry("brand", "Zeon");

        /* A single SKU makes the listing-level value unambiguous. */
        assertThat(listing.salePrice()).isEqualByComparingTo(new BigDecimal("10900"));
        assertThat(listing.salePriceReadable()).isTrue();
        assertThat(listing.promotionPrice()).isEqualByComparingTo(new BigDecimal("9900"));
        assertThat(listing.stock()).isEqualByComparingTo(new BigDecimal("7"));
    }

    @Test
    @DisplayName("🔴 the SKU code is SellerSku — never ShopSku or SkuId")
    void skuCodeIsSellerSku() {
        response = oneProduct();
        ReportedSkuSnapshot sku = adapter().discoverActive(SHOP, null)
                .listings().getFirst().skus().getFirst();

        assertThat(sku.channelSku()).isEqualTo("ZT-MON-22");
        assertThat(sku.channelSku()).isNotEqualTo("BU565-1104491");
        assertThat(sku.channelSku()).isNotEqualTo("314525867");
        assertThat(sku.salePrice()).isEqualByComparingTo(new BigDecimal("10900"));
        assertThat(sku.stock()).isEqualByComparingTo(new BigDecimal("7"));
    }

    @Test
    @DisplayName("🔴 a multi-SKU product invents no listing-level price")
    void multiSkuLeavesListingPriceUnreadable() {
        response = json("{'code':'0','data':{'products':[{'item_id':'9','attributes':{'name':'Tee'},"
                + "'skus':[{'SellerSku':'TEE-S','price':500,'quantity':3},"
                + "{'SellerSku':'TEE-L','price':700,'quantity':4}]}]}}");

        ReportedListingSnapshot listing = adapter().discoverActive(SHOP, null).listings().getFirst();

        /* 🔴 No published rule says which SKU speaks for the listing. */
        assertThat(listing.salePriceReadable()).isFalse();
        assertThat(listing.salePrice()).isNull();
        assertThat(listing.stockReadable()).isFalse();
        /* ✅ The real numbers stay where the provider put them. */
        assertThat(listing.skus()).hasSize(2);
        assertThat(listing.skus().get(0).salePrice()).isEqualByComparingTo(new BigDecimal("500"));
        assertThat(listing.skus().get(1).salePrice()).isEqualByComparingTo(new BigDecimal("700"));
    }

    /** ⚠ Two SKUs that happen to agree today are still two prices. */
    @Test
    @DisplayName("even SKUs sharing one price do not become a listing-level price")
    void agreeingSkusAreStillAmbiguous() {
        response = json("{'code':'0','data':{'products':[{'item_id':'9','attributes':{'name':'Tee'},"
                + "'skus':[{'SellerSku':'A','price':500},{'SellerSku':'B','price':500}]}]}}");

        assertThat(adapter().discoverActive(SHOP, null).listings().getFirst().salePriceReadable())
                .isFalse();
    }

    @Test
    @DisplayName("absent and unpublished fields report readable=false, never zero")
    void absentFieldsAreUnreadable() {
        response = json("{'code':'0','data':{'products':[{'item_id':'9','skus':[{'SellerSku':'X'}]}]}}");
        ReportedListingSnapshot listing = adapter().discoverActive(SHOP, null).listings().getFirst();

        assertThat(listing.titleReadable()).isFalse();
        assertThat(listing.descriptionReadable()).isFalse();
        assertThat(listing.salePriceReadable()).isFalse();
        assertThat(listing.stockReadable()).isFalse();
        assertThat(listing.channelCategoryReadable()).isFalse();
        /* 🔴 Nothing became 0. */
        assertThat(listing.salePrice()).isNull();
        assertThat(listing.stock()).isNull();
        /* 🔴 DZC-024.c — the promotion window is never claimed. */
        assertThat(listing.promotionWindowReadable()).isFalse();
        assertThat(listing.skus().getFirst().promotionWindowReadable()).isFalse();
        /* 🔴 DZC-026 — variationLabel is NOT PUBLISHED. */
        assertThat(listing.skus().getFirst().variationLabel()).isNull();
    }

    @Test
    @DisplayName("an unrecognised status changes nothing rather than guessing")
    void unknownStatusIsNull() {
        response = json("{'code':'0','data':{'products':[{'item_id':'9','status':'Pending QC',"
                + "'attributes':{'name':'T'},'skus':[{'SellerSku':'X'}]}]}}");
        assertThat(adapter().discoverActive(SHOP, null).listings().getFirst().listingStatus()).isNull();
    }

    @Test
    @DisplayName("images arriving as a string containing an array are still read")
    void imagesTolerateBothShapes() {
        response = json("{'code':'0','data':{'products':[{'item_id':'9','attributes':{'name':'T'},"
                + "'marketImages':'[ \\'https://img.test/x.jpg\\', \\'https://img.test/y.jpg\\' ]',"
                + "'skus':[{'SellerSku':'X'}]}]}}");
        ReportedListingSnapshot listing = adapter().discoverActive(SHOP, null).listings().getFirst();

        assertThat(listing.mediaReferences())
                .containsExactly("https://img.test/x.jpg", "https://img.test/y.jpg");
        /* ⚠ Order is not claimed reliable: the shape is ambiguous (`DZC-024.b`). */
        assertThat(listing.mediaOrderReliable()).isFalse();
    }

    @Test
    @DisplayName("🔴 nothing that has no home in the core is mapped into it")
    void unmappableFieldsAreDropped() {
        response = json("{'code':'0','data':{'products':[{'item_id':'9','attributes':{'name':'T'},"
                + "'rejectReason':[{'violationDetail':'Wrong Image'}],'hiddenReason':'IOS',"
                + "'suspendedSkus':[],'trialProduct':'false','subStatus':'Lock',"
                + "'skus':[{'SellerSku':'X'}]}]}}");
        ReportedListingSnapshot listing = adapter().discoverActive(SHOP, null).listings().getFirst();

        /* `DZC-027.e` — real published fields with no E-106/E-107 home. */
        assertThat(listing.attributes()).doesNotContainKeys(
                "rejectReason", "violationDetail", "hiddenReason", "suspendedSkus", "trialProduct");
    }

    // ================================================================ paging

    @Test
    @DisplayName("a short page ends the run, complete")
    void shortPageCompletes() {
        response = oneProduct();
        DiscoveryPage page = adapter().discoverActive(SHOP, null);

        assertThat(page.listings()).hasSize(1);
        assertThat(page.complete()).isTrue();
        assertThat(page.hasMore()).isFalse();
        assertThat(page.nextCursor()).isNull();
    }

    @Test
    @DisplayName("a full page yields a date cursor for the next one")
    void fullPageYieldsCursor() {
        response = fullPage(1611554725000L, 1611554999000L);
        DiscoveryPage page = adapter().discoverActive(SHOP, null);

        assertThat(page.listings()).hasSize(50);
        assertThat(page.complete()).isTrue();
        assertThat(page.hasMore()).isTrue();
        /* The NEWEST update time seen, formatted for update_after. */
        assertThat(page.nextCursor()).isEqualTo("2021-01-25T06:09:59Z");
    }

    /** 🔴 `API-066.b` — a run that cannot advance must report itself incomplete, not complete. */
    @Test
    @DisplayName("a full page that cannot scroll reports itself incomplete")
    void unscrollablePageIsIncomplete() {
        long same = 1611554725000L;
        response = fullPage(same, same);
        String cursor = "2021-01-25T06:05:25Z";

        DiscoveryPage page = adapter().discoverActive(SHOP, cursor);

        assertThat(page.complete()).isFalse();
        assertThat(page.hasMore()).isFalse();
        assertThat(page.incompleteReason()).contains("could not scroll past");
        /* ⚠ PRD-177 — the reason states plainly that nothing was changed. */
        assertThat(page.incompleteReason()).contains("Nothing has been changed");
    }

    @Test
    @DisplayName("a full page with no update time reports itself incomplete")
    void fullPageWithoutTimeIsIncomplete() {
        StringBuilder products = new StringBuilder();
        for (int i = 0; i < 50; i++) {
            products.append(i == 0 ? "" : ",")
                    .append("{'item_id':'").append(i).append("','attributes':{'name':'T'},")
                    .append("'skus':[{'SellerSku':'S").append(i).append("'}]}");
        }
        response = json("{'code':'0','data':{'products':[" + products + "]}}");

        DiscoveryPage page = adapter().discoverActive(SHOP, null);
        assertThat(page.complete()).isFalse();
        assertThat(page.incompleteReason()).contains("no update time");
    }

    private static String fullPage(long firstMillis, long lastMillis) {
        StringBuilder products = new StringBuilder();
        for (int i = 0; i < 50; i++) {
            long millis = i == 49 ? lastMillis : firstMillis;
            products.append(i == 0 ? "" : ",")
                    .append("{'item_id':'").append(i).append("','updated_time':'").append(millis)
                    .append("','attributes':{'name':'T'},'skus':[{'SellerSku':'S").append(i).append("'}]}");
        }
        return json("{'code':'0','data':{'products':[" + products + "]}}");
    }

    // ================================================================ refusals

    @Test
    @DisplayName("an envelope code refuses safely, including the 901 throttle")
    void envelopeCodeRefuses() {
        response = json("{'code':'901','type':'ISP','message':'echoed provider text','request_id':'r-9'}");

        assertThatThrownBy(() -> adapter().discoverActive(SHOP, null))
                .isInstanceOf(DarazProtocolException.class)
                .satisfies(e -> {
                    DarazProtocolException p = (DarazProtocolException) e;
                    assertThat(p.reason()).isEqualTo(DarazProtocolException.Reason.ENVELOPE_CODE);
                    assertThat(p.providerCode()).isEqualTo("901");
                    assertThat(p.requestId()).isEqualTo("r-9");
                    /* 🔴 A throttle is never a credential verdict. */
                    assertThat(p).isNotInstanceOf(DarazCredentialException.class);
                });
    }

    @Test
    @DisplayName("empty, non-JSON, non-object and data-less responses each refuse safely")
    void unusableResponsesRefuse() {
        for (String body : new String[]{"", "   ", "not json", "[1,2,3]", json("{'code':'0'}")}) {
            response = body;
            assertThatThrownBy(() -> adapter().discoverActive(SHOP, null))
                    .as("body %s", body)
                    .isInstanceOf(DarazProtocolException.class);
        }
    }

    @Test
    @DisplayName("🔴 no refusal carries a token, the secret, the signature or provider text")
    void refusalsLeakNothing() {
        response = json("{'code':'IllegalAccessToken','type':'ISV','message':'echoed provider text',"
                + "'access_token':'leaked-token'}");

        String message;
        try {
            adapter().discoverActive(SHOP, null);
            throw new AssertionError("expected a refusal");
        } catch (DarazProtocolException e) {
            message = String.valueOf(e.getMessage()) + e.describeContainers() + e.topLevelFields();
        }
        for (String secret : new String[]{
                "test-access-token", "leaked-token", SECRET, "echoed provider text",
                "api.daraz.com.bd", "sign=", KEY}) {
            assertThat(message).as("must not contain %s", secret).doesNotContain(secret);
        }
    }

    // ================================================================ deferred + outbound

    @Test
    @DisplayName("🔴 readListing refuses rather than claiming the channel returned nothing")
    void readListingIsDeferred() {
        assertThatThrownBy(() -> adapter().readListing(SHOP, "180226526"))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessageContaining("not available yet")
                .hasMessageContaining("was not sent");
        assertThat(transportCalls.get()).isZero();
    }

    @Test
    @DisplayName("🔴 create and withdraw still refuse and contact nothing")
    void outboundRefuses() {
        DarazChannelAdapter adapter = adapter();

        /*
          ⚠ `pushUpdate` NO LONGER APPEARS HERE. `PRD-205` ratified price and stock, so it is
          implemented and tested below; create and withdraw remain unratified and unimplemented.
        */
        assertThatThrownBy(() -> adapter.publishCreate(SHOP, null))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessageContaining("was not sent");
        assertThatThrownBy(() -> adapter.withdraw(SHOP, "180226526"))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessageContaining("was not sent");

        /* 🔴 No token was even requested, let alone a request sent. */
        assertThat(transportCalls.get()).isZero();
        assertThat(tokenCalls.get()).isZero();
    }

    // ================================= bounded attributes, after the first live pull failed

    /** Builds an attributes object with a value of an exact length. */
    private static String withAttribute(String key, int length) {
        return json("{'code':'0','data':{'products':[{'item_id':'9','attributes':{"
                + "'name':'Monitor','" + key + "':'" + "x".repeat(length) + "'},"
                + "'skus':[{'SellerSku':'X'}]}]}}");
    }

    private Map<String, String> attributesOf(String body) {
        response = body;
        return adapter().discoverActive(SHOP, null).listings().getFirst().attributes();
    }

    /**
     * 🔴 THE DEFECT THE FIRST LIVE PULL FOUND. `attributes.description` is already
     * `reported_description`, an unbounded `text` column. Copying it into the generic attribute
     * table, whose `reported_value` is `varchar(1024)`, overflowed on the first real product and
     * rolled the entire discovery back.
     */
    @Test
    @DisplayName("🔴 description is not duplicated into the generic attributes")
    void descriptionIsNotDuplicated() {
        response = oneProduct();
        ReportedListingSnapshot listing = adapter().discoverActive(SHOP, null).listings().getFirst();

        assertThat(listing.attributes()).doesNotContainKey("description");
        /* ✅ It is still reported — on the column that can hold it. */
        assertThat(listing.description()).isEqualTo("<p>Crisp</p>");
        assertThat(listing.descriptionReadable()).isTrue();
    }

    @Test
    @DisplayName("🔴 name is not duplicated into the generic attributes")
    void nameIsNotDuplicated() {
        response = oneProduct();
        ReportedListingSnapshot listing = adapter().discoverActive(SHOP, null).listings().getFirst();

        assertThat(listing.attributes()).doesNotContainKey("name");
        assertThat(listing.title()).isEqualTo("Hi-Power 22 Inch IPS Monitor");
        assertThat(listing.titleReadable()).isTrue();
    }

    @Test
    @DisplayName("attributes without a dedicated home are still mapped normally")
    void ordinaryAttributesStillMap() {
        response = oneProduct();
        Map<String, String> attributes =
                adapter().discoverActive(SHOP, null).listings().getFirst().attributes();

        assertThat(attributes).containsEntry("brand", "Zeon");
        assertThat(attributes).containsEntry("short_description", "Crisp panel");
    }

    @Test
    @DisplayName("a value of exactly the persistence limit stays readable")
    void exactlyAtTheLimitIsReadable() {
        Map<String, String> attributes = attributesOf(withAttribute("warranty", 1024));
        assertThat(attributes).containsKey("warranty");
        assertThat(attributes.get("warranty")).hasSize(1024);
    }

    /**
     * 🔴 ONE CHARACTER OVER IS UNREADABLE, NOT TRUNCATED. A truncated REPORTED value would
     * misstate what the channel said, and `PRD-181` compares intent against reported — so the
     * listing would read DIVERGED forever on a difference Trioloo invented.
     */
    @Test
    @DisplayName("🔴 one character over the limit is reported unreadable, never truncated")
    void oneOverTheLimitIsUnreadable() {
        Map<String, String> attributes = attributesOf(withAttribute("warranty", 1025));

        /* ✅ The key survives, so the attribute is known to EXIST. */
        assertThat(attributes).containsKey("warranty");
        /* 🔴 With no value — which the persistence layer records as readable=false. */
        assertThat(attributes.get("warranty")).isNull();
    }

    @Test
    @DisplayName("a very long value is not shortened to fit")
    void longValueIsNotShortened() {
        Map<String, String> attributes = attributesOf(withAttribute("warranty", 50_000));
        assertThat(attributes.get("warranty")).isNull();
        assertThat(attributes).containsKey("warranty");
    }

    /** ⚠ A key that will not fit is the attribute's IDENTITY; a truncated one would collide. */
    @Test
    @DisplayName("an attribute whose KEY cannot be stored is dropped entirely")
    void overlongKeyIsDropped() {
        String key = "k".repeat(161);
        Map<String, String> attributes = attributesOf(withAttribute(key, 10));
        assertThat(attributes).doesNotContainKey(key);
    }

    // ================================= PRD-205 — the first push-supported slice

    /**
     * The Daraz write path, price and stock only.
     *
     * <p>🔴 NO MARKETPLACE IS CONTACTED. The transport is a double, so every claim below — what goes
     * on the wire, what does not, and how a refusal is classified — is proven without a live call.
     */
    @Nested
    @DisplayName("PRD-205 — pushUpdate for sale price and listing stock")
    class PushUpdate {

        private static final String ACCEPTED =
                "{\"code\":\"0\",\"request_id\":\"r-1\",\"_trace_id_\":\"t-1\"}";

        /** ✅ Price alone travels as `<Price>`, and no `<Quantity>` appears. */
        @Test
        @DisplayName("sends Price when only the sale price changed")
        void sendsPriceOnly() {
            postResponse = ACCEPTED;
            OutboundResult result = adapter().pushUpdate(SHOP, payload(new BigDecimal("49800.00"), null));

            assertThat(result.outcome()).isEqualTo(OperationOutcome.SUCCEEDED);
            assertThat(sentBody()).contains("%3CPrice%3E49800.00%3C%2FPrice%3E");
            assertThat(sentBody()).doesNotContain("Quantity");
            assertThat(postCalls.get()).isEqualTo(1);
        }

        /** ✅ Stock alone travels as the PLAIN `<Quantity>` the live probe proved accepted. */
        @Test
        @DisplayName("sends a plain Quantity when only the stock changed")
        void sendsQuantityOnly() {
            postResponse = ACCEPTED;
            OutboundResult result = adapter().pushUpdate(SHOP, payload(null, new BigDecimal("118")));

            assertThat(result.outcome()).isEqualTo(OperationOutcome.SUCCEEDED);
            assertThat(sentBody()).contains("%3CQuantity%3E118%3C%2FQuantity%3E");
            assertThat(sentBody()).doesNotContain("Price%3E");
            /* 🔴 `DZC-042.b` — no warehouse form. */
            assertThat(sentBody()).doesNotContain("WarehouseCode");
            assertThat(sentBody()).doesNotContain("MultiWarehouse");
        }

        /** ✅ Both changed, both sent, in one request. */
        @Test
        @DisplayName("sends both when both changed")
        void sendsBoth() {
            postResponse = ACCEPTED;
            OutboundResult result =
                    adapter().pushUpdate(SHOP, payload(new BigDecimal("49800.00"), new BigDecimal("118")));

            assertThat(result.outcome()).isEqualTo(OperationOutcome.SUCCEEDED);
            assertThat(sentBody()).contains("%3CPrice%3E");
            assertThat(sentBody()).contains("%3CQuantity%3E");
            assertThat(postCalls.get()).isEqualTo(1);
        }

        /**
         * 🔴 `PRD-205.d` — PROMOTION IS NEVER SENT, though the same endpoint carries it, and neither
         * is any content field. The payload names four elements and no others.
         */
        @Test
        @DisplayName("omits promotion, content, media and category entirely")
        void omitsEverythingElse() {
            postResponse = ACCEPTED;
            adapter().pushUpdate(SHOP, payload(new BigDecimal("49800.00"), new BigDecimal("118")));

            String body = sentBody();
            for (String forbidden : new String[]{
                    "SalePrice", "SaleStartDate", "SaleEndDate", "MultiWarehouse",
                    "Attributes", "short_description", "PrimaryCategory", "Images"}) {
                assertThat(body).as("%s must not be sent", forbidden).doesNotContain(forbidden);
            }
            /* ✅ The endpoint is the documented one. */
            assertThat(postUri.get().toString())
                    .isEqualTo("https://api.daraz.com.bd/rest/product/price_quantity/update");
        }

        /**
         * 🔴 `DZC-042.c` — A WRITE SUCCESS CARRIES NO `data`. The read path's envelope check demands
         * one; sharing it here would turn this success into a malformed response.
         */
        @Test
        @DisplayName("accepts code 0 with no data node at all")
        void acceptsSuccessWithoutData() {
            postResponse = "{\"code\":\"0\",\"request_id\":\"r-2\"}";
            OutboundResult result = adapter().pushUpdate(SHOP, payload(new BigDecimal("1.00"), null));

            assertThat(result.outcome()).isEqualTo(OperationOutcome.SUCCEEDED);
            assertThat(result.detail()).contains("accepted");
        }

        /** ✅ `DZC-042.d` — an unknown top-level field is tolerated, not rejected. */
        @Test
        @DisplayName("tolerates the undocumented _trace_id_ field")
        void toleratesUnknownFields() {
            postResponse = "{\"code\":\"0\",\"request_id\":\"r-3\",\"_trace_id_\":\"t\",\"extra\":1}";
            assertThat(adapter().pushUpdate(SHOP, payload(null, new BigDecimal("5"))).outcome())
                    .isEqualTo(OperationOutcome.SUCCEEDED);
        }

        /** ✅ A provider refusal is a FAILURE of the change, reported with its code. */
        @Test
        @DisplayName("classifies a provider refusal as failed")
        void classifiesRefusal() {
            postResponse = "{\"code\":\"4104\",\"type\":\"ISV\",\"request_id\":\"r-4\","
                    + "\"message\":\"BIZ_CHECK_PRICE_PRECISION_INVALID ELT020 49800.00\"}";
            OutboundResult result = adapter().pushUpdate(SHOP, payload(new BigDecimal("49800.001"), null));

            assertThat(result.outcome()).isEqualTo(OperationOutcome.FAILED);
            assertThat(result.detail()).contains("4104");
            /* 🔴 The provider message can echo a Seller SKU or a price. Neither reaches the record. */
            assertThat(result.detail()).doesNotContain("ELT020");
            assertThat(result.detail()).doesNotContain("49800.00");
        }

        /**
         * 🔴 `DZC-038.e` — `901` IS THROTTLING, AND THROTTLING IS NOT A VERDICT. It must never be
         * recorded as "the change was refused".
         */
        @Test
        @DisplayName("classifies 901 as needing another attempt, not as a refusal")
        void classifiesThrottling() {
            postResponse = "{\"code\":\"901\",\"request_id\":\"r-5\"}";
            OutboundResult result = adapter().pushUpdate(SHOP, payload(new BigDecimal("1.00"), null));

            assertThat(result.outcome()).isEqualTo(OperationOutcome.MANUAL_REQUIRED);
            assertThat(result.detail()).contains("was not applied and was not refused");
            assertThat(result.detail()).contains("again");
        }

        /** ⚠ A payload with nothing sendable is a caller mistake, not an empty success. */
        @Test
        @DisplayName("refuses a change with nothing push-supported in it")
        void refusesNothingToSend() {
            OutboundResult result = adapter().pushUpdate(SHOP, payload(null, null));

            assertThat(result.outcome()).isEqualTo(OperationOutcome.MANUAL_REQUIRED);
            assertThat(result.detail()).contains("Sale Price and Listing stock are the only");
            /* 🔴 Nothing was signed, sent, or even tokenised. */
            assertThat(postCalls.get()).isZero();
            assertThat(tokenCalls.get()).isZero();
        }

        /** ⚠ A variation listing would make the adapter choose which unit to write. It refuses. */
        @Test
        @DisplayName("refuses a listing with more than one orderable SKU")
        void refusesVariation() {
            OutboundListingPayload two = new OutboundListingPayload(
                    UUID.randomUUID(), "338562593", null, null, null, null, null, null,
                    null, null, null, null,
                    List.of(sku(new BigDecimal("1.00"), null), sku(new BigDecimal("2.00"), null)), null);

            OutboundResult result = adapter().pushUpdate(SHOP, two);
            assertThat(result.outcome()).isEqualTo(OperationOutcome.MANUAL_REQUIRED);
            assertThat(postCalls.get()).isZero();
        }

        /** 🔴 No marketplace identity means nothing to address. */
        @Test
        @DisplayName("refuses a listing with no marketplace identity")
        void refusesWithoutIdentity() {
            OutboundListingPayload none = new OutboundListingPayload(
                    UUID.randomUUID(), null, null, null, null, null, null, null,
                    null, null, null, null, List.of(sku(new BigDecimal("1.00"), null)), null);

            assertThatThrownBy(() -> adapter().pushUpdate(SHOP, none))
                    .isInstanceOf(UnsupportedOperationException.class);
            assertThat(postCalls.get()).isZero();
        }

        /** 🔴 The XML is a SIGNED PARAMETER (`DZC-034.c`), so the body carries payload and sign. */
        @Test
        @DisplayName("signs the payload as a request parameter")
        void signsThePayload() {
            postResponse = ACCEPTED;
            adapter().pushUpdate(SHOP, payload(new BigDecimal("1.00"), null));

            assertThat(sentBody()).contains("payload=");
            assertThat(sentBody()).contains("sign=");
            assertThat(sentBody()).contains("sign_method=sha256");
        }

        private OutboundListingPayload payload(BigDecimal price, BigDecimal stock) {
            return new OutboundListingPayload(
                    UUID.randomUUID(), "338562593", null, null, null, null, null, null,
                    null, null, null, null, List.of(sku(price, stock)), null);
        }

        private OutboundListingPayload.OutboundSku sku(BigDecimal price, BigDecimal stock) {
            return new OutboundListingPayload.OutboundSku("ELT020", price, null, null, null, stock);
        }
    }
}