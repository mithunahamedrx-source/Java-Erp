package com.trioloo.erp.integration.application;

import com.trioloo.erp.access.AccessFixtures;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.integration.infrastructure.daraz.DarazAccessTokenProvider;
import com.trioloo.erp.integration.infrastructure.daraz.DarazCredentialException;
import com.trioloo.erp.integration.infrastructure.daraz.DarazProperties;
import com.trioloo.erp.integration.infrastructure.daraz.DarazRequestSigner;
import com.trioloo.erp.integration.infrastructure.daraz.DarazTransport;
import com.trioloo.erp.integration.infrastructure.daraz.DarazTransportException;
import com.trioloo.erp.integration.infrastructure.diagnostic.DarazPriceStockProbeRunner;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionEntity;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingSkuRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The controlled Daraz price and stock write probe.
 *
 * <p>🔴 NO MARKETPLACE IS CONTACTED. The transport is a double and the token provider is a stub, so
 * every guarantee below is proven without sending one byte to a seller's account.
 *
 * <p>🔴 THE CLAIMS THAT MATTER ARE NEGATIVE ONES, so they are tested as such: nothing is written to
 * any Trioloo table, no promotion field appears in the payload, and no secret, token, signature or
 * listing value reaches the report.
 */
@SpringBootTest
class DarazPriceStockProbeTest {

    /* Values the probe must NEVER echo into its report. Each is in the fixture below. */
    private static final String SECRET = "test-app-secret-not-a-real-value";
    private static final String TOKEN = "50000-secret-access-token";
    private static final String ITEM_ID = "244613983";
    private static final String SELLER_SKU = "ELT002-SECRET";
    private static final String PRICE = "49800.00";
    private static final String STOCK = "100.0000";

    @Autowired ChannelInstanceRepository channels;
    @Autowired ChannelConnectionRepository connections;
    @Autowired ChannelListingRepository listings;
    @Autowired ChannelListingSkuRepository skus;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;

    private AccessFixtures fixtures;
    private UUID actorId;
    private UUID shop;
    private UUID listing;

    private final AtomicInteger posts = new AtomicInteger();
    private final AtomicReference<URI> capturedUri = new AtomicReference<>();
    private final AtomicReference<String> capturedBody = new AtomicReference<>();
    private String response = "{\"code\":\"0\",\"data\":{},\"request_id\":\"r-probe-1\"}";
    private RuntimeException transportFailure;
    private RuntimeException tokenFailure;

    @BeforeEach
    void setUp() {
        fixtures = new AccessFixtures(jdbc, passwordEncoder);
        clean();
        actorId = fixtures.createProfile("probe-tester", "irrelevant", AccountLifecycleState.ACTIVE);
        shop = insertShop("PROBE-TEST-A", "DARAZ");
        connections.save(ChannelConnectionEntity.observed(shop, ConnectionState.CONNECTED, Instant.now()));
        listing = insertListing(shop, ITEM_ID);
        insertSku(listing, SELLER_SKU, PRICE, true, STOCK, true);
        posts.set(0);
        capturedUri.set(null);
        capturedBody.set(null);
        transportFailure = null;
        tokenFailure = null;
    }

    @AfterEach
    void tearDown() {
        clean();
    }

    // ================================================================= the command gate

    /**
     * 🔴 THE COMMAND IS THE FIRST GATE. Without it an ordinary start must probe nothing, or every
     * restart of the service would be a live write nobody asked for.
     */
    @Test
    @DisplayName("does nothing without the exact command argument")
    void requiresTheCommand() {
        assertThat(DarazPriceStockProbeRunner.isProbeInvocation(new String[]{})).isFalse();
        assertThat(DarazPriceStockProbeRunner.isProbeInvocation(new String[]{"--server.port=8080"})).isFalse();
        assertThat(DarazPriceStockProbeRunner.isProbeInvocation(new String[]{"daraz-listing-shape"})).isFalse();
        assertThat(DarazPriceStockProbeRunner.isProbeInvocation(null)).isFalse();

        assertThat(DarazPriceStockProbeRunner.isProbeInvocation(
                new String[]{"daraz-price-stock-probe"})).isTrue();
    }

    // ================================================================= fails closed

    /** 🔴 A listing that is not there cannot be written to. */
    @Test
    @DisplayName("fails closed for a missing listing")
    void failsClosedForMissingListing() {
        assertThatThrownBy(() -> probe().probe(UUID.randomUUID()))
                .isInstanceOf(DarazPriceStockProbe.ProbeRefusedException.class)
                .hasMessageContaining("no Listing with that id");
        assertThat(posts).hasValue(0);
    }

