package com.trioloo.erp.order.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionRepository;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Managed Channel Order ingestion — the §29 MVP operating rules, applied.
 *
 * <p>🔴 THIS SERVICE DECIDES HOW FAR BACK AND HOW OFTEN TRIOLOO READS, AND NOTHING ELSE.
 * {@code BR-183} — it creates no entity, no state, no transition, no event and no permission;
 * ingestion is the act {@code EVT-002 Order.Imported} already names. No order write reaches any
 * marketplace, no shipment or fulfilment action occurs, no inventory moves and nothing settles.
 *
 * <p>Two reads, and they are not interchangeable:
 * <ul>
 *   <li><b>Backfill</b> ({@code BR-178}) — walks BACKWARD in seven-day chunks to a three-month
 *       cap, opening with a boundary probe, and STOPS on refusal. Reads by creation window.</li>
 *   <li><b>Incremental</b> ({@code BR-179}) — the ordinary cadence read, by OVERLAPPING update
 *       watermark, deduplicated by {@code order_id}.</li>
 * </ul>
 */
@Service
public class ChannelOrderPullService {

    private static final Logger log = LoggerFactory.getLogger(ChannelOrderPullService.class);

    /**
     * 🔴 {@code BR-178.a} — the window is SEVEN DAYS and the cap is THREE MONTHS.
     *
     * <p>⚠ {@code BR-178.d} — a single three-month request is PROHIBITED. Not for politeness:
     * a request that silently truncates produces an incomplete backfill with no signal that it
     * happened, and Trioloo would have no way to know what it never received.
     */
    static final Duration BACKFILL_CHUNK = Duration.ofDays(7);
    static final Duration BACKFILL_CAP = Duration.ofDays(90);

    /**
     * 🔴 {@code BR-179.d} — the watermark OVERLAPS, and the overlap is deduplicated by
     * {@code order_id}. THIS IS NOT OPTIONAL AND IT IS NOT A TUNING CHOICE: no cursor exists
     * ({@code DZC-049.d}), and {@code update_after} inclusivity and timezone are UNSTATED by the
     * provider ({@code DZC-050.e}), so a non-overlapping watermark can silently miss an order at
     * the boundary.
     */
    static final Duration WATERMARK_OVERLAP = Duration.ofMinutes(30);

    private final JdbcTemplate jdbc;
    private final ChannelOrderImportService imports;
    private final ChannelConnectionRepository connections;
    private final CurrentActor currentActor;
    private final Clock clock;

    public ChannelOrderPullService(JdbcTemplate jdbc,
                                   ChannelOrderImportService imports,
                                   ChannelConnectionRepository connections,
                                   CurrentActor currentActor,
                                   Clock clock) {
        this.jdbc = jdbc;
        this.imports = imports;
        this.connections = connections;
        this.currentActor = currentActor;
        this.clock = clock == null ? Clock.systemUTC() : clock;
    }

    /**
     * The shops one scheduled sweep may read.
     *
     * <p>🔴 {@code BR-181} — MVP pulls from {@code ACTIVE} Daraz shops only, and a {@code DRAFT}
     * channel instance is excluded EVEN WHERE ITS CONNECTION IS {@code CONNECTED}. The two facts
     * are independent: a shop may be authorised against the marketplace while its own
     * configuration is unfinished ({@code SYS-108}).
     *
     * <p>✅ {@code BR-181.d} — eligibility is evaluated PER RUN, not frozen. A shop that becomes
     * {@code ACTIVE} becomes eligible without a rule change.
     */
    @Transactional(readOnly = true)
    public List<UUID> eligibleShops() {
        List<UUID> active = jdbc.queryForList("""
                SELECT id FROM channel_instance
                 WHERE upper(channel_type) = 'DARAZ'
                   AND upper(record_status) = 'ACTIVE'
                 ORDER BY code ASC
                """, UUID.class);
        return active.stream().filter(this::isConnected).toList();
    }

    private boolean isConnected(UUID channelInstanceId) {
        return connections.findByChannelInstanceIdIn(List.of(channelInstanceId)).stream()
                .anyMatch(connection -> connection.getState() == ConnectionState.CONNECTED);
    }

    /**
     * Operator-initiated pull. Requires {@code order.channel-order.sync} ({@code PRM-091}).
     *
     * <p>🔴 {@code OSC-044} — the gate lives HERE, in the application service, not in a
     * controller annotation. The server refuses independently of whether a control was hidden.
     */
    public PullOutcome pullAsOperator(UUID channelInstanceId) {
        Actor actor = currentActor.current()
                .filter(a -> a.hasPermission(OrderPermissions.CHANNEL_ORDER_SYNC))
                .orElseThrow(() -> new AccessDeniedByPermissionException(OrderPermissions.CHANNEL_ORDER_SYNC));
        return pull(channelInstanceId, Initiator.OPERATOR, actor.id());
    }

