package com.trioloo.erp.integration.application;

import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.integration.infrastructure.daraz.DarazAccessTokenProvider;
import com.trioloo.erp.integration.infrastructure.daraz.DarazCredentialException;
import com.trioloo.erp.integration.infrastructure.daraz.DarazProperties;
import com.trioloo.erp.integration.infrastructure.daraz.DarazRequestSigner;
import com.trioloo.erp.integration.infrastructure.daraz.DarazTransport;
import com.trioloo.erp.integration.infrastructure.daraz.DarazTransportException;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionEntity;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionRepository;
import com.trioloo.erp.integration.infrastructure.diagnostic.DarazListingShapeRunner;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The one-off Daraz listing shape probe.
 *
 * <p>🔴 NO MARKETPLACE IS CONTACTED. The transport is a double and the token provider is a stub,
 * so the probe's guarantees — one request, nothing written, no value reported — are proven without
 * spending a seller's quota.
 *
 * <p>🔴 THE CENTRAL CLAIM IS A NEGATIVE ONE, so it is tested as one: the report is checked against
 * every value the fixture contains, and the listing tables are counted before and after.
 */
@SpringBootTest
class DarazListingShapeDiagnosticTest {

    /* Values the probe must NEVER echo. Each appears in the fixture below. */
    private static final String SECRET = "test-app-secret-not-a-real-value";
    private static final String TOKEN = "50000-secret-access-token";
    private static final String ITEM_ID = "180226526";
    private static final String SELLER_SKU = "ZT-MON-22-SECRET";
    private static final String SHOP_SKU = "BU565-1104491";
    private static final String TITLE = "Hi-Power 22 Inch IPS Monitor";
    private static final String IMAGE = "https://img.test/secret-a.jpg";
    private static final String PRICE = "10900";
    private static final String STOCK = "7";

    @Autowired ChannelInstanceRepository channels;
    @Autowired ChannelConnectionRepository connections;
    @Autowired JdbcTemplate jdbc;

    private UUID shop;
    private final AtomicInteger transportCalls = new AtomicInteger();
    private final AtomicInteger tokenCalls = new AtomicInteger();
    private final AtomicReference<URI> captured = new AtomicReference<>();
    private String response = "";
    private RuntimeException transportFailure;
    private RuntimeException tokenFailure;

    @BeforeEach
    void setUp() {
        clean();
        shop = insertShop("DIAG-TEST-A", "Diagnostic Test A", "DARAZ");
        connect(shop, ConnectionState.CONNECTED);
        transportCalls.set(0);
        tokenCalls.set(0);
        captured.set(null);
        transportFailure = null;
        tokenFailure = null;
        response = fixture();
    }

    @AfterEach
    void tearDown() {
        clean();
    }

    private void clean() {
        jdbc.update("DELETE FROM channel_connection WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'DIAG-TEST-%')");
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'DIAG-TEST-%'");
    }

