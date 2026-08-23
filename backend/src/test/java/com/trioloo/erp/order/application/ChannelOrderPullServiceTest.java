package com.trioloo.erp.order.application;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionEntity;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionRepository;
import com.trioloo.erp.order.domain.CanonicalOrderStatus;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The §29 MVP ingestion rules, exercised.
 *
 * <p>⚠ The stub provider records the WINDOWS it was asked for, because most of §29 is about
 * which window is requested and in what order — not about what comes back.
 */
@SpringBootTest
@DisplayName("OM §29 - managed Channel Order ingestion")
class ChannelOrderPullServiceTest {

    /** Every creation window the service asked for, in order. */
    private static final List<Window> CREATED_WINDOWS = new ArrayList<>();
    /** Every update watermark the service asked for, in order. */
    private static final List<Instant> UPDATE_WINDOWS = new ArrayList<>();
    private static boolean refuse;
    /** How many orders the FIRST creation-window read returns; later ones return none. */
    private static int ordersOnFirstChunkOnly;

    record Window(Instant after, Instant before) {}

    @TestConfiguration
    static class ProviderConfig {
        @Bean
        ChannelOrderProvider channelOrderPullTestProvider() {
            return new ChannelOrderProvider() {
                @Override
                public String channelType() {
                    return "DARAZ";
                }

                @Override
                public Page listOrders(UUID channelInstanceId, Instant createdAfter, Instant createdBefore,
                                       int offset, int limit) {
                    CREATED_WINDOWS.add(new Window(createdAfter, createdBefore));
                    if (refuse) {
                        throw new ChannelOrderImportException("Provider refused the window.");
                    }
                    // The probe is call 1; the walk's first chunk is call 2.
                    if (ordersOnFirstChunkOnly > 0 && CREATED_WINDOWS.size() == 2) {
                        List<ChannelOrderSnapshot> orders = new ArrayList<>();
                        for (int i = 0; i < ordersOnFirstChunkOnly; i++) {
                            orders.add(order("WALK-" + i));
                        }
                        return new Page(orders.size(), orders.size(), orders);
                    }
                    return new Page(0, 0, List.of());
                }

                @Override
                public Page listOrdersUpdatedSince(UUID channelInstanceId, Instant updatedAfter,
                                                   int offset, int limit) {
                    UPDATE_WINDOWS.add(updatedAfter);
                    if (refuse) {
                        throw new ChannelOrderImportException("Provider refused the read.");
                    }
                    return new Page(0, 0, List.of());
                }

                @Override
                public List<CanonicalOrderStatus> canonicalStatuses(List<String> channelStatuses) {
                    return List.of();
                }
            };
        }
    }

    @Autowired private ChannelOrderPullService pulls;
    @Autowired private ChannelOrderPullQueryService pullQueries;
    @Autowired private ChannelConnectionRepository connections;
    @Autowired private JdbcTemplate jdbc;

    private UUID shop;

