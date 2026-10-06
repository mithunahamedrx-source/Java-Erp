package com.trioloo.erp.procurement.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
                      Instant createdAt, Instant updatedAt, long version) {
    }

    public record Kpis(long suppliers, long active, long archived) {
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

    @Transactional(readOnly = true)
    public Page list(String search, String status, int page, int size) {
        require(VIEW);
        int pageSize = Math.min(Math.max(size, 1), 100);
        int current = Math.max(page, 0);
        String like = search == null || search.isBlank() ? null : "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
        String state = status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);
        String where = """
                 WHERE (?::text IS NULL OR lower(s.name) LIKE ?::text OR lower(coalesce(s.contact_name, '')) LIKE ?::text
                        OR lower(coalesce(s.phone, '')) LIKE ?::text OR lower(coalesce(s.email, '')) LIKE ?::text
                        OR lower(coalesce(s.external_reference, '')) LIKE ?::text)
                   AND (?::text IS NULL OR s.record_status = ?::text)
                """;
        Object[] filters = {like, like, like, like, like, like, state, state};
        Long total = jdbc.queryForObject("SELECT count(*) FROM supplier s" + where, Long.class, filters);
        Object[] paged = java.util.Arrays.copyOf(filters, filters.length + 2);
        paged[filters.length] = pageSize;
        paged[filters.length + 1] = (long) current * pageSize;
        List<Row> rows = jdbc.query("""
                SELECT s.id, s.name, s.contact_name, s.phone, s.email, s.address, s.currency, s.external_reference,
                       s.active_from, s.active_until, s.record_status, s.created_at, s.updated_at, s.version
                  FROM supplier s
                """ + where + " ORDER BY lower(s.name) LIMIT ? OFFSET ?",
                (rs, n) -> new Row((UUID) rs.getObject("id"), rs.getString("name"), rs.getString("contact_name"), rs.getString("phone"),
                        rs.getString("email"), rs.getString("address"), rs.getString("currency"), rs.getString("external_reference"),
                        rs.getObject("active_from", LocalDate.class), rs.getObject("active_until", LocalDate.class),
                        rs.getString("record_status"), rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant(),
                        rs.getLong("version")), paged);
        long count = total == null ? 0 : total;
        Kpis kpis = jdbc.queryForObject("""
                SELECT count(*), count(*) FILTER (WHERE record_status = 'ACTIVE'), count(*) FILTER (WHERE record_status = 'ARCHIVED') FROM supplier
                """, (rs, n) -> new Kpis(rs.getLong(1), rs.getLong(2), rs.getLong(3)));
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