    private UUID insertShop(String code, String name, String type) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO channel_instance (id, code, name, channel_type, record_status, market) "
                + "VALUES (?, ?, ?, ?, 'ACTIVE', 'BANGLADESH')", id, code, name, type);
        return id;
    }

    private void connect(UUID id, ConnectionState state) {
        connections.save(ChannelConnectionEntity.observed(id, state, Instant.now()));
    }

    private DarazListingShapeDiagnostic diagnostic() {
        DarazTransport transport = new DarazTransport() {
            @Override
            public String get(URI uri) {
                transportCalls.incrementAndGet();
                captured.set(uri);
                if (transportFailure != null) {
                    throw transportFailure;
                }
                return response;
            }

            @Override
            public String post(URI uri, String body, String contentType) {
                throw new UnsupportedOperationException("The probe is a GET.");
            }
        };
        DarazAccessTokenProvider tokens = new DarazAccessTokenProvider(
                new DarazProperties("000000-key", SECRET, "https://example.test/cb"),
                new DarazRequestSigner(), transport, null,
                java.time.Clock.systemUTC(), java.time.Duration.ofHours(24)) {
            @Override
            public String accessTokenFor(UUID channelInstanceId) {
                tokenCalls.incrementAndGet();
                if (tokenFailure != null) {
                    throw tokenFailure;
                }
                return TOKEN;
            }
        };
        return new DarazListingShapeDiagnostic(
                new DarazProperties("000000-key", SECRET, "https://example.test/cb"),
                new DarazRequestSigner(), transport, tokens, channels, connections);
    }

    private static String json(String singleQuoted) {
        return singleQuoted.replace('\'', '"');
    }

    /** A realistic response carrying every value the probe must not echo. */
    private static String fixture() {
        return json("{'code':'0','request_id':'r-1','data':{'total_products':'12','products':[{"
                + "'item_id':'" + ITEM_ID + "','primary_category':'10000211','status':'Active',"
                + "'updated_time':'1611554725000','created_time':'1611554725000',"
                + "'images':['" + IMAGE + "'],"
                + "'attributes':{'name':'" + TITLE + "','description':'<p>Crisp</p>','brand':'Zeon'},"
                + "'skus':[{'SkuId':314525867,'SellerSku':'" + SELLER_SKU + "','ShopSku':'" + SHOP_SKU + "',"
                + "'quantity':" + STOCK + ",'price':" + PRICE + ",'special_price':9900}]}]}}");
    }

    private String report() {
        return String.join("\n", diagnostic().probe(shop));
    }

    // ================================================================ one call, via the provider

    @Test
    @DisplayName("the probe calls the channel exactly once")
    void callsOnce() {
        report();
        assertThat(transportCalls.get()).isEqualTo(1);
    }

    @Test
    @DisplayName("the probe obtains its token through DarazAccessTokenProvider")
    void usesTokenProvider() {
        report();
        assertThat(tokenCalls.get()).isEqualTo(1);
        assertThat(query("access_token")).isEqualTo(TOKEN);
    }

    @Test
    @DisplayName("the request asks for one live listing, signed")
    void requestIsMinimal() {
        report();
        assertThat(captured.get().toString()).startsWith("https://api.daraz.com.bd/rest/products/get");
        assertThat(query("filter")).isEqualTo("live");
        assertThat(query("limit")).isEqualTo("1");
        assertThat(captured.get().toString()).contains("sign=");
        /* 🔴 It does not page, so it carries no cursor. */
        assertThat(captured.get().getRawQuery()).doesNotContain("update_after");
    }

    private String query(String name) {
        for (String pair : captured.get().getRawQuery().split("&")) {
            int eq = pair.indexOf('=');
            if (java.net.URLDecoder.decode(pair.substring(0, eq), java.nio.charset.StandardCharsets.UTF_8)
                    .equals(name)) {
                return java.net.URLDecoder.decode(pair.substring(eq + 1),
                        java.nio.charset.StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    // ================================================================ fails closed

    @Test
    @DisplayName("🔴 a non-Daraz shop is refused before any call")
    void refusesNonDaraz() {
        UUID website = insertShop("DIAG-TEST-B", "Website", "WEBSITE");
        connect(website, ConnectionState.CONNECTED);

        assertThatThrownBy(() -> diagnostic().probe(website))
                .isInstanceOf(DarazListingShapeDiagnostic.DiagnosticRefusedException.class)
                .hasMessageContaining("not Daraz");
        assertThat(transportCalls.get()).isZero();
        assertThat(tokenCalls.get()).isZero();
    }

    @Test
    @DisplayName("🔴 a shop that is not connected is refused before any call")
    void refusesNotConnected() {
        UUID other = insertShop("DIAG-TEST-C", "Draft shop", "DARAZ");
        connect(other, ConnectionState.NOT_CONNECTED);

        assertThatThrownBy(() -> diagnostic().probe(other))
                .isInstanceOf(DarazListingShapeDiagnostic.DiagnosticRefusedException.class)
                .hasMessageContaining("not connected");
        assertThat(transportCalls.get()).isZero();
    }

    @Test
    @DisplayName("🔴 a shop with no connection record at all is refused")
    void refusesNoConnectionRecord() {
        UUID bare = insertShop("DIAG-TEST-D", "Bare shop", "DARAZ");

        assertThatThrownBy(() -> diagnostic().probe(bare))
                .isInstanceOf(DarazListingShapeDiagnostic.DiagnosticRefusedException.class)
                .hasMessageContaining("no connection record");
        assertThat(transportCalls.get()).isZero();
    }

    @Test
    @DisplayName("🔴 an unusable credential is refused before any call")
    void refusesWithoutCredential() {
        tokenFailure = DarazCredentialException.reauthorisationRequired("no credential");

        assertThatThrownBy(() -> diagnostic().probe(shop))
                .isInstanceOf(DarazListingShapeDiagnostic.DiagnosticRefusedException.class)
                .hasMessageContaining("no usable Daraz credential");
        assertThat(transportCalls.get()).isZero();
    }

    @Test
    @DisplayName("an unknown shop id is refused")
    void refusesUnknownShop() {
        assertThatThrownBy(() -> diagnostic().probe(UUID.randomUUID()))
                .isInstanceOf(DarazListingShapeDiagnostic.DiagnosticRefusedException.class)
                .hasMessageContaining("no registered shop");
        assertThat(transportCalls.get()).isZero();
    }

    // ================================================================ what it reports

    @Test
    @DisplayName("the report names fields, types and counts")
    void reportsShape() {
        String out = report();

        assertThat(out).contains("top-level      : [code, request_id, data]");
        assertThat(out).contains("envelope code  : 0");
        assertThat(out).contains("data fields    : [total_products, products]");
        assertThat(out).contains("total_products : 12  (count only)");
        assertThat(out).contains("products node  : ARRAY  size=1");
        assertThat(out).contains("item_id");           // a NAME
        assertThat(out).contains("sku fields     : [SkuId, SellerSku, ShopSku, quantity, price, special_price]");
        assertThat(out).contains("attributes     : OBJECT  [name, description, brand]");
    }

    /** 🔴 THE SCROLLING QUESTION the probe exists to settle. */
    @Test
    @DisplayName("the report says whether updated_time is present, without its value")
    void reportsScrollFieldPresence() {
        String out = report();
        assertThat(out).contains("updated_time   : PRESENT");
        assertThat(out).contains("created_time: PRESENT");
        /* 🔴 The epoch value never appears. */
        assertThat(out).doesNotContain("1611554725000");
    }

    @Test
    @DisplayName("🔴 NOT ONE PROVIDER VALUE APPEARS IN THE REPORT")
    void reportsNoValues() {
        String out = report();

        for (String value : List.of(TOKEN, SECRET, ITEM_ID, SELLER_SKU, SHOP_SKU, TITLE, IMAGE,
                PRICE, STOCK, "9900", "10000211", "<p>Crisp</p>", "Zeon", "1611554725000")) {
            assertThat(out).as("must not echo %s", value).doesNotContain(value);
        }
        /* 🔴 And no signed URI or raw body. */
        assertThat(out).doesNotContain("sign=");
        assertThat(out).doesNotContain("api.daraz.com.bd");
        assertThat(out).doesNotContain("{\"");
    }

    // ================================================================ nothing is written

    @Test
    @DisplayName("🔴 no listing row of any kind is created")
    void writesNothing() {
        long[] before = counts();
        report();
        assertThat(counts()).isEqualTo(before);
    }

    private long[] counts() {
        return new long[]{
                count("channel_listing"), count("channel_listing_sku"),
                count("channel_listing_activity"), count("channel_listing_operation"),
                count("channel_listing_operation_batch"), count("sellable_product"),
        };
    }

    private long count(String table) {
        Long value = jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
        return value == null ? 0 : value;
    }

    // ================================================================ unhappy responses

    @Test
    @DisplayName("a provider refusal reports its code and stops, safely")
    void envelopeRefusalIsSafe() {
        response = json("{'code':'901','type':'ISP','message':'echoed provider text','request_id':'r-9'}");
        String out = report();

        assertThat(out).contains("envelope code  : 901  (REFUSED)");
        assertThat(out).contains("no shape can be read from a refusal");
        /* 🔴 The provider's own message text is never echoed. */
        assertThat(out).doesNotContain("echoed provider text");
    }

    @Test
    @DisplayName("an empty products array is reported plainly")
    void emptyProductsIsSafe() {
        response = json("{'code':'0','data':{'total_products':'0','products':[]}}");
        String out = report();

        assertThat(out).contains("products node  : ARRAY  size=0");
        assertThat(out).contains("no product returned");
    }

    @Test
    @DisplayName("empty, non-JSON and non-object responses are classified, never quoted")
    void unusableBodiesAreSafe() {
        response = "";
        assertThat(report()).contains("response       : EMPTY");

        response = "not json at all";
        String out = report();
        assertThat(out).contains("response       : NOT JSON");
        assertThat(out).doesNotContain("not json at all");

        response = "[1,2,3]";
        assertThat(report()).contains("JSON but not an object");
    }

    @Test
    @DisplayName("a transport failure is reported by class name only")
    void transportFailureIsSafe() {
        transportFailure = new DarazTransportException("The Daraz request could not be completed.");
        String out = report();

        assertThat(out).contains("transport      : FAILED (DarazTransportException)");
        assertThat(out).contains("nothing was read and nothing was written");
    }

    // ================================================================ the command itself

    @Test
    @DisplayName("🔴 the probe only runs when explicitly named on the command line")
    void requiresExplicitCommand() {
        assertThat(DarazListingShapeRunner.isProbeInvocation(new String[]{})).isFalse();
        assertThat(DarazListingShapeRunner.isProbeInvocation(null)).isFalse();
        assertThat(DarazListingShapeRunner.isProbeInvocation(
                new String[]{"--server.port=8080"})).isFalse();
        assertThat(DarazListingShapeRunner.isProbeInvocation(
                new String[]{DarazListingShapeRunner.COMMAND})).isTrue();
    }
}
