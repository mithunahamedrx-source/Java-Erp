package com.trioloo.erp.integration.application;

import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.integration.infrastructure.daraz.DarazAccessTokenProvider;
import com.trioloo.erp.integration.infrastructure.daraz.DarazCredentialException;
import com.trioloo.erp.integration.infrastructure.daraz.DarazProperties;
import com.trioloo.erp.integration.infrastructure.daraz.DarazRequestSigner;
import com.trioloo.erp.integration.infrastructure.daraz.DarazTransport;
import com.trioloo.erp.integration.infrastructure.daraz.DarazTransportException;
import com.trioloo.erp.integration.infrastructure.diagnostic.DarazOrderPullRunner;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionEntity;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.lang.reflect.Field;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The controlled, read-only Daraz order pull probe.
 *
 * <p>🔴 NO MARKETPLACE IS CONTACTED. The transport is a double and the token provider is a stub, so
 * every guarantee below is proven without one byte reaching a seller's account.
 *
 * <p>🔴 THE CLAIMS THAT MATTER ARE NEGATIVE, so they are tested as such: a dry run makes ZERO
 * transport calls, nothing is written to any Trioloo table, the probe holds no collaborator that
 * could write an Order, and no buyer name, address, phone, price, order number or SKU reaches the
 * report.
 */
@SpringBootTest
class DarazOrderPullProbeTest {

    /* Values the probe must NEVER echo into its report. Each is in the response fixture below. */
    private static final String SECRET = "test-app-secret-not-a-real-value";
    private static final String TOKEN = "50000-secret-access-token";
    private static final String BUYER_NAME = "Rashedul";
    private static final String BUYER_PHONE = "01712448903";
    private static final String ADDRESS = "House 42, Road 11, Banani";
    private static final String ORDER_NUMBER = "881204773";
    private static final String PRICE = "104500.00";
    private static final String ITEM_SKU = "ELT002-SECRET";

    private static final Instant AFTER = Instant.parse("2026-08-22T00:00:00Z");
    private static final Instant BEFORE = Instant.parse("2026-08-23T00:00:00Z");

    @Autowired ChannelInstanceRepository channels;
    @Autowired ChannelConnectionRepository connections;
    @Autowired JdbcTemplate jdbc;

    private UUID shop;
    private final AtomicInteger gets = new AtomicInteger();
    private final AtomicInteger posts = new AtomicInteger();
    private final AtomicInteger tokenCalls = new AtomicInteger();
    private String response = successBody();
    private RuntimeException transportFailure;
    private RuntimeException tokenFailure;

    @BeforeEach
    void setUp() {
        clean();
        shop = insertShop("ORDER-PROBE-A", "DARAZ");
        connections.save(ChannelConnectionEntity.observed(shop, ConnectionState.CONNECTED, Instant.now()));
        gets.set(0);
        posts.set(0);
        tokenCalls.set(0);
        transportFailure = null;
        tokenFailure = null;
        response = successBody();
    }

    @AfterEach
    void tearDown() {
        clean();
    }

    // ================================================================= the command gate

    /**
     * 🔴 THE COMMAND IS THE FIRST GATE. Without it an ordinary start must probe nothing, or every
     * restart of the service would read a seller's customer orders unasked.
     */
    @Test
    @DisplayName("🔴 does nothing without the exact command argument")
    void requiresTheCommand() {
        assertThat(DarazOrderPullRunner.isProbeInvocation(new String[]{})).isFalse();
        assertThat(DarazOrderPullRunner.isProbeInvocation(new String[]{"--server.port=8080"})).isFalse();
        assertThat(DarazOrderPullRunner.isProbeInvocation(new String[]{"daraz-listing-shape"})).isFalse();
        assertThat(DarazOrderPullRunner.isProbeInvocation(new String[]{"daraz-price-stock-probe"})).isFalse();
        assertThat(DarazOrderPullRunner.isProbeInvocation(null)).isFalse();

        assertThat(DarazOrderPullRunner.isProbeInvocation(
                new String[]{"daraz-order-pull-probe"})).isTrue();
    }

