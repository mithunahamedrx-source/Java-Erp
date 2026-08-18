package com.trioloo.erp.product.application;

import com.trioloo.erp.access.AccessFixtures;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.product.application.channel.ChannelAdapterPort;
import com.trioloo.erp.product.application.channel.ChannelCapabilityDeclaration;
import com.trioloo.erp.product.application.channel.DiscoveryPage;
import com.trioloo.erp.product.application.channel.OutboundListingPayload;
import com.trioloo.erp.product.application.channel.OutboundResult;
import com.trioloo.erp.product.application.channel.ReportedListingSnapshot;
import com.trioloo.erp.product.application.channel.ReportedSkuSnapshot;
import com.trioloo.erp.product.domain.ActivityKind;
import com.trioloo.erp.product.domain.ListingStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Channel-wide discovery — {@code PRD-175}, {@code PRD-186.a}.
 *
 * <p>🔴 THE CLAIM UNDER TEST is that EVERY LISTING A DISCOVER RUN PROCESSES GETS ITS OWN
 * OPERATION RECORD. {@code PRD-186.a} requires one record per listing per requested remote act
 * and names {@code discover} as one of the five kinds; {@code PRD-186.b} forbids collapsing
 * per-listing results into an aggregate. Production ran a real discovery on 2026-08-18 that
 * recorded 9 listings and ZERO operations — the defect this suite exists to keep fixed.
 *
 * <p>🔴 THE SECOND CLAIM is that recording the ATTEMPT does not decide the listing's STANDING
 * POSITION. {@code INV-107.4} keeps an operation's outcome and a listing's sync state different
 * facts, and what sync state a successfully read, still-{@code UNMAPPED} listing carries is NOT
 * RATIFIED. Discovery must therefore leave {@code sync_state} and {@code last_sync_at} exactly
 * as it found them, and a test here fails loudly if that ever silently changes.
 *
 * <p>⚠ The adapter is a CONTROLLED DOUBLE. No marketplace is contacted.
 */
@SpringBootTest
class ListingDiscoveryTest {

    /** ⚠ What the double returns from one discovery call. Swapped per test. */
    private static volatile List<ReportedListingSnapshot> page = List.of();

    /** ⚠ Whether the double reports the run as a complete picture ({@code API-066.b}). */
    private static volatile boolean complete = true;

    @TestConfiguration
    static class Adapters {

        /**
         * 🔴 A CONTROLLED DOUBLE, not a marketplace. {@code SHOPIFY} is a recognised Channel
         * Type with NO production adapter, so registering one here cannot shadow real code.
         */
        @Bean
        ChannelAdapterPort discoveryTestAdapter() {
            return new ChannelAdapterPort() {
                @Override public String channelType() { return "SHOPIFY"; }

                @Override public ChannelCapabilityDeclaration declareCapability(UUID id) {
                    return new ChannelCapabilityDeclaration(Map.of());
                }

                @Override public DiscoveryPage discoverActive(UUID id, String cursor) {
                    /* One page, no scrolling — this suite is about what is RECORDED per
                       listing, not about paging. */
                    return new DiscoveryPage(page, null, complete,
                            complete ? null : "The double reported a partial picture.");
                }

                @Override public Optional<ReportedListingSnapshot> readListing(UUID id, String ext) {
                    throw new UnsupportedOperationException("Discovery exercises the page read.");
                }

                @Override public OutboundResult pushUpdate(UUID id, OutboundListingPayload p) {
                    throw new UnsupportedOperationException("Discovery is inbound only.");
                }

                @Override public OutboundResult publishCreate(UUID id, OutboundListingPayload p) {
                    throw new UnsupportedOperationException("Discovery is inbound only.");
                }

                @Override public OutboundResult withdraw(UUID id, String ext) {
                    throw new UnsupportedOperationException("Discovery is inbound only.");
                }
            };
        }
    }

    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ChannelListingOperationService operations;

    private AccessFixtures fixtures;
    private UUID actorId;
    private UUID channelId;