    @BeforeEach
    void setUp() {
        clean();
        CREATED_WINDOWS.clear();
        UPDATE_WINDOWS.clear();
        refuse = false;
        ordersOnFirstChunkOnly = 0;
        actingWith(OrderPermissions.CHANNEL_ORDER_SYNC, OrderPermissions.CHANNEL_ORDER_VIEW);
        shop = insertShop("ORDER-PULL-A", "ACTIVE");
        connections.save(ChannelConnectionEntity.observed(shop, ConnectionState.CONNECTED, Instant.now()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clean();
        CREATED_WINDOWS.clear();
        UPDATE_WINDOWS.clear();
        refuse = false;
    }

    @Test
    @DisplayName("BR-178.b - the backfill OPENS with a boundary probe near the three-month edge")
    void backfillOpensWithABoundaryProbe() {
        ChannelOrderPullService.PullOutcome outcome = pulls.pullAsOperator(shop);

        assertThat(outcome.kind()).isEqualTo(ChannelOrderPullService.Kind.BOUNDARY_PROBE);
        assertThat(CREATED_WINDOWS).hasSize(1);

        // The probe sits at the three-month edge: learn the real limit before spending a long
        // run against an assumed one.
        Window probe = CREATED_WINDOWS.getFirst();
        Duration age = Duration.between(probe.after(), Instant.now());
        assertThat(age).isCloseTo(ChannelOrderPullService.BACKFILL_CAP, Duration.ofMinutes(5));
        // 🔴 BR-178.d — it is a NARROW probe, never a single three-month request.
        assertThat(Duration.between(probe.after(), probe.before()))
                .isLessThan(ChannelOrderPullService.BACKFILL_CHUNK);
    }

    @Test
    @DisplayName("BR-178.a - the walk is BACKWARD in seven-day chunks, never one three-month request")
    void backfillWalksBackwardInSevenDayChunks() {
        pulls.pullAsOperator(shop);   // boundary probe
        CREATED_WINDOWS.clear();
        pulls.pullAsOperator(shop);   // the whole backward walk

        // 90 days in 7-day chunks is thirteen chunks, the last one clipped at the floor.
        assertThat(CREATED_WINDOWS).hasSizeGreaterThanOrEqualTo(13);

        Window first = CREATED_WINDOWS.getFirst();
        Window second = CREATED_WINDOWS.get(1);
        assertThat(Duration.between(first.after(), first.before()))
                .isEqualTo(ChannelOrderPullService.BACKFILL_CHUNK);
        // Backward: each chunk ends where the previous one began, with no gap between them.
        assertThat(second.before()).isEqualTo(first.after());
        assertThat(second.after()).isBefore(first.after());

        // 🔴 BR-178.d — NO REQUEST EVER SPANS MORE THAN THE CHUNK. This is the rule that stops a
        // silently truncated response producing an incomplete backfill with no signal.
        for (Window window : CREATED_WINDOWS) {
            assertThat(Duration.between(window.after(), window.before()))
                    .isLessThanOrEqualTo(ChannelOrderPullService.BACKFILL_CHUNK);
        }

        // The walk reaches the cap and stops there — it never reads past three months.
        Window last = CREATED_WINDOWS.getLast();
        assertThat(Duration.between(last.after(), Instant.now()))
                .isCloseTo(ChannelOrderPullService.BACKFILL_CAP, Duration.ofMinutes(5));

        // And the next invocation is incremental, not another backfill.
        assertThat(pulls.pullAsOperator(shop).kind())
                .isEqualTo(ChannelOrderPullService.Kind.INCREMENTAL);
    }

    @Test
    @DisplayName("the walk's roll-up sums every chunk, not just the last one")
    void backfillRollUpSumsTheWholeWalk() {
        // 🔴 The defect this locks: the first production run imported 103 orders across thirteen
        // chunks and reported `seen=0`, because the OLDEST window — walked last — was empty.
        // Here the FIRST chunk carries orders and the rest are empty, reproducing that shape.
        ordersOnFirstChunkOnly = 3;

        pulls.pullAsOperator(shop);                                  // boundary probe
        ChannelOrderPullService.PullOutcome walk = pulls.pullAsOperator(shop);

        assertThat(walk.complete()).isTrue();
        assertThat(walk.imported().ordersSeen()).isEqualTo(3);
        assertThat(walk.imported().ordersCreated()).isEqualTo(3);
        // The roll-up must also describe the whole walk's paging, not one window's.
        assertThat(walk.imported().pagesRead()).isGreaterThanOrEqualTo(13);
    }

    @Test
    @DisplayName("BR-178.c - a refusal STOPS the backfill, is recorded, and is never retried blind")
    void refusalStopsTheBackfillAndIsRecorded() {
        refuse = true;
        ChannelOrderPullService.PullOutcome outcome = pulls.pullAsOperator(shop);

        assertThat(outcome.complete()).isFalse();
        int callsAtRefusal = CREATED_WINDOWS.size();

        // The refusal is the ANSWER — it names the retention boundary the provider does not
        // publish (DZC-050.a) — so the position records it rather than trying again.
        ChannelOrderPullQueryService.PullState state = pullQueries.forShop(shop);
        assertThat(state.position().backfillRefusedAt()).isNotNull();
        assertThat(state.position().backfillRefusalDetail()).isNotBlank();

        // 🔴 A further invocation does NOT re-attempt the refused backfill window.
        refuse = false;
        pulls.pullAsOperator(shop);
        assertThat(CREATED_WINDOWS).hasSize(callsAtRefusal);
    }

    @Test
    @DisplayName("BR-179.c/.d - the incremental read is by an OVERLAPPING update watermark")
    void incrementalReadOverlapsTheWatermark() {
        completeBackfill();

        pulls.pullAsOperator(shop);
        assertThat(UPDATE_WINDOWS).hasSize(1);
        Instant firstFrom = UPDATE_WINDOWS.getFirst();

        pulls.pullAsOperator(shop);
        assertThat(UPDATE_WINDOWS).hasSize(2);
        Instant secondFrom = UPDATE_WINDOWS.get(1);

        // 🔴 The second read starts BEFORE the first finished. No cursor exists (DZC-049.d) and
        // `update_after` inclusivity and timezone are UNSTATED (DZC-050.e), so a non-overlapping
        // watermark can silently miss an order at the boundary.
        assertThat(secondFrom).isAfter(firstFrom);
        assertThat(Duration.between(secondFrom, Instant.now()))
                .isGreaterThanOrEqualTo(ChannelOrderPullService.WATERMARK_OVERLAP.minusMinutes(1));
    }

    @Test
    @DisplayName("a failed incremental read does NOT advance the watermark")
    void failedReadDoesNotAdvanceTheWatermark() {
        completeBackfill();
        pulls.pullAsOperator(shop);
        Instant watermarkAfterSuccess = pullQueries.forShop(shop).position().updateWatermark();

        refuse = true;
        ChannelOrderPullService.PullOutcome outcome = pulls.pullAsOperator(shop);

        assertThat(outcome.complete()).isFalse();
        // ⚠ Advancing past orders that were never seen is how a poll loses them permanently.
        assertThat(pullQueries.forShop(shop).position().updateWatermark())
                .isEqualTo(watermarkAfterSuccess);
    }

    @Test
    @DisplayName("BR-181 - a DRAFT shop is excluded even where its connection is CONNECTED")
    void draftShopIsNotEligible() {
        UUID draft = insertShop("ORDER-PULL-DRAFT", "DRAFT");
        connections.save(ChannelConnectionEntity.observed(draft, ConnectionState.CONNECTED, Instant.now()));

        // The two facts are independent: a shop may be authorised against the marketplace while
        // its own configuration is unfinished (SYS-108). Admitting DRAFT is a separate business
        // decision and BR-181.c does not take it.
        assertThat(pulls.eligibleShops()).contains(shop).doesNotContain(draft);
    }

    @Test
    @DisplayName("BR-181.c - admitting DRAFT shops is OFF by default, so the rule is the shipped behaviour")
    void draftAdmissionIsOffByDefault() {
        UUID draft = insertShop("ORDER-PULL-DRAFT2", "DRAFT");
        connections.save(ChannelConnectionEntity.observed(draft, ConnectionState.CONNECTED, Instant.now()));

        // 🔴 The default property is false, so this service instance behaves exactly as BR-181
        // specifies. Admitting DRAFT is a business decision expressed as configuration, never a
        // silent widening.
        assertThat(pulls.eligibleShops()).doesNotContain(draft);
    }

    @Test
    @DisplayName("BR-181 - an ACTIVE shop that is not CONNECTED is not eligible either")
    void unconnectedShopIsNotEligible() {
        UUID unconnected = insertShop("ORDER-PULL-UNCONNECTED", "ACTIVE");
        assertThat(pulls.eligibleShops()).doesNotContain(unconnected);
    }

    @Test
    @DisplayName("PRM-091 - an operator without order.channel-order.sync is refused")
    void operatorPullRequiresSyncPermission() {
        actingWith(OrderPermissions.CHANNEL_ORDER_VIEW);

        assertThatThrownBy(() -> pulls.pullAsOperator(shop))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(OrderPermissions.CHANNEL_ORDER_SYNC);
        assertThat(CREATED_WINDOWS).isEmpty();
    }

    @Test
    @DisplayName("BR-182.d - every run is recorded as a fact, with its initiator")
    void everyRunIsRecordedWithItsInitiator() {
        pulls.pullAsOperator(shop);

        ChannelOrderPullQueryService.PullState state = pullQueries.forShop(shop);
        assertThat(state.recentRuns()).hasSize(1);
        ChannelOrderPullQueryService.RunRecord run = state.recentRuns().getFirst();
        assertThat(run.kind()).isEqualTo("BOUNDARY_PROBE");
        // 🔴 AGV-001 — attribution captured when the action occurred, never reconstructed.
        assertThat(run.initiatedBy()).isEqualTo("OPERATOR");
        assertThat(run.finishedAt()).isNotNull();
    }

    @Test
    @DisplayName("a shop never polled reports an ABSENT position, not a row of zeros")
    void neverPolledShopReportsAbsence() {
        UUID fresh = insertShop("ORDER-PULL-FRESH", "ACTIVE");
        ChannelOrderPullQueryService.PullState state = pullQueries.forShop(fresh);

        // SYS-034 / BR-134 — absent is not empty and is not zero.
        assertThat(state.position()).isNull();
        assertThat(state.recentRuns()).isEmpty();
    }

    /** The minimum a snapshot needs: an identity and a status. Everything else is absent. */
    private static ChannelOrderSnapshot order(String externalId) {
        return new ChannelOrderSnapshot(
                externalId, "ORD-" + externalId,      // identity
                null, null,                            // provider created / updated
                null, null, null, null, null,          // price + shipping money
                null, null, null, null,                // vouchers, cash payment fee
                null, null, 1,                         // payment method, voucher code, items count
                List.of("pending"),                    // statuses
                null, null, null, null, null,          // promised, warehouse, delivery, notes
                null, null, null, null, null, null,    // gift, regional, extra
                null, null,                            // customer names
                null, null, List.of());                // addresses, items
    }

    /** Drives the backfill to completion so the incremental path is reachable. */
    private void completeBackfill() {
        for (int i = 0; i < 5; i++) {
            ChannelOrderPullService.PullOutcome outcome = pulls.pullAsOperator(shop);
            if (outcome.kind() == ChannelOrderPullService.Kind.INCREMENTAL) {
                UPDATE_WINDOWS.clear();
                return;
            }
        }
        throw new IllegalStateException("Backfill did not complete within the three-month cap.");
    }

    private UUID insertShop(String code, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type, record_status, market)
                VALUES (?, ?, ?, 'DARAZ', ?, 'BANGLADESH')
                """, id, code, code, status);
        return id;
    }

    private void actingWith(String... permissions) {
        var details = new AccessUserDetails(UUID.randomUUID(), "pull-tester", "hash",
                "Pull Tester", AccountLifecycleState.ACTIVE, Set.<String>of(), Set.of(permissions));
        var authorities = List.of(permissions).stream().map(SimpleGrantedAuthority::new).toList();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(details, "n/a", authorities));
    }

    private void clean() {
        // The roll-up test imports real snapshots, so orders must go before their shop.
        jdbc.update("""
                DELETE FROM channel_order_item WHERE channel_order_id IN (
                    SELECT id FROM channel_order WHERE channel_instance_id IN (
                        SELECT id FROM channel_instance WHERE code LIKE 'ORDER-PULL-%'))
                """);
        jdbc.update("""
                DELETE FROM channel_order WHERE channel_instance_id IN (
                    SELECT id FROM channel_instance WHERE code LIKE 'ORDER-PULL-%')
                """);
        jdbc.update("""
                DELETE FROM channel_order_pull_run WHERE channel_instance_id IN (
                    SELECT id FROM channel_instance WHERE code LIKE 'ORDER-PULL-%')
                """);
        jdbc.update("""
                DELETE FROM channel_order_pull_state WHERE channel_instance_id IN (
                    SELECT id FROM channel_instance WHERE code LIKE 'ORDER-PULL-%')
                """);
        jdbc.update("""
                DELETE FROM channel_connection WHERE channel_instance_id IN (
                    SELECT id FROM channel_instance WHERE code LIKE 'ORDER-PULL-%')
                """);
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'ORDER-PULL-%'");
    }
}