    /**
     * Scheduled pull. No operator is involved and none is invented.
     *
     * <p>🔴 THIS IS NOT A PERMISSION BYPASS. {@code SMA §5.4} registers {@code EVT-002
     * Order.Imported} as <em>Automatic / Scheduled</em> performed by the <em>Channel adapter</em>,
     * and {@code OM §17.1} registers System as a business actor. A scheduled read is that actor
     * performing a ratified automatic action; {@code PRM-091}'s capability gates what an
     * OPERATOR may initiate.
     *
     * <p>⚠ The run is attributed as {@code SYSTEM} at the moment it happens ({@code AGV-001}),
     * never left blank and never back-filled with a human who did not act.
     */
    PullOutcome pullAsSystem(UUID channelInstanceId) {
        return pull(channelInstanceId, Initiator.SYSTEM, null);
    }

    private PullOutcome pull(UUID channelInstanceId, Initiator initiator, UUID actorId) {
        State state = loadOrCreateState(channelInstanceId);

        // The backfill runs to completion before any incremental read: an incremental poll that
        // started while three months were still missing would advance the watermark past orders
        // the backfill had not yet reached.
        if (!state.backfillComplete()) {
            return backfillStep(channelInstanceId, state, initiator, actorId);
        }
        return incremental(channelInstanceId, state, initiator, actorId);
    }

    /* ------------------------------------------------------------------ backfill */

    private PullOutcome backfillStep(UUID channelInstanceId, State state,
                                     Initiator initiator, UUID actorId) {
        Instant now = Instant.now(clock);

        // 🔴 BR-178.b — the backfill OPENS with a boundary probe near the three-month edge. The
        // point is to LEARN the real limit before spending a long run against an assumed one.
        if (state.backfillCursor() == null) {
            Instant floor = now.minus(BACKFILL_CAP);
            Instant probeTo = floor.plus(Duration.ofDays(1));
            Run probe = start(channelInstanceId, Kind.BOUNDARY_PROBE, floor, probeTo, initiator, actorId);
            ChannelOrderImportService.ImportOutcome outcome =
                    imports.importWindowAsSystem(channelInstanceId, floor, probeTo);
            finish(probe, outcome);

            if (!outcome.complete()) {
                // 🔴 BR-178.c — a provider REFUSAL stops the backfill and is REPORTED. It is never
                // retried blind, because the refusal is the ANSWER: it names the retention
                // boundary the provider does not publish (DZC-050.a).
                recordRefusal(channelInstanceId, floor, outcome.failureDetail(), now);
                return new PullOutcome(Kind.BOUNDARY_PROBE, false, outcome,
                        "Backfill stopped at the boundary probe. The refusal is recorded, not retried.");
            }
            jdbc.update("""
                    UPDATE channel_order_pull_state
                       SET backfill_floor = ?, backfill_cursor = ?, last_run_at = ?,
                           version = version + 1
                     WHERE channel_instance_id = ?
                    """, ts(floor), ts(now), ts(now), channelInstanceId);
            return new PullOutcome(Kind.BOUNDARY_PROBE, true, outcome,
                    "Boundary probe accepted. The backward walk begins on the next run.");
        }

        // 🔴 BR-178.a — SEVEN-DAY CHUNKS, walked from MOST RECENT to OLDEST, all the way to the
        // cap within this one invocation.
        //
        // ⚠ THE CHUNKING IS THE RULE; SPREADING IT OVER CADENCE TICKS IS NOT. BR-178.a fixes the
        // WINDOW SIZE so that a request cannot silently truncate (BR-178.d) — it says nothing
        // about how many windows one run may walk. Walking them here is what makes the initial
        // three-month position available in one pass instead of after a dozen cadence ticks.
        //
        // 🔴 The loop is BOUNDED by the cap and STOPS on the first refusal (BR-178.c). It is not
        // a retry loop: BR-182.a's prohibition is about re-attempting a FAILED window, and no
        // window is ever attempted twice here.
        Instant floor = state.backfillFloor() == null ? now.minus(BACKFILL_CAP) : state.backfillFloor();
        Instant chunkTo = state.backfillCursor();
        int chunks = 0;
        /*
          🔴 THE WALK'S TOTALS ARE ACCUMULATED, NOT TAKEN FROM THE LAST CHUNK.

          ⚠ The first production run exposed exactly this defect: a shop imported 103 orders
          across thirteen chunks and the summary reported `seen=0`, because the OLDEST window —
          the last one walked — happened to be empty. The per-chunk run records were correct
          throughout; only the roll-up lied, which is the more dangerous failure because it is
          the line an operator actually reads (SYS-034 — a figure must not misstate what happened).
        */
        Accumulator totals = new Accumulator();

        while (chunkTo.isAfter(floor)) {
            Instant chunkFrom = chunkTo.minus(BACKFILL_CHUNK);
            if (chunkFrom.isBefore(floor)) {
                chunkFrom = floor;
            }

            Run run = start(channelInstanceId, Kind.BACKFILL_CHUNK, chunkFrom, chunkTo, initiator, actorId);
            ChannelOrderImportService.ImportOutcome outcome =
                    imports.importWindowAsSystem(channelInstanceId, chunkFrom, chunkTo);
            finish(run, outcome);
            totals.add(outcome);
            chunks++;

            if (!outcome.complete()) {
                // ✅ BR-182.c — every chunk already absorbed is RETAINED. The cursor is advanced
                // to where the walk actually reached, so nothing that succeeded is re-read.
                jdbc.update("""
                        UPDATE channel_order_pull_state SET backfill_cursor = ?, version = version + 1
                         WHERE channel_instance_id = ?
                        """, ts(chunkTo), channelInstanceId);
                recordRefusal(channelInstanceId, chunkFrom, outcome.failureDetail(), now);
                return new PullOutcome(Kind.BACKFILL_CHUNK, false,
                        totals.toOutcome(false, outcome.failureDetail()),
                        "Backfill walked " + chunks + " chunk(s) and stopped at " + chunkFrom
                                + ". The refusal is recorded, not retried.");
            }

            chunkTo = chunkFrom;
            jdbc.update("""
                    UPDATE channel_order_pull_state SET backfill_cursor = ?, version = version + 1
                     WHERE channel_instance_id = ?
                    """, ts(chunkTo), channelInstanceId);
        }

        jdbc.update("""
                UPDATE channel_order_pull_state
                   SET backfill_complete = true, last_run_at = ?,
                       update_watermark = COALESCE(update_watermark, ?),
                       version = version + 1
                 WHERE channel_instance_id = ?
                """, ts(now), ts(now), channelInstanceId);

        return new PullOutcome(Kind.BACKFILL_CHUNK, true, totals.toOutcome(true, null),
                "Backfill complete to the three-month cap after " + chunks
                        + " chunk(s). Incremental polling takes over.");
    }

