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
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Purchase Orders ({@code E-029}) and their items ({@code E-066}).
 *
 * <p>🔴 AN ORDER IS A COMMITMENT, NOT STOCK AND NOT A LIABILITY. Stock enters at goods receipt and the payable is created
 * at acceptance ({@code PRC-017}, {@code BR-105}, {@code BR-109}); this service writes neither. The quantity received is
 * therefore not stored - it is derived from receipt lines and none exist yet.
 *
 * <p>🔴 THE APPROVER IS NEVER THE CREATOR ({@code INV-29.1}, {@code PRM-006}) - except the Owner, by the owner's
 * decision of 2026-10-06 ({@code PRC-069}); both acts are recorded separately ({@code PRM-072}). No magnitude bound is
 * enforced: whether one exists is open ({@code PRMU-8}).
 *
 * <p>🔴 THE CHANGE WINDOW CLOSES WHEN GOODS MOVE ({@code PRC-023}, {@code PRC-025}). Once the supplier has shipped or
 * confirmed shipment - a fact a person RECORDS, never one the ERP owns ({@code PRC-024}) - the order can be neither
 * amended nor cancelled here. Before that, amending or cancelling an approved order needs a reason and the supplier's
 * agreement, and every change is appended to the history ({@code PRC-026}).
 */
@Service
public class PurchaseOrderService {

    public static final String VIEW = "procurement.purchase-order.view";
    public static final String MANAGE = "procurement.purchase-order.manage";
    public static final String APPROVE = "procurement.purchase-order.approve";

    /** {@code TEC-052} - business dates are derived by applying Asia/Dhaka explicitly. */
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Dhaka");
    private static final Set<String> OPEN = Set.of("DRAFT", "APPROVED", "SENT", "PARTIALLY_RECEIVED");

    private final JdbcTemplate jdbc;
    private final CurrentActor currentActor;

    public PurchaseOrderService(JdbcTemplate jdbc, CurrentActor currentActor) {
        this.jdbc = jdbc;
        this.currentActor = currentActor;
    }

    // ------------------------------------------------------------------ shapes

    public record Item(UUID id, int lineNumber, UUID productVariantId, String sku, String name, BigDecimal quantityOrdered,
                       BigDecimal quantityReceived, @MonetaryAmount BigDecimal unitCost, @MonetaryAmount BigDecimal lineTotal,
                       String currency, LocalDate expectedDate) {
    }

    public record HistoryEntry(String action, String reason, String detail, String actedBy, Instant actedAt) {
    }

    public record Row(UUID id, String poNumber, UUID supplierId, String supplierName, LocalDate orderDate, LocalDate expectedDate,
                      String currency, String supplierOrderReference, String status, long lines, @MonetaryAmount BigDecimal total,
                      boolean supplierShipped, boolean amendable, String createdBy, String approvedBy, Instant createdAt,
                      Instant updatedAt, long version) {
    }

    /** The supplier's contact details as the printable and the WhatsApp message need them; read-only. */
    public record SupplierContact(String name, String contactName, String phone, String email, String address) {
    }

    public record Detail(Row order, List<Item> items, List<HistoryEntry> history, SupplierContact supplier) {
    }

    public record Kpis(long orders, long open, long awaitingApproval, long amendable, long cancelled) {
    }

    public record Page(List<Row> content, long totalElements, int page, int size, int totalPages, Kpis kpis) {
    }

    public record ItemInput(UUID productVariantId, BigDecimal quantity, BigDecimal unitCost, LocalDate expectedDate) {
    }

    public record Input(UUID supplierId, LocalDate orderDate, LocalDate expectedDate, String currency, String supplierOrderReference,
                        List<ItemInput> items, String reason, Boolean supplierAgreed, Long version) {
    }

    public record CancelInput(String reason, Boolean supplierAgreed, Long version) {
    }

    // ------------------------------------------------------------------ reads