    // ================================================================= dry run contacts nothing

    /**
     * 🔴 THE HEADLINE GUARANTEE. A dry run contacts NOTHING — not the marketplace and not the token
     * endpoint. ⚠ The token check is not pedantry: the provider refreshes an expired credential
     * on demand, which is itself a call to Daraz, so a dry run that resolved a token would contact
     * the provider while claiming not to.
     */
    @Test
    @DisplayName("🔴 a dry run makes zero transport calls and resolves no token")
    void dryRunContactsNothing() {
        List<String> report = probe().describeRequest(shop, AFTER, BEFORE);

        assertThat(gets).hasValue(0);
        assertThat(posts).hasValue(0);
        assertThat(tokenCalls).hasValue(0);
        assertThat(String.join("\n", report)).contains("DRY RUN — nothing was contacted");
    }

    /** ✅ It describes the request honestly: endpoint, window, parameter NAMES, expected shape. */
    @Test
    @DisplayName("the dry run names the endpoint, the window and the parameters")
    void dryRunDescribesTheRequest() {
        String printed = String.join("\n", probe().describeRequest(shop, AFTER, BEFORE));

        assertThat(printed).contains("method         : GET");
        assertThat(printed).contains("/orders/get");
        assertThat(printed).contains(AFTER.toString());
        assertThat(printed).contains(BEFORE.toString());
        assertThat(printed).contains("created_after");
        assertThat(printed).contains("created_before");
        assertThat(printed).contains("countTotal");
        assertThat(printed).contains("trioloo writes : NONE");
    }

    /** 🔴 {@code DZC-050.d} — the provider contradicts itself, and the probe says so rather than hiding it. */
    @Test
    @DisplayName("🔴 the dry run surfaces the unsettled limt/limit contradiction")
    void dryRunSurfacesThePageSizeContradiction() {
        String printed = String.join("\n", probe().describeRequest(shop, AFTER, BEFORE));

        assertThat(printed).contains("limt");
        assertThat(printed).contains("DZC-050.d");
    }

    /** 🔴 A dry run still prints no secret. The credentials are named, never rendered. */
    @Test
    @DisplayName("🔴 the dry run prints no app secret and no token")
    void dryRunPrintsNoSecret() {
        String printed = String.join("\n", probe().describeRequest(shop, AFTER, BEFORE));

        assertThat(printed).doesNotContain(SECRET);
        assertThat(printed).doesNotContain(TOKEN);
        assertThat(printed).doesNotContain("sign=");
    }

    // ================================================================= fails closed

    /** 🔴 A shop that is not registered cannot be read on behalf of. */
    @Test
    @DisplayName("fails closed for a missing shop")
    void failsClosedForMissingShop() {
        assertThatThrownBy(() -> probe().probe(UUID.randomUUID(), AFTER, BEFORE))
                .isInstanceOf(DarazOrderPullProbe.ProbeRefusedException.class)
                .hasMessageContaining("no registered shop");
        assertThat(gets).hasValue(0);
    }

    /** 🔴 A null channel instance id is a refusal, never a read of everything. */
    @Test
    @DisplayName("refuses a missing channel instance id")
    void refusesMissingChannelInstanceId() {
        assertThatThrownBy(() -> probe().probe(null, AFTER, BEFORE))
                .isInstanceOf(DarazOrderPullProbe.ProbeRefusedException.class)
                .hasMessageContaining("channel instance id is required");
        assertThat(gets).hasValue(0);
    }

    /** 🔴 Signing a Daraz read for a shop that is not on Daraz is a call nobody asked for. */
    @Test
    @DisplayName("fails closed for a non-Daraz shop")
    void failsClosedForNonDaraz() {
        UUID other = insertShop("ORDER-PROBE-B", "SHOPIFY");
        connections.save(ChannelConnectionEntity.observed(other, ConnectionState.CONNECTED, Instant.now()));

        assertThatThrownBy(() -> probe().probe(other, AFTER, BEFORE))
                .isInstanceOf(DarazOrderPullProbe.ProbeRefusedException.class)
                .hasMessageContaining("not Daraz");
        assertThat(gets).hasValue(0);
    }