    /** 🔴 Signing a Daraz write for a shop that is not on Daraz is a call nobody asked for. */
    @Test
    @DisplayName("fails closed for a non-Daraz listing")
    void failsClosedForNonDaraz() {
        UUID other = insertShop("PROBE-TEST-B", "SHOPIFY");
        connections.save(ChannelConnectionEntity.observed(other, ConnectionState.CONNECTED, Instant.now()));
        UUID foreign = insertListing(other, "X-1");
        insertSku(foreign, "SKU-X", PRICE, true, STOCK, true);

        assertThatThrownBy(() -> probe().probe(foreign))
                .isInstanceOf(DarazPriceStockProbe.ProbeRefusedException.class)
                .hasMessageContaining("not Daraz");
        assertThat(posts).hasValue(0);
    }

    /** 🔴 An unconnected shop has nothing to write on behalf of. */
    @Test
    @DisplayName("fails closed when the shop is not connected")
    void failsClosedWhenNotConnected() {
        jdbc.update("DELETE FROM channel_connection WHERE channel_instance_id = ?", shop);
        assertThatThrownBy(() -> probe().probe(listing))
                .isInstanceOf(DarazPriceStockProbe.ProbeRefusedException.class)
                .hasMessageContaining("not connected");
        assertThat(posts).hasValue(0);
    }

    /** 🔴 No credential, no call — the provider is never asked to reject us. */
    @Test
    @DisplayName("fails closed with no usable credential")
    void failsClosedWithoutCredential() {
        tokenFailure = DarazCredentialException.reauthorisationRequired("no credential");
        assertThatThrownBy(() -> probe().probe(listing))
                .isInstanceOf(DarazPriceStockProbe.ProbeRefusedException.class)
                .hasMessageContaining("no usable Daraz credential");
        assertThat(posts).hasValue(0);
    }

    /**
     * 🔴 THE SAME-VALUE GUARANTEE HAS TEETH. An unreadable figure would leave the probe inventing
     * one, which is exactly the change it must never make.
     */
    @Test
    @DisplayName("fails closed when the stored marketplace figures are not readable")
    void failsClosedWithoutReadableFigures() {
        jdbc.update("UPDATE channel_listing_sku SET reported_sale_price_readable = false WHERE channel_listing_id = ?",
                listing);
        assertThatThrownBy(() -> probe().probe(listing))
                .isInstanceOf(DarazPriceStockProbe.ProbeRefusedException.class)
                .hasMessageContaining("no same-value price");
        assertThat(posts).hasValue(0);
    }

    /** ⚠ A variation listing would make the probe choose which unit to write. It refuses instead. */
    @Test
    @DisplayName("fails closed for a listing with more than one orderable SKU")
    void failsClosedForVariation() {
        insertSku(listing, "ELT002-SECOND", PRICE, true, STOCK, true);
        assertThatThrownBy(() -> probe().probe(listing))
                .isInstanceOf(DarazPriceStockProbe.ProbeRefusedException.class)
                .hasMessageContaining("writes one orderable SKU");
        assertThat(posts).hasValue(0);
    }

    // ================================================================= the payload

    /**
     * ✅ `DZC-035` — the published shape, carrying the join keys Trioloo actually holds.
     * 🔴 NO PROMOTION FIELD IS PRESENT (`DZC-040.e`): a window cannot be read back, so it cannot
     * be verified, so this probe does not touch it.
     */
    @Test
    @DisplayName("builds the DZC-035 payload with price and quantity and no promotion")
    void buildsTheDocumentedPayload() {
        String payload = probe().payloadFor(listing);

        assertThat(payload).isEqualTo(
                "<Request><Product><Skus><Sku>"
                        + "<ItemId>" + ITEM_ID + "</ItemId>"
                        + "<SellerSku>" + SELLER_SKU + "</SellerSku>"
                        + "<Price>" + PRICE + "</Price>"
                        + "<Quantity>" + STOCK + "</Quantity>"
                        + "</Sku></Skus></Product></Request>");

        /* 🔴 Promotion is absent, by name, every one of them. */
        assertThat(payload).doesNotContain("SalePrice");
        assertThat(payload).doesNotContain("SaleStartDate");
        assertThat(payload).doesNotContain("SaleEndDate");
        assertThat(payload).doesNotContain("MultiWarehouse");
    }