    /* --------------------------------------------------------------- incremental */

    private PullOutcome incremental(UUID channelInstanceId, State state,
                                    Initiator initiator, UUID actorId) {
        Instant now = Instant.now(clock);
        Instant watermark = state.updateWatermark() == null
                ? now.minus(BACKFILL_CAP)
                : state.updateWatermark();

        // 🔴 BR-179.d — the watermark is applied WITH AN OVERLAP. Re-reading the overlap costs a
        // page; missing an order at an inclusivity boundary the provider never documented costs
        // the order. Duplicates are absorbed by order_id (SYS-045, API-024, EVA-016).
        Instant from = watermark.minus(WATERMARK_OVERLAP);

        Run run = start(channelInstanceId, Kind.INCREMENTAL, from, now, initiator, actorId);
        ChannelOrderImportService.ImportOutcome outcome =
                imports.importUpdatedSinceAsSystem(channelInstanceId, from);
        finish(run, outcome);

        if (!outcome.complete()) {
            // 🔴 BR-182 — a failed page stops the job, is RECORDED, and is retried on the NEXT
            // scheduled cycle. There is no in-job retry loop: against an unpublished rate limit
            // (DZC-050.b) that is the behaviour most likely to turn a transient failure into a
            // throttle. ✅ BR-182.c — partial success is RETAINED and never rolled back.
            jdbc.update("""
                    UPDATE channel_order_pull_state SET last_run_at = ?, version = version + 1
                     WHERE channel_instance_id = ?
                    """, ts(now), channelInstanceId);
            return new PullOutcome(Kind.INCREMENTAL, false, outcome,
                    "Read failed and is recorded. It is retried on the next cycle; nothing is lost by waiting.");
        }

        // The watermark only advances on a COMPLETE read. Advancing it after a partial one would
        // move the window past orders that were never seen.
        jdbc.update("""
                UPDATE channel_order_pull_state
                   SET update_watermark = ?, last_run_at = ?, version = version + 1
                 WHERE channel_instance_id = ?
                """, ts(now), ts(now), channelInstanceId);
        return new PullOutcome(Kind.INCREMENTAL, true, outcome, "Incremental read complete.");
    }

