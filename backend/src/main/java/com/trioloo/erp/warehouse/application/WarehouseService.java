package com.trioloo.erp.warehouse.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Warehouses (E-004) - the unit at which availability, allocation, assembly and fulfilment are determined
 * ({@code WHS-007}).
 *
 * <p>🔴 NO STOCK FIGURE LIVES HERE. Stock exists only within a warehouse ({@code INV-4.1}) but is derived from
 * movements ({@code DB-001}); this is master data. 🔴 Nothing is deleted: a warehouse referenced by history is
 * archived ({@code INV-4.3}), so there is no delete path. 🔴 Every entry point requires its own capability
 * ({@code PRM-004}); viewing never implies managing.
 */
@Service
public class WarehouseService {

    public static final String VIEW = "warehouse.warehouse.view";
    public static final String MANAGE = "warehouse.warehouse.manage";
    static final Set<String> STATUSES = Set.of("DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVED");

    private final JdbcTemplate jdbc;
    private final CurrentActor currentActor;

    public WarehouseService(JdbcTemplate jdbc, CurrentActor currentActor) {
        this.jdbc = jdbc;
        this.currentActor = currentActor;
    }

    public record Row(UUID id, String identifier, String name, String address, String recordStatus,
                      long locations, long quarantineLocations, Instant updatedAt, long version) {
    }

    public record Kpis(long warehouses, long active, long archived, long locations, long quarantineLocations) {
    }

    public record Page(List<Row> content, long totalElements, int page, int size, int totalPages, Kpis kpis) {
    }

    public record Input(String identifier, String name, String address, String recordStatus, Long version) {
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

        Long total = jdbc.queryForObject("""
                SELECT count(*) FROM warehouse w
                 WHERE (?::text IS NULL OR lower(w.name) LIKE ?::text OR lower(w.identifier) LIKE ?::text OR lower(coalesce(w.address, '')) LIKE ?::text)
                   AND (?::text IS NULL OR w.record_status = ?::text)
                """, Long.class, like, like, like, like, state, state);
        List<Row> rows = jdbc.query("""
                SELECT w.id, w.identifier, w.name, w.address, w.record_status, w.updated_at, w.version,
                       (SELECT count(*) FROM stock_location l WHERE l.warehouse_id = w.id) AS locations,
                       (SELECT count(*) FROM stock_location l WHERE l.warehouse_id = w.id AND l.location_type = 'QUARANTINE') AS quarantine
                  FROM warehouse w
                 WHERE (?::text IS NULL OR lower(w.name) LIKE ?::text OR lower(w.identifier) LIKE ?::text OR lower(coalesce(w.address, '')) LIKE ?::text)
                   AND (?::text IS NULL OR w.record_status = ?::text)
                 ORDER BY w.identifier
                 LIMIT ? OFFSET ?
                """, (rs, n) -> new Row((UUID) rs.getObject("id"), rs.getString("identifier"), rs.getString("name"),
                        rs.getString("address"), rs.getString("record_status"), rs.getLong("locations"), rs.getLong("quarantine"),
                        rs.getTimestamp("updated_at").toInstant(), rs.getLong("version")),
                like, like, like, like, state, state, pageSize, (long) current * pageSize);
        long count = total == null ? 0 : total;
        return new Page(rows, count, current, pageSize, (int) Math.max(1, Math.ceil(count / (double) pageSize)), kpis());
    }

    private Kpis kpis() {
        return jdbc.queryForObject("""
                SELECT (SELECT count(*) FROM warehouse),
                       (SELECT count(*) FROM warehouse WHERE record_status = 'ACTIVE'),
                       (SELECT count(*) FROM warehouse WHERE record_status = 'ARCHIVED'),
                       (SELECT count(*) FROM stock_location),
                       (SELECT count(*) FROM stock_location WHERE location_type = 'QUARANTINE')
                """, (rs, n) -> new Kpis(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5)));
    }

    @Transactional
    public UUID create(Input input) {
        Actor actor = require(MANAGE);
        String identifier = required(input.identifier(), "Identifier").toUpperCase(Locale.ROOT);
        String name = required(input.name(), "Name");
        if (!identifier.matches("[A-Z0-9][A-Z0-9_-]{0,31}")) {
            throw new IllegalArgumentException("The identifier uses letters, digits, - and _ only, for example WH-MAIN.");
        }
        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM warehouse WHERE lower(identifier) = lower(?))",
                Boolean.class, identifier))) {
            throw new IllegalStateException("A warehouse with the identifier " + identifier + " already exists.");
        }
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO warehouse (id, identifier, name, address, record_status, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, identifier, name, blankToNull(input.address()), status(input.recordStatus(), "ACTIVE"),
                actor.id(), actor.id());
        return id;
    }

    @Transactional
    public void update(UUID id, Input input) {
        Actor actor = require(MANAGE);
        String name = required(input.name(), "Name");
        int changed = jdbc.update("""
                UPDATE warehouse SET name = ?, address = ?, record_status = ?, updated_at = now(), updated_by = ?, version = version + 1
                 WHERE id = ? AND (?::bigint IS NULL OR version = ?::bigint)
                """, name, blankToNull(input.address()), status(input.recordStatus(), null), actor.id(), id,
                input.version(), input.version());
        if (changed == 0) {
            boolean exists = Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM warehouse WHERE id = ?)", Boolean.class, id));
            throw exists ? new IllegalStateException("This warehouse was changed by someone else. Reload and try again.")
                    : new IllegalArgumentException("No such warehouse.");
        }
    }

    static String required(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(label + " is required.");
        }
        return value.trim();
    }

    static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    static String status(String requested, String fallback) {
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
