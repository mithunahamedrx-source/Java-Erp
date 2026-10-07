package com.trioloo.erp.procurement.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.platform.money.MonetaryAmount;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * E-030 Goods Receipt - what arrived, line by line, and what was accepted into stock ({@code PRC-003}, {@code PRC-030},
 * {@code PRC-036}, {@code PRC-071}).
 *
 * <p>🔴 Accepted quantity enters stock as an {@code inventory_movement} of type {@code GOODS_RECEIPT_ACCEPTED} carrying the
 * unit cost, and that movement alone moves stock and feeds the weighted average ({@code IVN-038}, {@code ICO-001},
 * {@code PRC-046}); no stock level or cost is stored here ({@code DB-001}). Goods not accepted are explained by one of the four
 * discrepancy types, are held, and enter neither stock nor any cost ({@code PRC-034}).
 *
 * <p>🔴 No state machine ({@code PRC-037}) and no edit: a receipt is a record of one decision. A purchase order is optional
 * ({@code PRC-018}); where one exists, accepted quantity never exceeds what is still to come ({@code PRC-040} - excess is a
 * discrepancy, accepted only by agreement, which is not built yet).
 *
 * <p>🔴 It creates NO supplier payable: that follows acceptance later ({@code PRC-047}). Recording and accepting are separate
 * capabilities ({@code PRC-036}): a person who may only record can record what arrived but accept nothing.
 */
@Service
public class GoodsReceiptService {

    public static final String VIEW = "procurement.goods-receipt.view";
    public static final String RECORD = "procurement.goods-receipt.record";
    public static final String ACCEPT = "procurement.goods-receipt.accept";
    private static final Set<String> DISCREPANCIES = Set.of("SHORTAGE", "WRONG_ITEM", "DAMAGED", "EXCESS");
    private static final Set<String> RECEIVABLE = Set.of("APPROVED", "SENT", "PARTIALLY_RECEIVED");
    private static final String CURRENCY = "BDT";

    public record Row(UUID id, String receiptNumber, UUID supplierId, String supplierName, UUID purchaseOrderId, String poNumber,
                      LocalDate receivedDate, String supplierInvoiceReference, long lines,
                      @MonetaryAmount BigDecimal unitsReceived, @MonetaryAmount BigDecimal unitsAccepted, boolean hasIssues,
                      @MonetaryAmount BigDecimal acceptedValue, String currency, String recordedBy, String acceptedBy, Instant recordedAt) {
    }

    public record Item(UUID id, int lineNumber, UUID productVariantId, String sku, String name, Integer poLineNumber,
                       @MonetaryAmount BigDecimal quantityReceived, @MonetaryAmount BigDecimal quantityAccepted,
                       @MonetaryAmount BigDecimal unitCost, @MonetaryAmount BigDecimal acceptedValue,
                       String discrepancyType, String discrepancyNote) {
    }

    public record Detail(Row receipt, String warehouseName, String note, List<Item> items) {
    }

    public record Kpis(long receipts, long lines, @MonetaryAmount BigDecimal unitsAccepted, long withIssues) {
    }

    public record Page(List<Row> content, long totalElements, int page, int size, int totalPages, Kpis kpis) {
    }

    /** A purchase order line as the receipt form needs it: what is still to come. */
    public record OrderLine(UUID purchaseOrderItemId, int lineNumber, UUID productVariantId, String sku, String name,
                            @MonetaryAmount BigDecimal ordered, @MonetaryAmount BigDecimal accepted, @MonetaryAmount BigDecimal remaining,
                            @MonetaryAmount BigDecimal unitCost) {
    }

    public record ReceivableOrder(UUID id, String poNumber, UUID supplierId, String supplierName, LocalDate orderDate, String status) {
    }

    public record ItemInput(UUID purchaseOrderItemId, UUID productVariantId, BigDecimal quantityReceived, BigDecimal quantityAccepted,
                            BigDecimal unitCost, String discrepancyType, String discrepancyNote) {
    }

    public record Input(UUID supplierId, UUID purchaseOrderId, UUID warehouseId, LocalDate receivedDate, String supplierInvoiceReference,
                        String note, List<ItemInput> items) {
    }

