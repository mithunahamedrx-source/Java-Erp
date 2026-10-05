package com.trioloo.erp.order.application;

import com.trioloo.erp.order.domain.CanonicalOrderStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * After the ERP acts on an order, tells the order's channel - but only where the channel is the company's own
 * storefront ({@link ChannelOrderWriteback}). 🔴 BEST EFFORT, AND NEVER THE ERP'S OUTCOME: the ERP has already
 * acted, so a failure here becomes a note for the operator and a log line, not an exception.
 */
@Service
public class OrderWritebackService {

    private static final Logger log = LoggerFactory.getLogger(OrderWritebackService.class);

    private final JdbcTemplate jdbc;
    private final List<ChannelOrderWriteback> writebacks;

    public OrderWritebackService(JdbcTemplate jdbc, List<ChannelOrderWriteback> writebacks) {
        this.jdbc = jdbc;
        this.writebacks = writebacks == null ? List.of() : List.copyOf(writebacks);
    }

    /** What happened, for the operator: {@code supported} is false for a channel that is never written to. */
    public record Result(boolean supported, String note) {
        static Result unsupported() {
            return new Result(false, null);
        }
    }

    public Result publish(UUID orderId, CanonicalOrderStatus status, String actionWord) {
        Optional<Row> row = jdbc.query("""
                SELECT upper(ci.channel_type) AS channel_type, o.external_order_id
                  FROM channel_order o JOIN channel_instance ci ON ci.id = o.channel_instance_id
                 WHERE o.id = ?
                """, rs -> rs.next()
                ? Optional.of(new Row(rs.getString("channel_type"), rs.getString("external_order_id")))
                : Optional.<Row>empty(), orderId);
        if (row.isEmpty()) {
            return Result.unsupported();
        }
        Optional<ChannelOrderWriteback> target = writebacks.stream()
                .filter(w -> w.channelType().equalsIgnoreCase(row.get().channelType()))
                .findFirst();
        if (target.isEmpty()) {
            return Result.unsupported();
        }
        try {
            target.get().publish(row.get().externalOrderId(), status);
            return new Result(true, "The website order was " + actionWord + " too.");
        } catch (RuntimeException e) {
            log.warn("Website order {} could not be updated to {}: {}", row.get().externalOrderId(), status, e.getMessage());
            return new Result(true, "The website was NOT updated (" + e.getMessage()
                    + ") - change this order in the website admin panel yourself.");
        }
    }

    private record Row(String channelType, String externalOrderId) {
    }
}
