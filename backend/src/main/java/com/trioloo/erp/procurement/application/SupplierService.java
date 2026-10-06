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
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Suppliers (E-025) - a SIMPLE PARTY RECORD ({@code PRC-008}): the party from whom goods are acquired.
 *
 * <p>🔴 What is NOT here, on purpose: payment terms and lead times (their home is undecided, {@code GAP-079}), sourcing
 * terms, per-product pricing, a catalogue, a score. Purchase history, outstanding balance and advance held are DERIVED
 * from purchase orders, receipts and payables ({@code PRC-009}); none exists yet, so none is shown.
 *
 * <p>🔴 {@code PRC-010} / {@code INV-25.1}: creating a supplier and approving payment to that supplier are never held by
 * one actor. Payment approval does not exist yet, so the pair is guarded by keeping {@code procurement.supplier.manage}
 * and any future payment-approval capability apart in role design. 🔴 Archived, never deleted ({@code PRC-011}).
 */
@Service
public class SupplierService {

    public static final String VIEW = "procurement.supplier.view";
    public static final String MANAGE = "procurement.supplier.manage";
    private static final Set<String> STATUSES = Set.of("DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVED");

    private final JdbcTemplate jdbc;
    private final CurrentActor currentActor;

    public SupplierService(JdbcTemplate jdbc, CurrentActor currentActor) {
        this.jdbc = jdbc;
        this.currentActor = currentActor;
    }

    public record Row(UUID id, String name, String contactName, String phone, String email, String address, String currency,
                      String externalReference, LocalDate activeFrom, LocalDate activeUntil, String recordStatus,
                      Instant createdAt, Instant updatedAt, long version,
                      long orders, @MonetaryAmount BigDecimal totalPurchaseValue) {
    }

    /** {@code totalDue} stays null: a due is a payable (accepted receipts less payments), and none exists yet. */
    public record Kpis(long suppliers, long active, long archived, @MonetaryAmount BigDecimal totalPurchase, String purchaseCurrency,
                       @MonetaryAmount BigDecimal totalDue) {
    }

    public record Page(List<Row> content, long totalElements, int page, int size, int totalPages, Kpis kpis) {
    }

    public record Input(String name, String contactName, String phone, String email, String address, String currency,
                        String externalReference, LocalDate activeFrom, LocalDate activeUntil, String recordStatus, Long version) {
    }

