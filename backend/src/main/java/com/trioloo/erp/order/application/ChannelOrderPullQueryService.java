package com.trioloo.erp.order.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Reads the ingestion position and the run history for one shop.
 *
 * <p>🔴 {@code BR-182.d} — a failure is recorded as a FACT, and this is what makes it visible.
 * A run nobody can read is only a log line.
 *
 * <p>⚠ Read-only. It starts nothing, retries nothing and changes no watermark.
 */
@Service
public class ChannelOrderPullQueryService {

    private static final int RECENT_RUNS = 20;

    private final JdbcTemplate jdbc;
    private final CurrentActor currentActor;

    public ChannelOrderPullQueryService(JdbcTemplate jdbc, CurrentActor currentActor) {
        this.jdbc = jdbc;
        this.currentActor = currentActor;
    }

    @Transactional(readOnly = true)
    public PullState forShop(UUID channelInstanceId) {
        if (currentActor.current().filter(a -> a.hasPermission(OrderPermissions.CHANNEL_ORDER_VIEW)).isEmpty()) {
            throw new AccessDeniedByPermissionException(OrderPermissions.CHANNEL_ORDER_VIEW);
        }
        if (channelInstanceId == null) {
            throw new ChannelOrderImportException("A channel instance id is required.");
        }

        List<Position> found = jdbc.query("""
                SELECT update_watermark, backfill_floor, backfill_cursor, backfill_complete,
                       backfill_refused_at, backfill_refused_from, backfill_refusal_detail, last_run_at
                  FROM channel_order_pull_state
                 WHERE channel_instance_id = ?
                """, (rs, rowNum) -> new Position(
                        instant(rs.getTimestamp("update_watermark")),
                        instant(rs.getTimestamp("backfill_floor")),
                        instant(rs.getTimestamp("backfill_cursor")),
                        rs.getBoolean("backfill_complete"),
                        instant(rs.getTimestamp("backfill_refused_at")),
                        instant(rs.getTimestamp("backfill_refused_from")),
                        rs.getString("backfill_refusal_detail"),
                        instant(rs.getTimestamp("last_run_at"))),
                channelInstanceId);

        List<RunRecord> runs = jdbc.query("""
                SELECT id, kind, window_from, window_to, started_at, finished_at, complete,
                       pages_read, orders_seen, orders_created, orders_updated, items_seen,
                       failure_detail, initiated_by
                  FROM channel_order_pull_run
                 WHERE channel_instance_id = ?
                 ORDER BY started_at DESC
                 LIMIT ?
                """, (rs, rowNum) -> new RunRecord(
                        (UUID) rs.getObject("id"), rs.getString("kind"),
                        instant(rs.getTimestamp("window_from")), instant(rs.getTimestamp("window_to")),
                        instant(rs.getTimestamp("started_at")), instant(rs.getTimestamp("finished_at")),
                        rs.getBoolean("complete"), rs.getInt("pages_read"), rs.getInt("orders_seen"),
                        rs.getInt("orders_created"), rs.getInt("orders_updated"), rs.getInt("items_seen"),
                        rs.getString("failure_detail"), rs.getString("initiated_by")),
                channelInstanceId, RECENT_RUNS);

        // ⚠ A shop that has never been polled has NO position. That is an absence, and it is
        // reported as one rather than as a row of zeros (SYS-034, BR-134).
        return new PullState(channelInstanceId, found.stream().findFirst().orElse(null), runs);
    }

    private static Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    public record PullState(UUID channelInstanceId, Position position, List<RunRecord> recentRuns) {}

    public record Position(Instant updateWatermark, Instant backfillFloor, Instant backfillCursor,
                           boolean backfillComplete, Instant backfillRefusedAt,
                           Instant backfillRefusedFrom, String backfillRefusalDetail,
                           Instant lastRunAt) {}

    public record RunRecord(UUID id, String kind, Instant windowFrom, Instant windowTo,
                            Instant startedAt, Instant finishedAt, boolean complete,
                            int pagesRead, int ordersSeen, int ordersCreated, int ordersUpdated,
                            int itemsSeen, String failureDetail, String initiatedBy) {}
}