    /* --------------------------------------------------------------- persistence */

    private State loadOrCreateState(UUID channelInstanceId) {
        jdbc.update("""
                INSERT INTO channel_order_pull_state (channel_instance_id)
                VALUES (?) ON CONFLICT (channel_instance_id) DO NOTHING
                """, channelInstanceId);
        return jdbc.queryForObject("""
                SELECT update_watermark, backfill_floor, backfill_cursor, backfill_complete
                  FROM channel_order_pull_state WHERE channel_instance_id = ?
                """, (rs, rowNum) -> new State(
                        instant(rs.getTimestamp("update_watermark")),
                        instant(rs.getTimestamp("backfill_floor")),
                        instant(rs.getTimestamp("backfill_cursor")),
                        rs.getBoolean("backfill_complete")),
                channelInstanceId);
    }

    /**
     * Records the refusal and stops.
     *
     * <p>⚠ {@code BR-178.e} — the discovered limit is recorded WHEN IT IS FOUND. 🔴 It is a
     * PROVIDER fact and belongs in {@code DZC §12}, carried there by a person; nothing infers it
     * here.
     */
    private void recordRefusal(UUID channelInstanceId, Instant refusedFrom, String detail, Instant now) {
        jdbc.update("""
                UPDATE channel_order_pull_state
                   SET backfill_refused_at = ?, backfill_refused_from = ?,
                       backfill_refusal_detail = ?, backfill_complete = true,
                       last_run_at = ?, version = version + 1
                 WHERE channel_instance_id = ?
                """, ts(now), ts(refusedFrom), detail, ts(now), channelInstanceId);
        log.warn("Channel order backfill refused for shop {} at {}: {}. Recorded and NOT retried "
                + "(BR-178.c). The refusal names the retention boundary the provider does not "
                + "publish and belongs in DZC §12.", channelInstanceId, refusedFrom, detail);
    }

    /**
     * Opens the run record in its OWN transaction.
     *
     * <p>🔴 {@code BR-182.d} — the failure is recorded as a FACT. If the record shared the
     * import's transaction, a rollback would erase the very evidence the rule exists to keep.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    Run start(UUID channelInstanceId, Kind kind, Instant from, Instant to,
              Initiator initiator, UUID actorId) {
        UUID id = Optional.ofNullable(jdbc.queryForObject("""
                INSERT INTO channel_order_pull_run (channel_instance_id, kind, window_from,
                        window_to, started_at, initiated_by, initiated_by_user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """, UUID.class, channelInstanceId, kind.name(), ts(from), ts(to),
                ts(Instant.now(clock)), initiator.name(), actorId)).orElseThrow();
        return new Run(id);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void finish(Run run, ChannelOrderImportService.ImportOutcome outcome) {
        jdbc.update("""
                UPDATE channel_order_pull_run
                   SET finished_at = ?, complete = ?, pages_read = ?, orders_seen = ?,
                       orders_created = ?, orders_updated = ?, items_seen = ?, failure_detail = ?
                 WHERE id = ?
                """, ts(Instant.now(clock)), outcome.complete(), outcome.pagesRead(),
                outcome.ordersSeen(), outcome.ordersCreated(), outcome.ordersUpdated(),
                outcome.itemsSeen(), outcome.failureDetail(), run.id());
    }

    private static Timestamp ts(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private static Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    public enum Kind { BOUNDARY_PROBE, BACKFILL_CHUNK, INCREMENTAL }

    enum Initiator { SYSTEM, OPERATOR }

    record Run(UUID id) {}

    /** Sums a multi-chunk walk so the roll-up describes the WALK, not its final window. */
    private static final class Accumulator {
        private int pages;
        private int seen;
        private int created;
        private int updated;
        private int items;

        void add(ChannelOrderImportService.ImportOutcome outcome) {
            pages += outcome.pagesRead();
            seen += outcome.ordersSeen();
            created += outcome.ordersCreated();
            updated += outcome.ordersUpdated();
            items += outcome.itemsSeen();
        }

        ChannelOrderImportService.ImportOutcome toOutcome(boolean complete, String failureDetail) {
            return new ChannelOrderImportService.ImportOutcome(
                    complete, pages, seen, created, updated, items, 0, 0, failureDetail);
        }
    }

    record State(Instant updateWatermark, Instant backfillFloor, Instant backfillCursor,
                 boolean backfillComplete) {}

    public record PullOutcome(Kind kind, boolean complete,
                              ChannelOrderImportService.ImportOutcome imported, String detail) {}
}