    /** 🔴 An unconnected shop has nothing to read on behalf of. */
    @Test
    @DisplayName("fails closed when the shop is not connected")
    void failsClosedWhenNotConnected() {
        jdbc.update("DELETE FROM channel_connection WHERE channel_instance_id = ?", shop);

        assertThatThrownBy(() -> probe().probe(shop, AFTER, BEFORE))
                .isInstanceOf(DarazOrderPullProbe.ProbeRefusedException.class)
                .hasMessageContaining("not connected");
        assertThat(gets).hasValue(0);
    }

    /** 🔴 No credential, no call — the provider is never asked to reject us. */
    @Test
    @DisplayName("fails closed with no usable credential")
    void failsClosedWithoutCredential() {
        tokenFailure = DarazCredentialException.reauthorisationRequired("no credential");

        assertThatThrownBy(() -> probe().probe(shop, AFTER, BEFORE))
                .isInstanceOf(DarazOrderPullProbe.ProbeRefusedException.class)
                .hasMessageContaining("no usable Daraz credential");
        assertThat(gets).hasValue(0);
    }

    // ================================================================= the window

    /**
     * 🔴 {@code DZC-045.a} — one of the after-dates is mandatory in practice, so its absence is a
     * refusal. ⚠ A probe must never ask a marketplace for everything.
     */
    @Test
    @DisplayName("🔴 refuses a missing created-after — a probe never reads unbounded")
    void refusesMissingCreatedAfter() {
        assertThatThrownBy(() -> probe().probe(shop, null, BEFORE))
                .isInstanceOf(DarazOrderPullProbe.ProbeRefusedException.class)
                .hasMessageContaining("created-after instant is required");
        assertThat(gets).hasValue(0);
    }

    /** 🔴 A probe reads a SMALL window, so the far end is required too. */
    @Test
    @DisplayName("refuses a missing created-before")
    void refusesMissingCreatedBefore() {
        assertThatThrownBy(() -> probe().probe(shop, AFTER, null))
                .isInstanceOf(DarazOrderPullProbe.ProbeRefusedException.class)
                .hasMessageContaining("created-before instant is required");
        assertThat(gets).hasValue(0);
    }

    /** 🔴 An inverted or empty window is a refusal, not a request the provider must reject. */
    @Test
    @DisplayName("refuses an inverted window")
    void refusesInvertedWindow() {
        assertThatThrownBy(() -> probe().probe(shop, BEFORE, AFTER))
                .isInstanceOf(DarazOrderPullProbe.ProbeRefusedException.class)
                .hasMessageContaining("must be later than");
        assertThatThrownBy(() -> probe().probe(shop, AFTER, AFTER))
                .isInstanceOf(DarazOrderPullProbe.ProbeRefusedException.class)
                .hasMessageContaining("must be later than");
        assertThat(gets).hasValue(0);
    }

    // ================================================================= exactly one read

    /** 🔴 EXACTLY ONE REQUEST. A loop or a retry would make this an import rather than a probe. */
    @Test
    @DisplayName("🔴 performs exactly one read, with no paging and no retry")
    void performsExactlyOneRead() {
        probe().probe(shop, AFTER, BEFORE);

        assertThat(gets).hasValue(1);
        assertThat(posts).hasValue(0);
    }

    // ================================================================= the report is sanitised