    private Actor require(String permission) {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(permission)) {
            throw new AccessDeniedByPermissionException(permission);
        }
        return actor;
    }

    private static final String ROW_SELECT = """
            SELECT p.id, p.po_number, p.supplier_id, s.name AS supplier_name, p.order_date, p.expected_date, p.currency,
                   p.supplier_order_reference, p.status, p.supplier_shipped_at, p.created_at, p.updated_at, p.version,
                   (SELECT count(*) FROM purchase_order_item i WHERE i.purchase_order_id = p.id) AS lines,
                   coalesce((SELECT sum(i.quantity_ordered * i.unit_cost) FROM purchase_order_item i WHERE i.purchase_order_id = p.id), 0) AS total,
                   cu.full_name AS created_by, au.full_name AS approved_by
              FROM purchase_order p
              JOIN supplier s ON s.id = p.supplier_id
              LEFT JOIN operational_user_profile cu ON cu.id = p.created_by
              LEFT JOIN operational_user_profile au ON au.id = p.approved_by
            """;

    private static Row row(java.sql.ResultSet rs) throws java.sql.SQLException {
        String status = rs.getString("status");
        boolean shipped = rs.getTimestamp("supplier_shipped_at") != null;
        return new Row((UUID) rs.getObject("id"), rs.getString("po_number"), (UUID) rs.getObject("supplier_id"), rs.getString("supplier_name"),
                rs.getObject("order_date", LocalDate.class), rs.getObject("expected_date", LocalDate.class), rs.getString("currency"),
                rs.getString("supplier_order_reference"), status, rs.getLong("lines"), rs.getBigDecimal("total"), shipped,
                isAmendable(status, shipped), rs.getString("created_by"), rs.getString("approved_by"),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant(), rs.getLong("version"));
    }

    /** {@code PRC-023}: amendable or cancellable only until the supplier ships or confirms shipment, and while no goods came in. */
    static boolean isAmendable(String status, boolean shipped) {
        return !shipped && Set.of("DRAFT", "APPROVED", "SENT").contains(status);
    }

    @Transactional(readOnly = true)
    public Page list(String search, String status, UUID supplierId, Boolean shipped, int page, int size) {
        require(VIEW);
        int pageSize = Math.min(Math.max(size, 1), 100);
        int current = Math.max(page, 0);
        String like = search == null || search.isBlank() ? null : "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
        String state = status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);
        String where = """
                 WHERE (?::text IS NULL OR lower(p.po_number) LIKE ?::text OR lower(s.name) LIKE ?::text
                        OR lower(coalesce(p.supplier_order_reference, '')) LIKE ?::text
                        OR EXISTS (SELECT 1 FROM purchase_order_item i JOIN product_variant v ON v.id = i.product_variant_id
                                    WHERE i.purchase_order_id = p.id
                                      AND (lower(v.technical_name) LIKE ?::text OR lower(v.inventory_sku) LIKE ?::text)))
                   AND (?::text IS NULL OR p.status = ?::text)
                   AND (?::uuid IS NULL OR p.supplier_id = ?::uuid)
                   AND (?::boolean IS NULL OR (p.supplier_shipped_at IS NOT NULL) = ?::boolean)
                """;
        Object[] filters = {like, like, like, like, like, like, state, state, supplierId, supplierId, shipped, shipped};
        Long total = jdbc.queryForObject("SELECT count(*) FROM purchase_order p JOIN supplier s ON s.id = p.supplier_id" + where, Long.class, filters);
        Object[] paged = java.util.Arrays.copyOf(filters, filters.length + 2);
        paged[filters.length] = pageSize;
        paged[filters.length + 1] = (long) current * pageSize;
        List<Row> rows = jdbc.query(ROW_SELECT + where + " ORDER BY p.po_number DESC LIMIT ? OFFSET ?", (rs, n) -> row(rs), paged);
        long count = total == null ? 0 : total;
        Kpis kpis = jdbc.queryForObject("""
                SELECT count(*),
                       count(*) FILTER (WHERE status IN ('DRAFT', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED')),
                       count(*) FILTER (WHERE status = 'DRAFT'),
                       count(*) FILTER (WHERE status IN ('DRAFT', 'APPROVED', 'SENT') AND supplier_shipped_at IS NULL),
                       count(*) FILTER (WHERE status = 'CANCELLED')
                  FROM purchase_order
                """, (rs, n) -> new Kpis(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5)));
        return new Page(rows, count, current, pageSize, (int) Math.max(1, Math.ceil(count / (double) pageSize)), kpis);
    }

    @Transactional(readOnly = true)
    public Detail detail(UUID id) {
        require(VIEW);
        List<Row> found = jdbc.query(ROW_SELECT + " WHERE p.id = ?", (rs, n) -> row(rs), id);
        if (found.isEmpty()) {
            throw new IllegalArgumentException("No such purchase order.");
        }
        List<Item> items = jdbc.query("""
                SELECT i.id, i.line_number, i.product_variant_id, v.inventory_sku, v.technical_name, i.quantity_ordered, i.unit_cost,
                       i.currency, i.expected_date
                  FROM purchase_order_item i JOIN product_variant v ON v.id = i.product_variant_id
                 WHERE i.purchase_order_id = ? ORDER BY i.line_number
                """, (rs, n) -> new Item((UUID) rs.getObject("id"), rs.getInt("line_number"), (UUID) rs.getObject("product_variant_id"),
                        rs.getString("inventory_sku"), rs.getString("technical_name"), rs.getBigDecimal("quantity_ordered"), BigDecimal.ZERO,
                        rs.getBigDecimal("unit_cost"), rs.getBigDecimal("quantity_ordered").multiply(rs.getBigDecimal("unit_cost")),
                        rs.getString("currency"), rs.getObject("expected_date", LocalDate.class)), id);
        List<HistoryEntry> history = jdbc.query("""
                SELECT h.action, h.reason, h.detail, u.full_name, h.acted_at
                  FROM purchase_order_history h LEFT JOIN operational_user_profile u ON u.id = h.acted_by
                 WHERE h.purchase_order_id = ? ORDER BY h.acted_at, h.id
                """, (rs, n) -> new HistoryEntry(rs.getString("action"), rs.getString("reason"), rs.getString("detail"),
                        rs.getString("full_name"), rs.getTimestamp("acted_at").toInstant()), id);
        SupplierContact supplier = jdbc.queryForObject("SELECT name, contact_name, phone, email, address FROM supplier WHERE id = ?",
                (rs, n) -> new SupplierContact(rs.getString("name"), rs.getString("contact_name"), rs.getString("phone"), rs.getString("email"),
                        rs.getString("address")), found.getFirst().supplierId());
        return new Detail(found.getFirst(), items, history, supplier);
    }

    // ------------------------------------------------------------------ writes

    @Transactional
    public UUID create(Input input) {
        Actor actor = require(MANAGE);
        String currency = currencyFor(input);
        validateHeader(input);
        List<ItemInput> items = validatedItems(input.items());
        LocalDate orderDate = input.orderDate() == null ? LocalDate.now(BUSINESS_ZONE) : input.orderDate();
        if (input.expectedDate() != null && input.expectedDate().isBefore(orderDate)) {
            throw new IllegalArgumentException("The expected date cannot be before the order date.");
        }
        String number = nextNumber(orderDate.getYear());
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO purchase_order (id, po_number, supplier_id, order_date, expected_date, currency, supplier_order_reference,
                                            created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, number, input.supplierId(), orderDate, input.expectedDate(), currency, blank(input.supplierOrderReference()),
                actor.id(), actor.id());
        writeItems(id, currency, items);
        log(id, "CREATED", null, items.size() + " line" + (items.size() == 1 ? "" : "s"), actor.id());
        return id;
    }

    @Transactional
    public void update(UUID id, Input input) {
        Actor actor = require(MANAGE);
        PoState state = lockedState(id);
        requireVersion(state, input.version());
        requireChangeWindow(state, "amended");
        String currency = currencyFor(input);
        validateHeader(input);
        List<ItemInput> items = validatedItems(input.items());
        boolean approved = !"DRAFT".equals(state.status());
        String reason = blank(input.reason());
        if (approved) {
            if (reason == null) {
                throw new IllegalArgumentException("An approved order is changed only with a reason (PRC-026).");
            }
            if (!Boolean.TRUE.equals(input.supplierAgreed())) {
                throw new IllegalArgumentException("An approved order is changed only with the supplier's agreement (PRC-023). Confirm they agreed.");
            }
        }
        BigDecimal before = totalOf(id);
        LocalDate orderDate = input.orderDate() == null ? state.orderDate() : input.orderDate();
        if (input.expectedDate() != null && input.expectedDate().isBefore(orderDate)) {
            throw new IllegalArgumentException("The expected date cannot be before the order date.");
        }
        jdbc.update("""
                UPDATE purchase_order SET supplier_id = ?, order_date = ?, expected_date = ?, currency = ?, supplier_order_reference = ?,
                       updated_at = now(), updated_by = ?, version = version + 1
                 WHERE id = ?
                """, input.supplierId(), orderDate, input.expectedDate(), currency, blank(input.supplierOrderReference()), actor.id(), id);
        jdbc.update("DELETE FROM purchase_order_item WHERE purchase_order_id = ?", id);
        writeItems(id, currency, items);
        if (approved) {
            log(id, "AMENDED", reason, "Total " + before.toPlainString() + " -> " + totalOf(id).toPlainString() + " " + currency
                    + "; " + items.size() + " line" + (items.size() == 1 ? "" : "s") + "; supplier agreed", actor.id());
        }
    }

    @Transactional
    public void approve(UUID id) {
        Actor actor = require(APPROVE);
        PoState state = lockedState(id);
        if (!"DRAFT".equals(state.status())) {
            throw new IllegalStateException("Only a draft order is awaiting approval.");
        }
        if (totalLines(id) == 0) {
            throw new IllegalStateException("An order with no lines cannot be approved.");
        }
        boolean own = actor.id().equals(state.createdBy());
        if (own && !isOwner(actor.id())) {
            // INV-29.1 / PRM-006: the approver is never the creator - the Owner's exception (PRC-069) is the only one.
            throw new IllegalStateException("You created this order, so someone else must approve it (INV-29.1).");
        }
        jdbc.update("UPDATE purchase_order SET status = 'APPROVED', approved_by = ?, approved_at = now(), updated_at = now(), updated_by = ?, version = version + 1 WHERE id = ?",
                actor.id(), actor.id(), id);
        log(id, "APPROVED", null, own ? "Approved by its creator, the Owner (PRC-069); both acts are recorded" : null, actor.id());
    }

    @Transactional
    public void send(UUID id) {
        Actor actor = require(MANAGE);
        PoState state = lockedState(id);
        if (!"APPROVED".equals(state.status())) {
            throw new IllegalStateException("Only an approved order can be marked as sent to the supplier.");
        }
        jdbc.update("UPDATE purchase_order SET status = 'SENT', sent_at = now(), updated_at = now(), updated_by = ?, version = version + 1 WHERE id = ?", actor.id(), id);
        log(id, "SENT", null, null, actor.id());
    }

    /** {@code PRC-024} - records what the supplier said; the ERP never owns the supplier's shipment. */
    @Transactional
    public void recordSupplierShipment(UUID id) {
        Actor actor = require(MANAGE);
        PoState state = lockedState(id);
        if (!Set.of("APPROVED", "SENT").contains(state.status())) {
            throw new IllegalStateException("A supplier shipment is recorded against an approved or sent order.");
        }
        if (state.shipped()) {
            throw new IllegalStateException("The supplier's shipment is already recorded.");
        }
        jdbc.update("UPDATE purchase_order SET supplier_shipped_at = now(), supplier_shipped_by = ?, updated_at = now(), updated_by = ?, version = version + 1 WHERE id = ?",
                actor.id(), actor.id(), id);
        log(id, "SUPPLIER_SHIPPED", null, "The order can no longer be amended or cancelled here (PRC-023)", actor.id());
    }

    @Transactional
    public void cancel(UUID id, CancelInput input) {
        Actor actor = require(MANAGE);
        PoState state = lockedState(id);
        requireVersion(state, input.version());
        requireChangeWindow(state, "cancelled");
        String reason = blank(input.reason());
        if (reason == null) {
            throw new IllegalArgumentException("A cancellation records why (PRC-026).");
        }
        if (!"DRAFT".equals(state.status()) && !Boolean.TRUE.equals(input.supplierAgreed())) {
            throw new IllegalArgumentException("An approved order is cancelled only with the supplier's agreement (PRC-023). Confirm they agreed.");
        }
        jdbc.update("UPDATE purchase_order SET status = 'CANCELLED', cancelled_at = now(), cancelled_by = ?, updated_at = now(), updated_by = ?, version = version + 1 WHERE id = ?",
                actor.id(), actor.id(), id);
        log(id, "CANCELLED", reason, "DRAFT".equals(state.status()) ? "Cancelled before approval" : "Supplier agreed", actor.id());
    }

    // ------------------------------------------------------------------ helpers

    private record PoState(String status, boolean shipped, UUID createdBy, LocalDate orderDate, long version) {
    }

    private PoState lockedState(UUID id) {
        List<PoState> found = jdbc.query("SELECT status, supplier_shipped_at, created_by, order_date, version FROM purchase_order WHERE id = ? FOR UPDATE",
                (rs, n) -> new PoState(rs.getString("status"), rs.getTimestamp("supplier_shipped_at") != null, (UUID) rs.getObject("created_by"),
                        rs.getObject("order_date", LocalDate.class), rs.getLong("version")), id);
        if (found.isEmpty()) {
            throw new IllegalArgumentException("No such purchase order.");
        }
        return found.getFirst();
    }

    private static void requireVersion(PoState state, Long expected) {
        if (expected != null && expected != state.version()) {
            throw new IllegalStateException("This order was changed by someone else. Reload and try again.");
        }
    }

    private static void requireChangeWindow(PoState state, String verb) {
        if (!OPEN.contains(state.status()) || "PARTIALLY_RECEIVED".equals(state.status())) {
            throw new IllegalStateException("This order is " + state.status().toLowerCase(Locale.ROOT).replace('_', ' ') + " and cannot be " + verb + ".");
        }
        if (state.shipped()) {
            throw new IllegalStateException("The supplier has shipped or confirmed shipment, so this order can no longer be " + verb
                    + " here. It is resolved by agreement with the supplier, and the outcome recorded (PRC-023).");
        }
    }

    private boolean isOwner(UUID actorId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT owner_designated_at IS NOT NULL FROM operational_user_profile WHERE id = ?", Boolean.class, actorId));
    }

    private long totalLines(UUID id) {
        Long n = jdbc.queryForObject("SELECT count(*) FROM purchase_order_item WHERE purchase_order_id = ?", Long.class, id);
        return n == null ? 0 : n;
    }

    private BigDecimal totalOf(UUID id) {
        BigDecimal total = jdbc.queryForObject("SELECT coalesce(sum(quantity_ordered * unit_cost), 0) FROM purchase_order_item WHERE purchase_order_id = ?", BigDecimal.class, id);
        return total == null ? BigDecimal.ZERO : total;
    }

    /** One counter per kind and year, only ever moving forward, so a number is never reused even when its order is cancelled (PRC-022). */
    private String nextNumber(int year) {
        Integer next = jdbc.queryForObject("""
                INSERT INTO document_number_counter (kind, year, last_number) VALUES ('PO', ?, 1)
                ON CONFLICT (kind, year) DO UPDATE SET last_number = document_number_counter.last_number + 1
                RETURNING last_number
                """, Integer.class, year);
        return "PO-%d-%04d".formatted(year, next);
    }

    private void log(UUID id, String action, String reason, String detail, UUID actor) {
        jdbc.update("INSERT INTO purchase_order_history (purchase_order_id, action, reason, detail, acted_by) VALUES (?, ?, ?, ?, ?)", id, action, reason, detail, actor);
    }

    private void writeItems(UUID id, String currency, List<ItemInput> items) {
        int line = 1;
        for (ItemInput item : items) {
            jdbc.update("""
                    INSERT INTO purchase_order_item (purchase_order_id, line_number, product_variant_id, quantity_ordered, unit_cost, currency, expected_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, id, line++, item.productVariantId(), item.quantity(), item.unitCost(), currency, item.expectedDate());
        }
    }

    private void validateHeader(Input input) {
        if (input.supplierId() == null) {
            throw new IllegalArgumentException("Choose the supplier.");
        }
        List<String> status = jdbc.queryForList("SELECT record_status FROM supplier WHERE id = ?", String.class, input.supplierId());
        if (status.isEmpty()) {
            throw new IllegalArgumentException("No such supplier.");
        }
        // PRD-063 applied: an archived or suspended record takes no NEW references.
        if (!"ACTIVE".equals(status.getFirst())) {
            throw new IllegalStateException("This supplier is not active, so it cannot take a new order.");
        }
    }

    private String currencyFor(Input input) {
        String requested = blank(input.currency());
        if (requested == null && input.supplierId() != null) {
            List<String> own = jdbc.queryForList("SELECT currency FROM supplier WHERE id = ?", String.class, input.supplierId());
            requested = own.isEmpty() ? null : own.getFirst();
        }
        String upper = requested == null ? "BDT" : requested.toUpperCase(Locale.ROOT);
        if (!upper.matches("[A-Z]{3}")) {
            throw new IllegalArgumentException("The currency is a three-letter code such as BDT or USD.");
        }
        return upper;
    }

    private List<ItemInput> validatedItems(List<ItemInput> items) {
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Add at least one line.");
        }
        Set<UUID> seen = new HashSet<>();
        List<ItemInput> clean = new ArrayList<>();
        for (ItemInput item : items) {
            if (item.productVariantId() == null) {
                throw new IllegalArgumentException("Every line needs a product.");
            }
            if (!seen.add(item.productVariantId())) {
                throw new IllegalArgumentException("The same product is on two lines. Change its quantity instead.");
            }
            List<String> status = jdbc.queryForList("SELECT record_status FROM product_variant WHERE id = ?", String.class, item.productVariantId());
            if (status.isEmpty()) {
                throw new IllegalArgumentException("A line names a product that does not exist.");
            }
            if ("ARCHIVED".equals(status.getFirst())) {
                throw new IllegalStateException("An archived product cannot be ordered.");
            }
            if (item.quantity() == null || item.quantity().signum() <= 0) {
                throw new IllegalArgumentException("Every quantity must be above zero.");
            }
            if (item.quantity().stripTrailingZeros().scale() > 4 || item.quantity().precision() - item.quantity().scale() > 15) {
                throw new IllegalArgumentException("A quantity holds at most 4 decimal places.");
            }
            if (item.unitCost() == null || item.unitCost().signum() < 0) {
                throw new IllegalArgumentException("Every unit cost must be zero or more.");
            }
            if (item.unitCost().stripTrailingZeros().scale() > 4 || item.unitCost().precision() - item.unitCost().scale() > 15) {
                throw new IllegalArgumentException("A unit cost holds at most 4 decimal places; it is never rounded for you (DB-079).");
            }
            clean.add(item);
        }
        return clean;
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