    private Actor require(String permission) {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(permission)) {
            throw new AccessDeniedByPermissionException(permission);
        }
        return actor;
    }

    /** The start of a reporting period, or null for all time. Weeks start on Monday. */
    private static LocalDate periodStart(String period) {
        LocalDate today = LocalDate.now();
        if (period == null) return null;
        return switch (period.trim().toLowerCase(Locale.ROOT)) {
            case "today" -> today;
            case "week" -> today.with(java.time.DayOfWeek.MONDAY);
            case "month" -> today.withDayOfMonth(1);
            default -> null;
        };
    }

    @Transactional(readOnly = true)
    public Page list(String search, String status, String currency, String activity, String period, int page, int size) {
        require(VIEW);
        int pageSize = Math.min(Math.max(size, 1), 100);
        int current = Math.max(page, 0);
        String like = search == null || search.isBlank() ? null : "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
        String state = status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);
        String money = currency == null || currency.isBlank() ? null : currency.trim().toUpperCase(Locale.ROOT);
        String act = activity == null || activity.isBlank() ? null : activity.trim().toLowerCase(Locale.ROOT);
        LocalDate from = periodStart(period);
        // PRC-067.b / PRC-009 - purchase figures are DERIVED from purchase orders: live orders only, in the supplier's own
        // currency, inside the chosen period.
        String live = " p.supplier_id = s.id AND p.status <> 'CANCELLED' AND (?::date IS NULL OR p.order_date >= ?::date) ";
        String where = " WHERE (?::text IS NULL OR lower(s.name) LIKE ?::text OR lower(coalesce(s.contact_name, '')) LIKE ?::text"
                + " OR lower(coalesce(s.phone, '')) LIKE ?::text OR lower(coalesce(s.email, '')) LIKE ?::text"
                + " OR lower(coalesce(s.external_reference, '')) LIKE ?::text)"
                + " AND (?::text IS NULL OR s.record_status = ?::text)"
                + " AND (?::text IS NULL OR s.currency = ?::text)"
                + " AND (?::text IS NULL OR (?::text = 'with-orders' AND EXISTS (SELECT 1 FROM purchase_order p WHERE" + live + "))"
                + " OR (?::text = 'without-orders' AND NOT EXISTS (SELECT 1 FROM purchase_order p WHERE" + live + ")))";
        Object[] filters = {like, like, like, like, like, like, state, state, money, money, act, act, from, from, act, from, from};
        Long total = jdbc.queryForObject("SELECT count(*) FROM supplier s" + where, Long.class, filters);

        String value = "coalesce((SELECT sum(i.quantity_ordered * i.unit_cost) FROM purchase_order p JOIN purchase_order_item i ON i.purchase_order_id = p.id"
                + " WHERE" + live + "AND i.currency = s.currency), 0)";
        Object[] paged = new Object[4 + filters.length + 2];
        int k = 0;
        paged[k++] = from; paged[k++] = from;          // order count
        paged[k++] = from; paged[k++] = from;          // purchase value
        for (Object f : filters) paged[k++] = f;
        paged[k++] = pageSize;
        paged[k] = (long) current * pageSize;
        List<Row> rows = jdbc.query("SELECT s.id, s.name, s.contact_name, s.phone, s.email, s.address, s.currency, s.external_reference,"
                + " s.active_from, s.active_until, s.record_status, s.created_at, s.updated_at, s.version,"
                + " (SELECT count(*) FROM purchase_order p WHERE" + live + ") AS orders, " + value + " AS purchase_value"
                + " FROM supplier s" + where + " ORDER BY lower(s.name) LIMIT ? OFFSET ?",
                (rs, n) -> new Row((UUID) rs.getObject("id"), rs.getString("name"), rs.getString("contact_name"), rs.getString("phone"),
                        rs.getString("email"), rs.getString("address"), rs.getString("currency"), rs.getString("external_reference"),
                        rs.getObject("active_from", LocalDate.class), rs.getObject("active_until", LocalDate.class),
                        rs.getString("record_status"), rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant(),
                        rs.getLong("version"), rs.getLong("orders"), rs.getBigDecimal("purchase_value")), paged);
        long count = total == null ? 0 : total;

        // The strip follows the same filters. Purchase value is summed in one currency (the chosen one, else taka) so that
        // different currencies are never added together.
        String sumCurrency = money != null ? money : "BDT";
        Object[] kpiParams = new Object[3 + filters.length];
        kpiParams[0] = from;
        kpiParams[1] = from;
        kpiParams[2] = sumCurrency;
        System.arraycopy(filters, 0, kpiParams, 3, filters.length);
        Kpis kpis = jdbc.queryForObject("SELECT count(*), count(*) FILTER (WHERE s.record_status = 'ACTIVE'),"
                + " count(*) FILTER (WHERE s.record_status = 'ARCHIVED'),"
                + " coalesce(sum(" + value + ") FILTER (WHERE s.currency = ?::text), 0) FROM supplier s" + where,
                (rs, n) -> new Kpis(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getBigDecimal(4), sumCurrency, null), kpiParams);
        return new Page(rows, count, current, pageSize, (int) Math.max(1, Math.ceil(count / (double) pageSize)), kpis);
    }

    @Transactional
    public UUID create(Input input) {
        Actor actor = require(MANAGE);
        String name = required(input.name());
        validatePeriod(input);
        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM supplier WHERE lower(name) = lower(?))", Boolean.class, name))) {
            throw new IllegalStateException("A supplier named " + name + " already exists.");
        }
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO supplier (id, name, contact_name, phone, email, address, currency, external_reference, active_from, active_until,
                                      record_status, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, name, blank(input.contactName()), blank(input.phone()), blank(input.email()), blank(input.address()),
                currency(input.currency()), blank(input.externalReference()), input.activeFrom(), input.activeUntil(),
                status(input.recordStatus(), "ACTIVE"), actor.id(), actor.id());
        return id;
    }

    @Transactional
    public void update(UUID id, Input input) {
        Actor actor = require(MANAGE);
        String name = required(input.name());
        validatePeriod(input);
        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM supplier WHERE lower(name) = lower(?) AND id <> ?)",
                Boolean.class, name, id))) {
            throw new IllegalStateException("Another supplier is already named " + name + ".");
        }
        int changed = jdbc.update("""
                UPDATE supplier SET name = ?, contact_name = ?, phone = ?, email = ?, address = ?, currency = ?, external_reference = ?,
                       active_from = ?, active_until = ?, record_status = ?, updated_at = now(), updated_by = ?, version = version + 1
                 WHERE id = ? AND (?::bigint IS NULL OR version = ?::bigint)
                """, name, blank(input.contactName()), blank(input.phone()), blank(input.email()), blank(input.address()),
                currency(input.currency()), blank(input.externalReference()), input.activeFrom(), input.activeUntil(),
                status(input.recordStatus(), null), actor.id(), id, input.version(), input.version());
        if (changed == 0) {
            boolean exists = Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM supplier WHERE id = ?)", Boolean.class, id));
            throw exists ? new IllegalStateException("This supplier was changed by someone else. Reload and try again.")
                    : new IllegalArgumentException("No such supplier.");
        }
    }

    private static void validatePeriod(Input input) {
        if (input.activeFrom() != null && input.activeUntil() != null && input.activeUntil().isBefore(input.activeFrom())) {
            throw new IllegalArgumentException("The active period cannot end before it starts.");
        }
    }

    private static String required(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("The supplier's name is required.");
        }
        return name.trim();
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String currency(String value) {
        if (value == null || value.isBlank()) {
            return "BDT";
        }
        String upper = value.trim().toUpperCase(Locale.ROOT);
        if (!upper.matches("[A-Z]{3}")) {
            throw new IllegalArgumentException("The currency is a three-letter code such as BDT or USD.");
        }
        return upper;
    }

    private static String status(String requested, String fallback) {
        if (requested == null || requested.isBlank()) {
            if (fallback == null) {
                throw new IllegalArgumentException("A status is required.");
            }
            return fallback;
        }
        String upper = requested.trim().toUpperCase(Locale.ROOT);
        if (!STATUSES.contains(upper)) {
            throw new IllegalArgumentException("'" + requested + "' is not a record status. Allowed: " + String.join(", ", STATUSES));
        }
        return upper;
    }
}