    /** 🔴 A DRY RUN CONTACTS NOTHING. Building the payload must not open a connection. */
    @Test
    @DisplayName("builds the payload without contacting anything")
    void payloadContactsNothing() {
        probe().payloadFor(listing);
        assertThat(posts).hasValue(0);
    }

    // ================================================================= the one call

    /** ✅ EXACTLY ONE POST, to the documented path, with the documented content type. */
    @Test
    @DisplayName("sends exactly one POST to the documented path")
    void sendsExactlyOnePost() {
        List<String> report = probe().probe(listing);

        assertThat(posts).hasValue(1);
        assertThat(capturedUri.get().toString())
                .isEqualTo("https://api.daraz.com.bd/rest/product/price_quantity/update");
        assertThat(report).anyMatch(line -> line.contains("ACCEPTED by Daraz"));
        assertThat(report).anyMatch(line -> line.contains("r-probe-1"));
    }

    /**
     * 🔴 `DZC-034.c` — THE XML TRAVELS AS A SIGNED PARAMETER. The body carries the payload and a
     * signature, which is what proves the parameter was signed rather than merely attached.
     */
    @Test
    @DisplayName("signs the payload as a request parameter")
    void signsThePayloadAsAParameter() {
        probe().probe(listing);
        String body = capturedBody.get();
        assertThat(body).contains("payload=");
        assertThat(body).contains("sign=");
        assertThat(body).contains("sign_method=sha256");
    }

    // ================================================================= writes nothing

    /**
     * 🔴 THE CENTRAL PROMISE. A probe that recorded an operation, touched a listing or moved
     * inventory would be a push wearing a diagnostic's name.
     */
    @Test
    @DisplayName("writes nothing to any Trioloo table")
    void writesNothing() {
        long listingsBefore = count("channel_listing");
        long skusBefore = count("channel_listing_sku");
        long operationsBefore = count("channel_listing_operation");
        long batchesBefore = count("channel_listing_operation_batch");
        long activityBefore = count("channel_listing_activity");
        long movementsBefore = count("inventory_movement");
        long productsBefore = count("sellable_product");
        String updatedBefore = jdbc.queryForObject(
                "SELECT updated_at::text FROM channel_listing WHERE id = ?", String.class, listing);

        probe().probe(listing);

        assertThat(count("channel_listing")).isEqualTo(listingsBefore);
        assertThat(count("channel_listing_sku")).isEqualTo(skusBefore);
        assertThat(count("channel_listing_operation")).isEqualTo(operationsBefore);
        assertThat(count("channel_listing_operation_batch")).isEqualTo(batchesBefore);
        assertThat(count("channel_listing_activity")).isEqualTo(activityBefore);
        assertThat(count("inventory_movement")).isEqualTo(movementsBefore);
        assertThat(count("sellable_product")).isEqualTo(productsBefore);

        /* ⚠ Not merely the same COUNT — the same ROW, untouched. */
        assertThat(jdbc.queryForObject(
                "SELECT updated_at::text FROM channel_listing WHERE id = ?", String.class, listing))
                .isEqualTo(updatedBefore);
    }

    // ================================================================= leaks nothing

    /**
     * 🔴 THE REPORT IS METADATA ONLY. It is checked against every value the fixture contains,
     * including the ones the provider echoes back.
     */
    @Test
    @DisplayName("leaks no secret, token, signature or listing value")
    void leaksNothing() {
        response = "{\"code\":\"0\",\"request_id\":\"r-probe-1\",\"message\":\"" + SELLER_SKU + " ok\","
                + "\"data\":{\"item_id\":\"" + ITEM_ID + "\",\"price\":\"" + PRICE + "\"}}";

        String printed = String.join("\n", probe().probe(listing));

        assertThat(printed).doesNotContain(SECRET);
        assertThat(printed).doesNotContain(TOKEN);
        assertThat(printed).doesNotContain(SELLER_SKU);
        assertThat(printed).doesNotContain(ITEM_ID);
        assertThat(printed).doesNotContain(PRICE);
        assertThat(printed).doesNotContain("api.daraz.com.bd");
        assertThat(printed).doesNotContain("sign=");
        assertThat(printed).doesNotContain("access_token");

        /* ✅ What it DOES carry is the shape and the outcome. */
        assertThat(printed).contains("provider code  : 0");
        assertThat(printed).contains("message present: true");
        assertThat(printed).contains("envelope fields");
    }

    // ================================================================= refusal is safe