    /**
     * 🔴 THE SANITISATION GUARANTEE, TESTED AGAINST A RESPONSE THAT CARRIES EVERY FORBIDDEN CLASS
     * OF VALUE. Buyer name, phone, address, order number, price and SKU are all in the fixture, and
     * none may reach the report.
     */
    @Test
    @DisplayName("🔴 the report carries no buyer, address, phone, price, order number or SKU")
    void reportCarriesNoSellerData() {
        String printed = String.join("\n", probe().probe(shop, AFTER, BEFORE));

        assertThat(printed).doesNotContain(BUYER_NAME);
        assertThat(printed).doesNotContain(BUYER_PHONE);
        assertThat(printed).doesNotContain(ADDRESS);
        assertThat(printed).doesNotContain(ORDER_NUMBER);
        assertThat(printed).doesNotContain(PRICE);
        assertThat(printed).doesNotContain(ITEM_SKU);
        assertThat(printed).doesNotContain(SECRET);
        assertThat(printed).doesNotContain(TOKEN);
        assertThat(printed).doesNotContain("api.daraz.com.bd");
        assertThat(printed).doesNotContain("sign=");
    }

    /** ✅ What it DOES carry is the outcome, the counts and the field names. */
    @Test
    @DisplayName("the report carries outcome, counts and field names")
    void reportCarriesShapeAndCounts() {
        String printed = String.join("\n", probe().probe(shop, AFTER, BEFORE));

        assertThat(printed).contains("ACCEPTED by Daraz");
        assertThat(printed).contains("provider code  : 0");
        assertThat(printed).contains("countTotal     : 2");
        assertThat(printed).contains("count          : 1");
        assertThat(printed).contains("orders returned: 1");
        /* 🔴 Field NAMES, which are protocol facts — never their values. */
        assertThat(printed).contains("order_id");
        assertThat(printed).contains("address_shipping");
        assertThat(printed).contains("trioloo writes : NONE");
    }

    /** ✅ A provider refusal is a RESULT, reported plainly and without a retry. */
    @Test
    @DisplayName("reports a provider refusal safely, and names the other page-size spelling")
    void reportsRefusalSafely() {
        response = "{\"code\":\"19\",\"type\":\"ISV\",\"request_id\":\"r-2\","
                + "\"message\":\"E019: invalid limit " + PRICE + "\"}";

        String printed = String.join("\n", probe().probe(shop, AFTER, BEFORE));

        assertThat(printed).contains("REFUSED by Daraz");
        assertThat(printed).contains("provider code  : 19");
        assertThat(printed).doesNotContain(PRICE);
        assertThat(printed).contains("limt");
        assertThat(gets).hasValue(1);
    }

    /** ⚠ A transport failure is reported honestly and leaks no URI. */
    @Test
    @DisplayName("reports a transport failure without leaking the signed URI")
    void transportFailureIsSafe() {
        transportFailure = new DarazTransportException("connection reset to https://api.daraz.com.bd/rest");

        String printed = String.join("\n", probe().probe(shop, AFTER, BEFORE));

        assertThat(printed).contains("TRANSPORT FAILED");
        assertThat(printed).contains("nothing was read");
        assertThat(printed).doesNotContain("api.daraz.com.bd");
    }

    // ================================================================= blast radius

    /**
     * 🔴 THE PROBE HOLDS NO COLLABORATOR THAT COULD WRITE AN ORDER, A LISTING, AN INVENTORY ROW OR
     * A PAYMENT. ⚠ Asserted structurally rather than behaviourally: a future edit that injects a
     * writable repository fails here, before anyone can call it.
     */
    @Test
    @DisplayName("🔴 holds no order, listing, inventory or payment persistence collaborator")
    void holdsNoWritablePersistenceCollaborator() {
        for (Field field : DarazOrderPullProbe.class.getDeclaredFields()) {
            String type = field.getType().getSimpleName();
            assertThat(type).as("field " + field.getName())
                    .doesNotContain("OrderRepository")
                    .doesNotContain("ChannelListingRepository")
                    .doesNotContain("ChannelListingSkuRepository")
                    .doesNotContain("InventoryRepository")
                    .doesNotContain("PaymentRepository")
                    .doesNotContain("OperationRepository");
        }
    }

    /** ✅ Its only repositories are channel identity and connection state, both read-only in use. */
    @Test
    @DisplayName("its only repositories are channel identity and connection state")
    void holdsOnlyTheTwoReadOnlyRepositories() {
        List<String> repositories = java.util.Arrays.stream(DarazOrderPullProbe.class.getDeclaredFields())
                .map(f -> f.getType().getSimpleName())
                .filter(n -> n.endsWith("Repository"))
                .toList();

        assertThat(repositories)
                .containsExactlyInAnyOrder("ChannelInstanceRepository", "ChannelConnectionRepository");
    }