    @BeforeEach
    void setUp() {
        fixtures = new AccessFixtures(jdbc, passwordEncoder);
        clearProductData();
        fixtures.clear();
        for (String permission : List.of(ProductPermissions.CHANNEL_LISTING_VIEW,
                ProductPermissions.CHANNEL_LISTING_MANAGE,
                ProductPermissions.CHANNEL_LISTING_PUBLISH,
                ProductPermissions.CHANNEL_LISTING_SYNC)) {
            fixtures.createPermission(permission);
        }
        actorId = fixtures.createProfile("discovery-tester", "irrelevant", AccountLifecycleState.ACTIVE);
        page = List.of();
        complete = true;
        channelId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type)
                VALUES (?, ?, ?, ?)
                """, channelId, "CH-DISCOVERY", "Discovery Channel", "SHOPIFY");
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clearProductData();
        page = List.of();
        complete = true;
    }

    // =================================================================================
    // PRD-186.a — one operation record per listing
    // =================================================================================

    /**
     * 🔴 {@code PRD-186.a} — THE DEFECT THIS SUITE EXISTS FOR. Nine listings returned must
     * leave nine operation records, not one batch and nothing else.
     */
    @Test
    @DisplayName("PRD-186.a discovery records one operation per returned listing")
    void oneOperationPerListing() {
        actingAll();
        page = catalogue(9);

        ChannelListingOperationService.DiscoveryOutcome outcome = operations.discover(channelId);

        assertThat(outcome.listingsSeen()).isEqualTo(9);
        assertThat(outcome.listingsCreated()).isEqualTo(9);
        assertThat(count("channel_listing")).isEqualTo(9);
        assertThat(count("channel_listing_operation")).isEqualTo(9);
        assertThat(count("channel_listing_operation_batch")).isEqualTo(1);
    }

    /** 🔴 {@code PRD-186.a} — the record carries its KIND and its DIRECTION. */
    @Test
    @DisplayName("PRD-186.a operations are DISCOVER and INBOUND")
    void operationsAreDiscoverInbound() {
        actingAll();
        page = catalogue(3);

        operations.discover(channelId);

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_operation "
                        + "WHERE operation_kind = 'DISCOVER' AND direction = 'INBOUND'",
                Long.class)).isEqualTo(3L);
        assertThat(distinct("operation_kind")).containsExactly("DISCOVER");
        assertThat(distinct("direction")).containsExactly("INBOUND");
        assertThat(distinct("outcome")).containsExactly("SUCCEEDED");
    }

    /** 🔴 {@code PRD-186.a}/{@code .c} — every member names the batch that grouped it. */
    @Test
    @DisplayName("PRD-186.c every operation links to the discover batch")
    void operationsLinkToBatch() {
        actingAll();
        page = catalogue(4);

        ChannelListingOperationService.DiscoveryOutcome outcome = operations.discover(channelId);

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_operation WHERE batch_id = ?",
                Long.class, outcome.batchId())).isEqualTo(4L);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_operation WHERE batch_id IS NULL",
                Long.class)).isZero();
    }

    /**
     * 🔴 {@code INV-107.5} / {@code PRJ-130} — attribution is captured at WRITE TIME. The
     * operator who requested the run is named on every member, and the act is closed with a
     * completion time rather than left perpetually open.
     */
    @Test
    @DisplayName("INV-107.5 operations carry requested_by, requested_at and completed_at")
    void operationsCarryAttributionAndTimes() {
        actingAll();
        page = catalogue(3);

        operations.discover(channelId);

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_operation WHERE requested_by = ?",
                Long.class, actorId)).isEqualTo(3L);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_operation "
                        + "WHERE requested_at IS NULL OR completed_at IS NULL", Long.class))
                .isZero();
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_operation WHERE completed_at < requested_at",
                Long.class)).isZero();
    }

    /**
     * 🔴 The detail is OPERATOR-FACING TEXT and must never duplicate a provider value. It
     * carries counts and a plain statement of what happened.
     */
    @Test
    @DisplayName("PRD-186.a detail carries counts only, never a provider value")
    void detailCarriesNoProviderValue() {
        actingAll();
        page = List.of(one("EXT-SECRET-1", "A Confidential Product Title", new BigDecimal("41999.00")));

        operations.discover(channelId);

        String detail = jdbc.queryForObject(
                "SELECT detail FROM channel_listing_operation", String.class);
        assertThat(detail).contains("Discovered and newly recorded as UNMAPPED.");
        assertThat(detail).contains("1 orderable SKU");
        /* 🔴 Neither the title, the price nor the external identifier may appear. */
        assertThat(detail).doesNotContain("Confidential");
        assertThat(detail).doesNotContain("41999");
        assertThat(detail).doesNotContain("EXT-SECRET-1");

        String provenance = jdbc.queryForObject(
                "SELECT adapter_provenance FROM channel_listing_operation", String.class);
        assertThat(provenance).isEqualTo("SHOPIFY");
    }

    /** ✅ A second run over a known listing records a NEW operation and says so honestly. */
    @Test
    @DisplayName("PRD-186.a a re-read of a known listing is its own operation record")
    void reReadRecordsItsOwnOperation() {
        actingAll();
        page = catalogue(2);
        operations.discover(channelId);

        operations.discover(channelId);

        assertThat(count("channel_listing")).isEqualTo(2);
        assertThat(count("channel_listing_operation")).isEqualTo(4);
        assertThat(count("channel_listing_operation_batch")).isEqualTo(2);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_operation "
                        + "WHERE detail LIKE 'Reported values re-read%'", Long.class)).isEqualTo(2L);
    }

    // =================================================================================
    // PRD-186.f — activity names the run that produced it
    // =================================================================================

    /**
     * ✅ {@code PRD-186.f} — the history must be able to carry batch membership. A channel
     * event produced by a discovery run now names both the operation and the batch.
     */
    @Test
    @DisplayName("PRD-186.f discovery activity links to its operation and batch")
    void activityLinksToOperationAndBatch() {
        actingAll();
        page = catalogue(3);

        ChannelListingOperationService.DiscoveryOutcome outcome = operations.discover(channelId);

        /* ⚠ Three listings leave three CHANNEL_EVENTs and three OPERATION entries — the two
           kinds coexist and are counted separately (PRD-186.e). */
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_activity WHERE entry_kind = 'CHANNEL_EVENT'",
                Long.class)).isEqualTo(3L);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_activity WHERE batch_id = ?",
                Long.class, outcome.batchId())).isEqualTo(6L);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_activity "
                        + "WHERE entry_kind = 'CHANNEL_EVENT' AND operation_id IS NULL",
                Long.class)).isZero();
        /* ✅ Each event names the operation for ITS OWN listing, not a shared one. */
        assertThat(jdbc.queryForObject(
                "SELECT count(DISTINCT operation_id) FROM channel_listing_activity",
                Long.class)).isEqualTo(3L);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM channel_listing_activity a
                JOIN channel_listing_operation o ON o.id = a.operation_id
                WHERE o.channel_listing_id <> a.channel_listing_id
                """, Long.class)).isZero();
    }

    /**
     * ✅ {@code PRD-186.f} — DISCOVERY IS AN EVENT THE HISTORY MUST CARRY. Each per-listing
     * operation leaves an {@code OPERATION} entry naming the operation and the batch, so
     * {@code FRAME 21} can show the run that found the Listing.
     */
    @Test
    @DisplayName("PRD-186.f discovery writes an OPERATION activity per listing")
    void discoveryWritesOperationActivity() {
        actingAll();
        page = catalogue(3);

        ChannelListingOperationService.DiscoveryOutcome outcome = operations.discover(channelId);

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_activity WHERE entry_kind = 'OPERATION'",
                Long.class)).isEqualTo(3L);
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM channel_listing_activity
                WHERE entry_kind = 'OPERATION' AND (operation_id IS NULL OR batch_id <> ?)
                """, Long.class, outcome.batchId())).isZero();
        /* ✅ Each entry names the operation for its OWN listing. */
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM channel_listing_activity a
                JOIN channel_listing_operation o ON o.id = a.operation_id
                WHERE a.entry_kind = 'OPERATION' AND o.channel_listing_id <> a.channel_listing_id
                """, Long.class)).isZero();
    }

    /**
     * 🔴 THE TWO KINDS ANSWER DIFFERENT QUESTIONS AND ARE NEVER MERGED ({@code PRD-186.e}).
     * The {@code OPERATION} entry names the operator who ASKED; the {@code CHANNEL_EVENT} beside
     * it keeps its NULL actor because the MARKETPLACE acted. Both survive one run.
     */
    @Test
    @DisplayName("PRD-186.e OPERATION carries the operator, CHANNEL_EVENT keeps a NULL actor")
    void operationAndChannelEventCoexistWithDifferentActors() {
        actingAll();
        page = catalogue(3);

        operations.discover(channelId);

        assertThat(count("channel_listing_activity")).isEqualTo(6);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_activity "
                        + "WHERE entry_kind = 'OPERATION' AND actor_id = ?",
                Long.class, actorId)).isEqualTo(3L);
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_activity "
                        + "WHERE entry_kind = 'CHANNEL_EVENT' AND actor_id IS NOT NULL",
                Long.class)).isZero();
    }

    /** 🔴 The summary is operator-facing text and never mirrors a provider value. */
    @Test
    @DisplayName("PRD-186.f the OPERATION summary carries counts, never a provider value")
    void operationActivitySummaryLeaksNothing() {
        actingAll();
        page = List.of(one("EXT-SECRET-9", "A Confidential Product Title", new BigDecimal("41999.00")));

        operations.discover(channelId);

        String summary = jdbc.queryForObject(
                "SELECT summary FROM channel_listing_activity WHERE entry_kind = 'OPERATION'",
                String.class);
        assertThat(summary).startsWith("DISCOVER — SUCCEEDED:");
        assertThat(summary).contains("1 orderable SKU");
        assertThat(summary).doesNotContain("Confidential");
        assertThat(summary).doesNotContain("41999");
        assertThat(summary).doesNotContain("EXT-SECRET-9");
        /* ⚠ summary is varchar(600); the built string must fit with room to spare. */
        assertThat(summary).hasSizeLessThan(600);
    }

    /**
     * ✅ THE {@code FRAME 21} CLAIM — the history surface can actually see the discovery entry,
     * through the same query the screen uses rather than through a direct table read.
     */
    @Test
    @DisplayName("FRAME 21 the history query returns the discovery OPERATION entry")
    void historyQuerySeesDiscoveryOperation() {
        actingAll();
        page = catalogue(1);
        operations.discover(channelId);
        UUID listingId = jdbc.queryForObject("SELECT id FROM channel_listing", UUID.class);

        List<ListingViews.ActivityView> all = operations
                .activity(listingId, null, PageRequest.of(0, 20)).getContent();
        List<ListingViews.ActivityView> operationsOnly = operations
                .activity(listingId, ActivityKind.OPERATION, PageRequest.of(0, 20)).getContent();

        assertThat(all).hasSize(2);
        assertThat(operationsOnly).hasSize(1);
        ListingViews.ActivityView entry = operationsOnly.getFirst();
        assertThat(entry.entryKind()).isEqualTo(ActivityKind.OPERATION);
        assertThat(entry.summary()).startsWith("DISCOVER — SUCCEEDED:");
        assertThat(entry.operationId()).isNotNull();
        assertThat(entry.batchId()).isNotNull();
        /* ✅ FRAME 21 renders an actor NAME, so the operator must resolve through the directory
           rather than surfacing a raw id. The fixture's full name is "<username> (test)". */
        assertThat(entry.actorName()).isEqualTo("discovery-tester (test)");
        assertThat(entry.beforeValue()).isNull();
        assertThat(entry.afterValue()).isNull();
    }

    /**
     * 🔴 THE ACTOR STAYS NULL, AND THAT IS THE SCHEMA'S OWN RULE — "NULL actor means the
     * marketplace or the scheduler acted, not a person" ({@code V6}). The operator requested
     * the run; they did not set the status the channel reported.
     */
    @Test
    @DisplayName("V6 a CHANNEL_EVENT keeps a NULL actor — the marketplace acted, not a person")
    void channelEventKeepsNullActor() {
        actingAll();
        page = catalogue(3);

        operations.discover(channelId);

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_activity "
                        + "WHERE entry_kind = 'CHANNEL_EVENT' AND actor_id IS NOT NULL",
                Long.class)).isZero();
        assertThat(distinctOf("channel_listing_activity", "source")).containsExactly("CHANNEL");
    }

    // =================================================================================
    // 🔴 INV-107.4 — the attempt is not the standing position
    // =================================================================================

    /**
     * 🔴 THE GUARD. Recording an operation must NOT decide the listing's sync state.
     * {@code INV-107.4} keeps them different facts, and no rule says what a successfully read,
     * still-{@code UNMAPPED} listing carries — so discovery leaves both columns untouched.
     *
     * <p>⚠ If a future change routes discovery through the shared settle path, this fails.
     */
    @Test
    @DisplayName("INV-107.4 discovery records the attempt without deciding sync state")
    void discoveryDoesNotDecideSyncState() {
        actingAll();
        page = catalogue(9);

        operations.discover(channelId);

        assertThat(distinctOf("channel_listing", "sync_state")).containsExactly("PENDING");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing WHERE last_sync_at IS NOT NULL",
                Long.class)).isZero();
        /* ✅ What discovery DOES record about recency is the seen-in-discovery time. */
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing WHERE last_seen_in_discovery_at IS NULL",
                Long.class)).isZero();
    }

    // =================================================================================
    // PRD-181.a / PRD-178 — a read reports, it never decides
    // =================================================================================

    /** 🔴 {@code PRD-181.a} — inbound writes the REPORTED side only. */
    @Test
    @DisplayName("PRD-181.a discovery writes no intended value")
    void discoveryWritesNoIntent() {
        actingAll();
        page = catalogue(9);

        operations.discover(channelId);

        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM channel_listing
                WHERE intended_title IS NOT NULL OR intended_description IS NOT NULL
                   OR sale_price IS NOT NULL OR published_marketplace_stock IS NOT NULL
                   OR promotion_price IS NOT NULL OR intended_channel_category IS NOT NULL
                   OR last_successful_push_at IS NOT NULL
                """, Long.class)).isZero();
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_attribute WHERE intended_value IS NOT NULL",
                Long.class)).isZero();
        /* 🔴 PRD-178 — discovered listings stay UNMAPPED. */
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing WHERE sellable_product_id IS NOT NULL",
                Long.class)).isZero();
    }

    /** 🔴 A channel read never manufactures Trioloo's own product or stock records. */
    @Test
    @DisplayName("PRD-178 discovery creates no product, variant or inventory movement")
    void discoveryCreatesNoProductOrStock() {
        actingAll();
        page = catalogue(9);

        operations.discover(channelId);

        assertThat(count("sellable_product")).isZero();
        assertThat(count("product_variant")).isZero();
        assertThat(count("inventory_movement")).isZero();
    }

    /**
     * ✅ THE {@code FRAME 20} CLAIM — a nine-listing run is representable per listing, with no
     * gaps. Every returned listing has exactly one operation, and every operation resolves to a
     * real listing on the same channel.
     */
    @Test
    @DisplayName("PRD-186.b a nine-listing run is representable with no per-listing gaps")
    void nineListingRunHasNoGaps() {
        actingAll();
        page = catalogue(9);

        ChannelListingOperationService.DiscoveryOutcome outcome = operations.discover(channelId);

        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM channel_listing l
                WHERE NOT EXISTS (SELECT 1 FROM channel_listing_operation o
                                  WHERE o.channel_listing_id = l.id AND o.batch_id = ?)
                """, Long.class, outcome.batchId())).isZero();
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM channel_listing_operation o
                JOIN channel_listing l ON l.id = o.channel_listing_id
                WHERE l.channel_instance_id <> ?
                """, Long.class, channelId)).isZero();
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_operation WHERE outcome <> 'SUCCEEDED'",
                Long.class)).isZero();
    }

    /**
     * 🔴 {@code PRD-186.b} — an INCOMPLETE run does not stamp its incompleteness onto the
     * listings it DID read. Those reads succeeded individually; the truncation is a fact about
     * the run, which {@code DiscoveryOutcome} already reports ({@code API-066.b}).
     */
    @Test
    @DisplayName("PRD-186.b an incomplete run still records each listing it did read")
    void incompleteRunStillRecordsWhatItRead() {
        actingAll();
        page = catalogue(4);
        complete = false;

        ChannelListingOperationService.DiscoveryOutcome outcome = operations.discover(channelId);

        assertThat(outcome.complete()).isFalse();
        assertThat(outcome.incompleteReason()).isNotBlank();
        assertThat(count("channel_listing_operation")).isEqualTo(4);
        assertThat(distinct("outcome")).containsExactly("SUCCEEDED");
    }

    // =================================================================================
    // 🔴 The all-null-actor 500 — the live production defect of 2026-08-18
    // =================================================================================

    /**
     * 🔴 THE REGRESSION TEST FOR A LIVE 500. Every listing detail page returned
     * {@code HTTP 500} in production because its activity aside was ALL-NULL-ACTOR:
     * {@code ActorDirectory.namesOf} hands back an immutable {@code Map.of()} when given no
     * identifiers, and {@code Map.of().get(null)} THROWS rather than returning null.
     *
     * <p>⚠ THE SHAPE IS THE v14h ONE, REPRODUCED DELIBERATELY. That pull wrote channel events
     * and no operation records at all, so every page of activity carried a null actor and
     * nothing else. The {@code OPERATION} rows are removed here to recreate exactly that.
     *
     * <p>⚠ NO EXISTING TEST COULD HAVE CAUGHT IT: every other fixture has at least one
     * operator-attributed row on the page, which makes {@code namesOf} return a {@code HashMap},
     * whose {@code get(null)} is harmless.
     */
    @Test
    @DisplayName("A page whose rows ALL have a null actor resolves instead of throwing")
    void allNullActorPageDoesNotThrow() {
        actingAll();
        page = catalogue(1);
        operations.discover(channelId);
        UUID listingId = jdbc.queryForObject("SELECT id FROM channel_listing", UUID.class);
        jdbc.update("DELETE FROM channel_listing_activity WHERE entry_kind = 'OPERATION'");
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_activity WHERE actor_id IS NOT NULL",
                Long.class)).isZero();

        List<ListingViews.ActivityView> entries = operations
                .activity(listingId, null, PageRequest.of(0, 3)).getContent();

        assertThat(entries).hasSize(1);
        assertThat(entries.getFirst().entryKind()).isEqualTo(ActivityKind.CHANNEL_EVENT);
        /* 🔴 NULL, not "System" and not the operator who triggered the run. */
        assertThat(entries.getFirst().actorName()).isNull();
    }

    /**
     * 🔴 {@code FRAME 06}'s activity aside is exactly {@code page=0&size=3} — the call that
     * actually 500'd — and {@code FRAME 21}'s filtered view must survive the same data.
     */
    @Test
    @DisplayName("FRAME 06 aside and FRAME 21 filter both survive all-null-actor data")
    void frame06AndFrame21SurviveNullActors() {
        actingAll();
        page = catalogue(1);
        operations.discover(channelId);
        UUID listingId = jdbc.queryForObject("SELECT id FROM channel_listing", UUID.class);
        jdbc.update("DELETE FROM channel_listing_activity WHERE entry_kind = 'OPERATION'");

        /* FRAME 06 — the aside, unfiltered, three at a time. */
        assertThat(operations.activity(listingId, null, PageRequest.of(0, 3)).getContent())
                .hasSize(1);
        /* FRAME 21 — the filtered chronology. */
        assertThat(operations.activity(listingId, ActivityKind.CHANNEL_EVENT, PageRequest.of(0, 20))
                .getContent()).hasSize(1);
        /* ✅ A filter that matches NOTHING is also an empty id list — the same trap. */
        assertThat(operations.activity(listingId, ActivityKind.FIELD_CHANGE, PageRequest.of(0, 20))
                .getContent()).isEmpty();
    }

    /**
     * ✅ THE FIX RESOLVES REAL ACTORS EXACTLY AS BEFORE. A mixed page keeps the operator's name
     * on the {@code OPERATION} entry and keeps {@code null} on the {@code CHANNEL_EVENT} — the
     * null is not allowed to spread to its neighbour.
     */
    @Test
    @DisplayName("A mixed page resolves the real actor and leaves the null actor null")
    void mixedPageResolvesRealActorOnly() {
        actingAll();
        page = catalogue(1);
        operations.discover(channelId);
        UUID listingId = jdbc.queryForObject("SELECT id FROM channel_listing", UUID.class);

        List<ListingViews.ActivityView> entries = operations
                .activity(listingId, null, PageRequest.of(0, 20)).getContent();

        assertThat(entries).hasSize(2);
        ListingViews.ActivityView operation = entries.stream()
                .filter(e -> e.entryKind() == ActivityKind.OPERATION).findFirst().orElseThrow();
        ListingViews.ActivityView event = entries.stream()
                .filter(e -> e.entryKind() == ActivityKind.CHANNEL_EVENT).findFirst().orElseThrow();
        assertThat(operation.actorName()).isEqualTo("discovery-tester (test)");
        assertThat(event.actorName()).isNull();
    }

    // =================================================================================
    // Helpers
    // =================================================================================

    /** A catalogue of {@code size} distinct listings, each with one SKU and one attribute. */
    private static List<ReportedListingSnapshot> catalogue(int size) {
        List<ReportedListingSnapshot> out = new ArrayList<>();
        for (int i = 1; i <= size; i++) {
            out.add(one("EXT-" + i, "Listing " + i, new BigDecimal("1000." + (i < 10 ? "0" + i : i))));
        }
        return out;
    }

    /** One reported listing carrying a status, so a channel event is produced. */
    private static ReportedListingSnapshot one(String ext, String title, BigDecimal price) {
        ReportedSkuSnapshot sku = new ReportedSkuSnapshot(
                "SKU-" + ext, price, true, null, false,
                (Instant) null, (Instant) null, false,
                new BigDecimal("7"), true, null);
        return new ReportedListingSnapshot(ext, title, true, "Description", true,
                price, true, null, false, null, null, false,
                new BigDecimal("7"), true, "1234", true, ListingStatus.ACTIVE,
                Map.of("brand", "Trioloo"), List.of(), false, List.of(sku));
    }

    private long count(String table) {
        Long value = jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
        return value == null ? 0L : value;
    }

    private List<String> distinct(String column) {
        return distinctOf("channel_listing_operation", column);
    }

    private List<String> distinctOf(String table, String column) {
        return jdbc.queryForList(
                "SELECT DISTINCT " + column + " FROM " + table + " ORDER BY 1", String.class);
    }

    /**
     * 🔴 {@code AGV-001} — the actor is resolved from the authenticated principal, never from a
     * parameter. The discovery batch's {@code requested_by} is exactly this identity.
     */
    private void actingAll() {
        actingWith(ProductPermissions.CHANNEL_LISTING_VIEW, ProductPermissions.CHANNEL_LISTING_MANAGE,
                ProductPermissions.CHANNEL_LISTING_PUBLISH, ProductPermissions.CHANNEL_LISTING_SYNC);
    }

    private void actingWith(String... permissions) {
        var authorities = java.util.Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList();
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actorId, "discovery-tester", "Discovery Tester", "unused",
                AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private void clearProductData() {
        for (String table : List.of("channel_listing_activity", "channel_listing_operation",
                "channel_listing_operation_batch", "channel_listing_highlight",
                "channel_listing_attribute", "channel_listing_reported_media",
                "channel_listing_intended_media", "sellable_product_media", "media_asset",
                "channel_listing_sku", "channel_listing", "channel_adapter_capability",
                "channel_instance", "bundle_member", "bom_line", "build_template",
                "sellable_product", "stock_reservation", "inventory_movement",
                "product_variant")) {
            jdbc.update("DELETE FROM " + table);
        }
    }
}