    /** ✅ A provider refusal is a RESULT, reported plainly and without a retry. */
    @Test
    @DisplayName("reports a provider refusal safely")
    void reportsRefusalSafely() {
        response = "{\"code\":\"4104\",\"type\":\"ISV\",\"request_id\":\"r-2\","
                + "\"message\":\"BIZ_CHECK_PRICE_PRECISION_INVALID " + PRICE + "\"}";

        String printed = String.join("\n", probe().probe(listing));

        assertThat(printed).contains("REFUSED by Daraz");
        assertThat(printed).contains("provider code  : 4104");
        assertThat(printed).contains("provider type  : ISV");
        assertThat(printed).doesNotContain(PRICE);
        assertThat(printed).contains("do not retry blind");
        assertThat(posts).hasValue(1);
    }

    /** ⚠ A transport failure must not claim the write did not happen — it says so. */
    @Test
    @DisplayName("does not claim an unknown outcome is a failure to write")
    void transportFailureIsHonest() {
        transportFailure = new DarazTransportException("connection reset to https://api.daraz.com.bd/rest");

        String printed = String.join("\n", probe().probe(listing));

        assertThat(printed).contains("TRANSPORT FAILED");
        assertThat(printed).contains("UNKNOWN");
        assertThat(printed).doesNotContain("api.daraz.com.bd");
    }

    // ================================================================= helpers

    private DarazPriceStockProbe probe() {
        DarazTransport transport = new DarazTransport() {
            @Override
            public String get(URI uri) {
                throw new UnsupportedOperationException("The write probe is a POST.");
            }

            @Override
            public String post(URI uri, String body, String contentType) {
                posts.incrementAndGet();
                capturedUri.set(uri);
                capturedBody.set(body);
                if (transportFailure != null) {
                    throw transportFailure;
                }
                return response;
            }
        };
        DarazProperties properties = new DarazProperties("000000-key", SECRET, "https://example.test/cb");
        DarazAccessTokenProvider tokens = new DarazAccessTokenProvider(
                properties, new DarazRequestSigner(), transport, null,
                java.time.Clock.systemUTC(), java.time.Duration.ofHours(24)) {
            @Override
            public String accessTokenFor(UUID channelInstanceId) {
                if (tokenFailure != null) {
                    throw tokenFailure;
                }
                return TOKEN;
            }
        };
        return new DarazPriceStockProbe(properties, new DarazRequestSigner(), transport, tokens,
                listings, skus, channels, connections);
    }

    private long count(String table) {
        Long n = jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
        return n == null ? 0 : n;
    }

    private UUID insertShop(String code, String type) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO channel_instance (id, code, name, channel_type, record_status, market) "
                + "VALUES (?, ?, ?, ?, 'ACTIVE', 'BANGLADESH')", id, code, code, type);
        return id;
    }

    private UUID insertListing(UUID channelInstanceId, String externalId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_listing (id, channel_instance_id, external_listing_id, sync_state,
                                             created_by, created_at, updated_by, updated_at, version)
                VALUES (?, ?, ?, 'PENDING', ?, now(), ?, now(), 0)
                """, id, channelInstanceId, externalId, actorId, actorId);
        return id;
    }

    private void insertSku(UUID listingId, String channelSku,
                           String price, boolean priceReadable,
                           String stock, boolean stockReadable) {
        jdbc.update("""
                INSERT INTO channel_listing_sku (id, channel_listing_id, channel_sku, position,
                                                 reported_sale_price, reported_sale_price_readable,
                                                 reported_stock, reported_stock_readable,
                                                 created_by, created_at, updated_by, updated_at, version)
                VALUES (?, ?, ?, ?, ?::numeric, ?, ?::numeric, ?, ?, now(), ?, now(), 0)
                """, UUID.randomUUID(), listingId, channelSku, positionFor(listingId),
                price, priceReadable, stock, stockReadable, actorId, actorId);
    }

    private int positionFor(UUID listingId) {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_sku WHERE channel_listing_id = ?", Integer.class, listingId);
        return n == null ? 0 : n;
    }

    private void clean() {
        jdbc.update("DELETE FROM channel_listing_sku WHERE channel_listing_id IN "
                + "(SELECT id FROM channel_listing WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'PROBE-TEST-%'))");
        jdbc.update("DELETE FROM channel_listing WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'PROBE-TEST-%')");
        jdbc.update("DELETE FROM channel_connection WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'PROBE-TEST-%')");
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'PROBE-TEST-%'");
        if (fixtures != null) {
            fixtures.clear();
        }
    }
}
