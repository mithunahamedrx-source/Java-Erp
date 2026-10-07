package com.trioloo.erp.procurement.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.platform.money.MonetaryAmount;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * The Supplier Ledger - a VIEW over existing records, never a record of its own ({@code PRC-052}, {@code SYS-090},
 * {@code DB-067}). Nothing here is stored and no balance is kept.
 *
 * <p>🔴 A purchase order is a COMMITMENT, not a liability ({@code PRC-068.e}), so it never moves the supplier's balance. Orders are
 * listed as MEMO lines - what was ordered - and the money columns (purchase, payment, advance, return, credit) stay empty until
 * goods receipts and supplier payments exist and feed this view. The outstanding balance is therefore WITHHELD ({@code null}),
 * not shown as zero ({@code PRC-067.b}).
 */
@Service
public class SupplierLedgerService {

    public record Supplier(UUID id, String name, String contactName, String phone, String email, String address, String currency) {
    }

    /** One line of the ledger. {@code memo} lines never change the balance. */
    public record Entry(LocalDate date, String type, String reference, UUID documentId, String description, String status, boolean memo,
                        @MonetaryAmount BigDecimal debit, @MonetaryAmount BigDecimal credit, @MonetaryAmount BigDecimal ordered) {
    }

    public record Ledger(Supplier supplier, LocalDate from, LocalDate to, List<Entry> entries, @MonetaryAmount BigDecimal totalOrdered,
                         long orders, @MonetaryAmount BigDecimal outstandingBalance) {
    }

    private final JdbcTemplate jdbc;
    private final CurrentActor currentActor;

    public SupplierLedgerService(JdbcTemplate jdbc, CurrentActor currentActor) {
        this.jdbc = jdbc;
        this.currentActor = currentActor;
    }

    @Transactional(readOnly = true)
    public Ledger ledger(UUID supplierId, LocalDate from, LocalDate to, String type) {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(SupplierService.VIEW)) {
            throw new AccessDeniedByPermissionException(SupplierService.VIEW);
        }
        List<Supplier> found = jdbc.query("SELECT id, name, contact_name, phone, email, address, currency FROM supplier WHERE id = ?",
                (rs, n) -> new Supplier((UUID) rs.getObject("id"), rs.getString("name"), rs.getString("contact_name"), rs.getString("phone"),
                        rs.getString("email"), rs.getString("address"), rs.getString("currency")), supplierId);
        if (found.isEmpty()) {
            throw new IllegalArgumentException("No such supplier.");
        }
        String wanted = type == null || type.isBlank() ? null : type.trim().toUpperCase(Locale.ROOT);
        List<Entry> entries = new ArrayList<>();
        // Only purchase orders exist so far; the other six transaction types arrive with receipts and payments.
        if (wanted == null || "PURCHASE_ORDER".equals(wanted)) {
            entries.addAll(jdbc.query("""
                    SELECT p.id, p.po_number, p.order_date, p.status, p.supplier_order_reference,
                           coalesce((SELECT sum(i.quantity_ordered * i.unit_cost) FROM purchase_order_item i WHERE i.purchase_order_id = p.id), 0) AS total
                      FROM purchase_order p
                     WHERE p.supplier_id = ? AND (?::date IS NULL OR p.order_date >= ?::date) AND (?::date IS NULL OR p.order_date <= ?::date)
                     ORDER BY p.order_date, p.created_at, p.po_number
                    """, (rs, n) -> new Entry(rs.getObject("order_date", LocalDate.class), "PURCHASE_ORDER", rs.getString("po_number"),
                            (UUID) rs.getObject("id"), description(rs.getString("supplier_order_reference")), rs.getString("status"), true,
                            null, null, rs.getBigDecimal("total")), supplierId, from, from, to, to));
        }
        BigDecimal ordered = entries.stream().filter(e -> !"CANCELLED".equals(e.status())).map(Entry::ordered)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long orders = entries.stream().filter(e -> !"CANCELLED".equals(e.status())).count();
        return new Ledger(found.getFirst(), from, to, entries, ordered, orders, null);
    }

    private static String description(String supplierReference) {
        return supplierReference == null || supplierReference.isBlank() ? "Purchase order - commitment, not yet owed"
                : "Purchase order - commitment, not yet owed (their ref. " + supplierReference + ")";
    }
}