    private final JdbcTemplate jdbc;
    private final CurrentActor currentActor;

    public GoodsReceiptService(JdbcTemplate jdbc, CurrentActor currentActor) {
        this.jdbc = jdbc;
        this.currentActor = currentActor;
    }

    private Actor require(String permission) {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(permission)) {
            throw new AccessDeniedByPermissionException(permission);
        }
        return actor;
    }

    private static final String ROW_SELECT = """
            SELECT g.id, g.receipt_number, g.supplier_id, s.name AS supplier_name, g.purchase_order_id, p.po_number, g.received_date,
                   g.supplier_invoice_reference, g.currency, g.recorded_at,
                   (SELECT count(*) FROM goods_receipt_item i WHERE i.goods_receipt_id = g.id) AS lines,
                   coalesce((SELECT sum(i.quantity_received) FROM goods_receipt_item i WHERE i.goods_receipt_id = g.id), 0) AS units_received,
                   coalesce((SELECT sum(i.quantity_accepted) FROM goods_receipt_item i WHERE i.goods_receipt_id = g.id), 0) AS units_accepted,
                   coalesce((SELECT sum(i.quantity_accepted * i.unit_cost) FROM goods_receipt_item i WHERE i.goods_receipt_id = g.id), 0) AS accepted_value,
                   EXISTS (SELECT 1 FROM goods_receipt_item i WHERE i.goods_receipt_id = g.id AND i.discrepancy_type IS NOT NULL) AS has_issues,
                   ru.full_name AS recorded_by, au.full_name AS accepted_by
              FROM goods_receipt g
              JOIN supplier s ON s.id = g.supplier_id
              LEFT JOIN purchase_order p ON p.id = g.purchase_order_id
              LEFT JOIN operational_user_profile ru ON ru.id = g.recorded_by
              LEFT JOIN operational_user_profile au ON au.id = g.accepted_by
            """;

    private static Row row(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Row((UUID) rs.getObject("id"), rs.getString("receipt_number"), (UUID) rs.getObject("supplier_id"), rs.getString("supplier_name"),
                (UUID) rs.getObject("purchase_order_id"), rs.getString("po_number"), rs.getObject("received_date", LocalDate.class),
                rs.getString("supplier_invoice_reference"), rs.getLong("lines"), rs.getBigDecimal("units_received"),
                rs.getBigDecimal("units_accepted"), rs.getBoolean("has_issues"), rs.getBigDecimal("accepted_value"), rs.getString("currency"),
                rs.getString("recorded_by"), rs.getString("accepted_by"), rs.getTimestamp("recorded_at").toInstant());
    }

    // ------------------------------------------------------------------ reads

    @Transactional(readOnly = true)
    public Page list(String search, UUID supplierId, Boolean issues, LocalDate from, LocalDate to, int page, int size) {
        require(VIEW);
        int pageSize = Math.min(Math.max(size, 1), 100);
        int current = Math.max(page, 0);
        String like = search == null || search.isBlank() ? null : "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
        String where = """
                 WHERE (?::text IS NULL OR lower(g.receipt_number) LIKE ?::text OR lower(s.name) LIKE ?::text
                        OR lower(coalesce(p.po_number, '')) LIKE ?::text OR lower(coalesce(g.supplier_invoice_reference, '')) LIKE ?::text
                        OR EXISTS (SELECT 1 FROM goods_receipt_item i JOIN product_variant v ON v.id = i.product_variant_id
                                    WHERE i.goods_receipt_id = g.id AND (lower(v.technical_name) LIKE ?::text OR lower(v.inventory_sku) LIKE ?::text)))
                   AND (?::uuid IS NULL OR g.supplier_id = ?::uuid)
                   AND (?::boolean IS NULL OR EXISTS (SELECT 1 FROM goods_receipt_item i WHERE i.goods_receipt_id = g.id
                                                       AND i.discrepancy_type IS NOT NULL) = ?::boolean)
                   AND (?::date IS NULL OR g.received_date >= ?::date) AND (?::date IS NULL OR g.received_date <= ?::date)
                """;
        Object[] filters = {like, like, like, like, like, like, like, supplierId, supplierId, issues, issues, from, from, to, to};
        Long total = jdbc.queryForObject("SELECT count(*) FROM goods_receipt g JOIN supplier s ON s.id = g.supplier_id "
                + "LEFT JOIN purchase_order p ON p.id = g.purchase_order_id" + where, Long.class, filters);
        Object[] paged = java.util.Arrays.copyOf(filters, filters.length + 2);
        paged[filters.length] = pageSize;
        paged[filters.length + 1] = (long) current * pageSize;
        List<Row> rows = jdbc.query(ROW_SELECT + where + " ORDER BY g.received_date DESC, g.recorded_at DESC LIMIT ? OFFSET ?", (rs, n) -> row(rs), paged);
        Kpis kpis = jdbc.queryForObject("""
                SELECT count(*), coalesce(sum((SELECT count(*) FROM goods_receipt_item i WHERE i.goods_receipt_id = g.id)), 0),
                       coalesce(sum((SELECT sum(i.quantity_accepted) FROM goods_receipt_item i WHERE i.goods_receipt_id = g.id)), 0),
                       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM goods_receipt_item i WHERE i.goods_receipt_id = g.id AND i.discrepancy_type IS NOT NULL))
                  FROM goods_receipt g JOIN supplier s ON s.id = g.supplier_id LEFT JOIN purchase_order p ON p.id = g.purchase_order_id
                """ + where, (rs, n) -> new Kpis(rs.getLong(1), rs.getLong(2), rs.getBigDecimal(3), rs.getLong(4)), filters);
        long count = total == null ? 0 : total;
        return new Page(rows, count, current, pageSize, (int) Math.max(1, Math.ceil(count / (double) pageSize)), kpis);
    }

    @Transactional(readOnly = true)
    public Detail detail(UUID id) {
        require(VIEW);
        List<Row> found = jdbc.query(ROW_SELECT + " WHERE g.id = ?", (rs, n) -> row(rs), id);
        if (found.isEmpty()) {
            throw new IllegalArgumentException("No such goods receipt.");
        }
        List<Item> items = jdbc.query("""
                SELECT i.id, i.line_number, i.product_variant_id, v.inventory_sku, v.technical_name, poi.line_number AS po_line,
                       i.quantity_received, i.quantity_accepted, i.unit_cost, i.discrepancy_type, i.discrepancy_note
                  FROM goods_receipt_item i
                  JOIN product_variant v ON v.id = i.product_variant_id
                  LEFT JOIN purchase_order_item poi ON poi.id = i.purchase_order_item_id
                 WHERE i.goods_receipt_id = ? ORDER BY i.line_number
                """, (rs, n) -> new Item((UUID) rs.getObject("id"), rs.getInt("line_number"), (UUID) rs.getObject("product_variant_id"),
                        rs.getString("inventory_sku"), rs.getString("technical_name"), (Integer) rs.getObject("po_line"),
                        rs.getBigDecimal("quantity_received"), rs.getBigDecimal("quantity_accepted"), rs.getBigDecimal("unit_cost"),
                        rs.getBigDecimal("quantity_accepted").multiply(rs.getBigDecimal("unit_cost")),
                        rs.getString("discrepancy_type"), rs.getString("discrepancy_note")), id);
        String warehouse = jdbc.query("SELECT w.name FROM goods_receipt g JOIN warehouse w ON w.id = g.warehouse_id WHERE g.id = ?",
                (rs, n) -> rs.getString(1), id).stream().findFirst().orElse(null);
        String note = jdbc.queryForObject("SELECT note FROM goods_receipt WHERE id = ?", String.class, id);
        return new Detail(found.getFirst(), warehouse, note, items);
    }

    /** Orders that can still receive goods. Needs the receiving capability, not the order's own view. */
    @Transactional(readOnly = true)
    public List<ReceivableOrder> receivableOrders(UUID supplierId) {
        requireAny(VIEW, RECORD);
        return jdbc.query("""
                SELECT p.id, p.po_number, p.supplier_id, s.name, p.order_date, p.status
                  FROM purchase_order p JOIN supplier s ON s.id = p.supplier_id
                 WHERE p.status IN ('APPROVED', 'SENT', 'PARTIALLY_RECEIVED') AND (?::uuid IS NULL OR p.supplier_id = ?::uuid)
                 ORDER BY p.order_date DESC, p.po_number DESC
                """, (rs, n) -> new ReceivableOrder((UUID) rs.getObject("id"), rs.getString("po_number"), (UUID) rs.getObject("supplier_id"),
                        rs.getString("name"), rs.getObject("order_date", LocalDate.class), rs.getString("status")), supplierId, supplierId);
    }

    @Transactional(readOnly = true)
    public List<OrderLine> orderLines(UUID purchaseOrderId) {
        requireAny(VIEW, RECORD);
        return jdbc.query("""
                SELECT i.id, i.line_number, i.product_variant_id, v.inventory_sku, v.technical_name, i.quantity_ordered, i.unit_cost,
                       coalesce((SELECT sum(g.quantity_accepted) FROM goods_receipt_item g WHERE g.purchase_order_item_id = i.id), 0) AS accepted
                  FROM purchase_order_item i JOIN product_variant v ON v.id = i.product_variant_id
                 WHERE i.purchase_order_id = ? ORDER BY i.line_number
                """, (rs, n) -> {
            BigDecimal ordered = rs.getBigDecimal("quantity_ordered");
            BigDecimal accepted = rs.getBigDecimal("accepted");
            return new OrderLine((UUID) rs.getObject("id"), rs.getInt("line_number"), (UUID) rs.getObject("product_variant_id"),
                    rs.getString("inventory_sku"), rs.getString("technical_name"), ordered, accepted,
                    ordered.subtract(accepted).max(BigDecimal.ZERO), rs.getBigDecimal("unit_cost"));
        }, purchaseOrderId);
    }

    private void requireAny(String... permissions) {
        Actor actor = currentActor.require();
        for (String p : permissions) {
            if (actor.hasPermission(p)) {
                return;
            }
        }
        throw new AccessDeniedByPermissionException(permissions[0]);
    }

    // ------------------------------------------------------------------ write

    @Transactional
    public UUID record(Input input) {
        Actor actor = require(RECORD);
        if (input == null || input.supplierId() == null) {
            throw new IllegalArgumentException("Choose the supplier.");
        }
        if (input.items() == null || input.items().isEmpty()) {
            throw new IllegalArgumentException("A goods receipt needs at least one line.");
        }
        boolean accepting = input.items().stream().anyMatch(i -> i.quantityAccepted() != null && i.quantityAccepted().signum() > 0);
        if (accepting) {
            // PRC-036 - deciding what is accepted is its own act.
            require(ACCEPT);
        }
        List<String> supplier = jdbc.queryForList("SELECT record_status FROM supplier WHERE id = ?", String.class, input.supplierId());
        if (supplier.isEmpty()) {
            throw new IllegalArgumentException("No such supplier.");
        }
        if (!"ACTIVE".equals(supplier.getFirst())) {
            throw new IllegalStateException("This supplier is not active. Restore it before receiving from it.");
        }
        LocalDate received = input.receivedDate() == null ? LocalDate.now() : input.receivedDate();
        if (received.isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("Goods cannot be received on a date in the future.");
        }
        if (input.warehouseId() != null && jdbc.queryForList("SELECT 1 FROM warehouse WHERE id = ?", Integer.class, input.warehouseId()).isEmpty()) {
            throw new IllegalArgumentException("No such warehouse.");
        }

        // The purchase order, where there is one (PRC-018 - optional).
        UUID orderId = input.purchaseOrderId();
        if (orderId != null) {
            List<Object[]> order = jdbc.query("SELECT status, supplier_id FROM purchase_order WHERE id = ? FOR UPDATE",
                    (rs, n) -> new Object[]{rs.getString("status"), rs.getObject("supplier_id")}, orderId);
            if (order.isEmpty()) {
                throw new IllegalArgumentException("No such purchase order.");
            }
            if (!RECEIVABLE.contains((String) order.getFirst()[0])) {
                throw new IllegalStateException("This purchase order is " + ((String) order.getFirst()[0]).toLowerCase(Locale.ROOT).replace('_', ' ')
                        + " and cannot receive goods. Only an approved order can.");
            }
            if (!input.supplierId().equals(order.getFirst()[1])) {
                throw new IllegalArgumentException("This purchase order belongs to a different supplier.");
            }
        }

        record Checked(ItemInput in, BigDecimal received, BigDecimal accepted, BigDecimal cost, String discrepancy) {
        }
        List<Checked> checked = new ArrayList<>();
        Set<UUID> seenOrderItems = new HashSet<>();
        int lineNo = 0;
        for (ItemInput item : input.items()) {
            lineNo++;
            String where = "Line " + lineNo + ": ";
            if (item.productVariantId() == null) {
                throw new IllegalArgumentException(where + "choose the product.");
            }
            BigDecimal received$ = item.quantityReceived();
            if (received$ == null || received$.signum() <= 0) {
                throw new IllegalArgumentException(where + "the quantity received must be above zero.");
            }
            BigDecimal accepted = item.quantityAccepted() == null ? BigDecimal.ZERO : item.quantityAccepted();
            if (accepted.signum() < 0 || accepted.compareTo(received$) > 0) {
                throw new IllegalArgumentException(where + "the accepted quantity cannot be negative or more than what was received.");
            }
            if (item.unitCost() == null || item.unitCost().signum() < 0) {
                throw new IllegalArgumentException(where + "the unit cost is required and cannot be negative.");
            }
            if (received$.scale() > 4 || item.unitCost().scale() > 4 || accepted.scale() > 4) {
                throw new IllegalArgumentException(where + "quantities and costs take at most four decimal places.");
            }
            String type = item.discrepancyType() == null || item.discrepancyType().isBlank() ? null : item.discrepancyType().trim().toUpperCase(Locale.ROOT);
            if (type != null && !DISCREPANCIES.contains(type)) {
                throw new IllegalArgumentException(where + "'" + item.discrepancyType() + "' is not a discrepancy. Allowed: SHORTAGE, WRONG_ITEM, DAMAGED, EXCESS.");
            }
            if (accepted.compareTo(received$) < 0 && type == null) {
                throw new IllegalArgumentException(where + "goods that are not accepted need a reason - choose the discrepancy.");
            }
            List<String> variant = jdbc.queryForList("SELECT record_status FROM product_variant WHERE id = ?", String.class, item.productVariantId());
            if (variant.isEmpty()) {
                throw new IllegalArgumentException(where + "no such product.");
            }
            if ("ARCHIVED".equals(variant.getFirst())) {
                throw new IllegalStateException(where + "this product is archived.");
            }
            if (orderId != null) {
                if (item.purchaseOrderItemId() == null) {
                    throw new IllegalArgumentException(where + "a receipt against a purchase order takes that order's lines.");
                }
                if (!seenOrderItems.add(item.purchaseOrderItemId())) {
                    throw new IllegalArgumentException(where + "this order line is already on the receipt.");
                }
                List<BigDecimal[]> line = jdbc.query("""
                        SELECT i.quantity_ordered, coalesce((SELECT sum(g.quantity_accepted) FROM goods_receipt_item g WHERE g.purchase_order_item_id = i.id), 0), 0.0
                          FROM purchase_order_item i WHERE i.id = ? AND i.purchase_order_id = ? AND i.product_variant_id = ?
                        """, (rs, n) -> new BigDecimal[]{rs.getBigDecimal(1), rs.getBigDecimal(2)}, item.purchaseOrderItemId(), orderId, item.productVariantId());
                if (line.isEmpty()) {
                    throw new IllegalArgumentException(where + "this is not a line of that purchase order.");
                }
                BigDecimal remaining = line.getFirst()[0].subtract(line.getFirst()[1]);
                if (accepted.compareTo(remaining) > 0) {
                    throw new IllegalArgumentException(where + "only " + remaining.stripTrailingZeros().toPlainString()
                            + " is still to come on this order. Accept up to that; the extra is an EXCESS discrepancy (PRC-040).");
                }
            } else if (item.purchaseOrderItemId() != null) {
                throw new IllegalArgumentException(where + "a direct purchase has no purchase order line.");
            }
            checked.add(new Checked(item, received$, accepted, item.unitCost(), type));
        }

        UUID id = UUID.randomUUID();
        String number = nextNumber(received.getYear());
        jdbc.update("""
                INSERT INTO goods_receipt (id, receipt_number, supplier_id, purchase_order_id, warehouse_id, received_date,
                                           supplier_invoice_reference, note, currency, recorded_by, accepted_by, accepted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, number, input.supplierId(), orderId, input.warehouseId(), received, blank(input.supplierInvoiceReference()),
                blank(input.note()), CURRENCY, actor.id(), accepting ? actor.id() : null, accepting ? java.sql.Timestamp.from(Instant.now()) : null);

        int line = 1;
        BigDecimal acceptedUnits = BigDecimal.ZERO;
        for (Checked c : checked) {
            UUID movement = null;
            if (c.accepted().signum() > 0) {
                // IVN-038 / ICO-033 - the movement is the only thing that moves stock, and it carries the cost.
                movement = UUID.randomUUID();
                jdbc.update("""
                        INSERT INTO inventory_movement (id, product_variant_id, quantity, movement_type, recorded_by, unit_cost)
                        VALUES (?, ?, ?, 'GOODS_RECEIPT_ACCEPTED', ?, ?)
                        """, movement, c.in().productVariantId(), c.accepted(), actor.id(), c.cost());
                acceptedUnits = acceptedUnits.add(c.accepted());
            }
            jdbc.update("""
                    INSERT INTO goods_receipt_item (goods_receipt_id, line_number, purchase_order_item_id, product_variant_id, quantity_received,
                                                    quantity_accepted, unit_cost, discrepancy_type, discrepancy_note, inventory_movement_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, id, line++, c.in().purchaseOrderItemId(), c.in().productVariantId(), c.received(), c.accepted(), c.cost(),
                    c.discrepancy(), blank(c.in().discrepancyNote()), movement);
        }

        if (orderId != null) {
            settleOrder(orderId, number, checked.size(), acceptedUnits, actor.id());
        }
        return id;
    }

    /** Moves the order to partially received / received from what has now been accepted, and records it in the order's history. */
    private void settleOrder(UUID orderId, String receiptNumber, int lines, BigDecimal acceptedUnits, UUID actor) {
        Boolean complete = jdbc.queryForObject("""
                SELECT NOT EXISTS (SELECT 1 FROM purchase_order_item i
                                    WHERE i.purchase_order_id = ?
                                      AND coalesce((SELECT sum(g.quantity_accepted) FROM goods_receipt_item g WHERE g.purchase_order_item_id = i.id), 0) < i.quantity_ordered)
                """, Boolean.class, orderId);
        Boolean any = jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM goods_receipt_item g JOIN purchase_order_item i ON i.id = g.purchase_order_item_id
                                WHERE i.purchase_order_id = ? AND g.quantity_accepted > 0)
                """, Boolean.class, orderId);
        String status = Boolean.TRUE.equals(complete) ? "RECEIVED" : Boolean.TRUE.equals(any) ? "PARTIALLY_RECEIVED" : null;
        if (status != null) {
            jdbc.update("UPDATE purchase_order SET status = ?, updated_at = now(), updated_by = ?, version = version + 1 WHERE id = ?", status, actor, orderId);
        }
        jdbc.update("INSERT INTO purchase_order_history (purchase_order_id, action, reason, detail, acted_by) VALUES (?, 'RECEIVED', NULL, ?, ?)",
                orderId, receiptNumber + ": " + lines + " line" + (lines == 1 ? "" : "s") + ", " + acceptedUnits.stripTrailingZeros().toPlainString()
                        + " unit" + (acceptedUnits.compareTo(BigDecimal.ONE) == 0 ? "" : "s") + " accepted", actor);
    }

    private String nextNumber(int year) {
        Integer next = jdbc.queryForObject("""
                INSERT INTO document_number_counter (kind, year, last_number) VALUES ('GR', ?, 1)
                ON CONFLICT (kind, year) DO UPDATE SET last_number = document_number_counter.last_number + 1
                RETURNING last_number
                """, Integer.class, year);
        return "GR-%d-%04d".formatted(year, next);
    }

    private static String blank(String text) {
        return text == null || text.isBlank() ? null : text.trim();
    }
}