    /** 🔴 NOTHING IS WRITTEN, AND THIS COUNTS ROWS TO PROVE IT. */
    @Test
    @DisplayName("🔴 a full probe writes no row to any Trioloo table")
    void writesNothing() {
        long ordersBefore = count("channel_order");
        long itemsBefore = count("channel_order_item");
        long listingsBefore = count("channel_listing");
        long skusBefore = count("channel_listing_sku");
        long operationsBefore = count("channel_listing_operation");
        long instancesBefore = count("channel_instance");

        probe().probe(shop, AFTER, BEFORE);

        assertThat(count("channel_order")).isEqualTo(ordersBefore);
        assertThat(count("channel_order_item")).isEqualTo(itemsBefore);
        assertThat(count("channel_listing")).isEqualTo(listingsBefore);
        assertThat(count("channel_listing_sku")).isEqualTo(skusBefore);
        assertThat(count("channel_listing_operation")).isEqualTo(operationsBefore);
        assertThat(count("channel_instance")).isEqualTo(instancesBefore);
    }

    /** ✅ The schema may now exist; the diagnostic still has no order persistence collaborator. */
    @Test
    @DisplayName("the order tables may exist, but the diagnostic still never imports into them")
    void orderTablesExistOutsideTheDiagnostic() {
        List<String> tables = jdbc.queryForList(
                "SELECT table_name FROM information_schema.tables "
                        + "WHERE table_schema = 'public' AND table_name IN ('channel_order', 'channel_order_item')",
                String.class);
        assertThat(tables).containsExactlyInAnyOrder("channel_order", "channel_order_item");
        assertThat(count("channel_order")).isZero();
        assertThat(count("channel_order_item")).isZero();
    }

    // ================================================================= helpers

    private DarazOrderPullProbe probe() {
        DarazTransport transport = new DarazTransport() {
            @Override
            public String get(URI uri) {
                gets.incrementAndGet();
                if (transportFailure != null) {
                    throw transportFailure;
                }
                return response;
            }

            @Override
            public String post(URI uri, String body, String contentType) {
                posts.incrementAndGet();
                throw new UnsupportedOperationException("The order pull probe is a GET.");
            }
        };
        DarazProperties properties = new DarazProperties("000000-key", SECRET, "https://example.test/cb");
        DarazAccessTokenProvider tokens = new DarazAccessTokenProvider(
                properties, new DarazRequestSigner(), transport, null,
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
        return new DarazOrderPullProbe(properties, new DarazRequestSigner(), transport, tokens,
                channels, connections);
    }

    /** ⚠ Deliberately carries every class of value the report must never print. */
    private static String successBody() {
        return "{\"code\":\"0\",\"request_id\":\"r-order-1\",\"data\":{"
                + "\"countTotal\":2,\"count\":1,\"orders\":[{"
                + "\"order_id\":\"57244869716603\","
                + "\"order_number\":\"" + ORDER_NUMBER + "\","
                + "\"customer_first_name\":\"" + BUYER_NAME + "\","
                + "\"price\":\"" + PRICE + "\","
                + "\"payment_method\":\"COD\","
                + "\"statuses\":[\"pending\"],"
                + "\"address_shipping\":{\"first_name\":\"" + BUYER_NAME + "\",\"phone\":\"" + BUYER_PHONE
                + "\",\"address1\":\"" + ADDRESS + "\"},"
                + "\"items\":[{\"sku\":\"" + ITEM_SKU + "\"}]"
                + "}]}}";
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

    private void clean() {
        jdbc.update("DELETE FROM channel_connection WHERE channel_instance_id IN "
                + "(SELECT id FROM channel_instance WHERE code LIKE 'ORDER-PROBE-%')");
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'ORDER-PROBE-%'");
    }
}
