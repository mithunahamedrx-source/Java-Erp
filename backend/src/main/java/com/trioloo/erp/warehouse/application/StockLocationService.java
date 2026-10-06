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
 * Stock Locations (E-005) - a position within a warehouse where goods physically sit ({@code WHS-008}).
 *
 * <p>🔴 SELLABILITY FOLLOWS THE TYPE AND IS NEVER CHOSEN. Only {@code STORAGE} is established as sellable;
 * {@code QUARANTINE} never is; the rest are not established as sellable, so none is (the database refuses any other
 * combination). {@code WHS-009}: no put-away, addressing, capacity or pick-sequencing rule exists and none is
 * invented here. 🔴 The type is fixed at creation - turning Quarantine into Storage would silently make held stock
 * sellable; archive the location and create another instead.
 */
@Service
public class StockLocationService {

    public static final String VIEW = "warehouse.stock-location.view";
    public static final String MANAGE = "warehouse.stock-location.manage";
    static final Set<String> TYPES = Set.of("STORAGE", "STAGING", "DESPATCH", "QUARANTINE", "SCRAP", "BUILD_STAGING");

    private final JdbcTemplate jdbc;
    private final CurrentActor currentActor;

    public StockLocationService(JdbcTemplate jdbc, CurrentActor currentActor) {
        this.jdbc = jdbc;
        this.currentActor = currentActor;
    }

    public record Row(UUID id, UUID warehouseId, String warehouseName, String identifier, String description,
                      String locationType, boolean sellable, String recordStatus, Instant updatedAt, long version) {
    }

    public record Kpis(long locations, long storage, long quarantine, long buildStaging, long scrap) {
    }

    public record Page(List<Row> content, long totalElements, int page, int size, int totalPages, Kpis kpis) {
    }

    public record Input(UUID warehouseId, String identifier, String description, String locationType, String recordStatus, Long version) {
    }

    private Actor require(String permission) {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(permission)) {
            throw new AccessDeniedByPermissionException(permission);
        }
        return actor;
    }

    @Transactional(readOnly = true)
    public Page list(String search, UUID warehouseId, String type, Boolean sellable, String status, int page, int size) {
        require(VIEW);
        int pageSize = Math.min(Math.max(size, 1), 100);
        int current = Math.max(page, 0);
        String like = search == null || search.isBlank() ? null : "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
        String kind = type == null || type.isBlank() ? null : type.trim().toUpperCase(Locale.ROOT);
        String state = status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);

        String where = """
                 WHERE (?::text IS NULL OR lower(l.identifier) LIKE ?::text OR lower(coalesce(l.description, '')) LIKE ?::text)
                   AND (?::uuid IS NULL OR l.warehouse_id = ?::uuid)
                   AND (?::text IS NULL OR l.location_type = ?::text)
                   AND (?::boolean IS NULL OR l.sellable = ?::boolean)
                   AND (?::text IS NULL OR l.record_status = ?::text)
                """;
        Object[] filters = {like, like, like, warehouseId, warehouseId, kind, kind, sellable, sellable, state, state};
        Long total = jdbc.queryForObject("SELECT count(*) FROM stock_location l" + where, Long.class, filters);
        Object[] paged = java.util.Arrays.copyOf(filters, filters.length + 2);
        paged[filters.length] = pageSize;
        paged[filters.length + 1] = (long) current * pageSize;
        List<Row> rows = jdbc.query("""
                SELECT l.id, l.warehouse_id, w.name AS warehouse_name, l.identifier, l.description, l.location_type, l.sellable,
                       l.record_status, l.updated_at, l.version
                  FROM stock_location l JOIN warehouse w ON w.id = l.warehouse_id
                """ + where + " ORDER BY w.identifier, l.identifier LIMIT ? OFFSET ?",
                (rs, n) -> new Row((UUID) rs.getObject("id"), (UUID) rs.getObject("warehouse_id"), rs.getString("warehouse_name"),
                        rs.getString("identifier"), rs.getString("description"), rs.getString("location_type"), rs.getBoolean("sellable"),
                        rs.getString("record_status"), rs.getTimestamp("updated_at").toInstant(), rs.getLong("version")), paged);
        long count = total == null ? 0 : total;
        Kpis kpis = jdbc.queryForObject("""
                SELECT count(*), count(*) FILTER (WHERE location_type = 'STORAGE'), count(*) FILTER (WHERE location_type = 'QUARANTINE'),
                       count(*) FILTER (WHERE location_type = 'BUILD_STAGING'), count(*) FILTER (WHERE location_type = 'SCRAP')
                  FROM stock_location
                """, (rs, n) -> new Kpis(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getLong(5)));
        return new Page(rows, count, current, pageSize, (int) Math.max(1, Math.ceil(count / (double) pageSize)), kpis);
    }

    @Transactional
    public UUID create(Input input) {
        Actor actor = require(MANAGE);
        if (input.warehouseId() == null) {
            throw new IllegalArgumentException("Choose the warehouse this location belongs to.");
        }
        String identifier = WarehouseService.required(input.identifier(), "Identifier").toUpperCase(Locale.ROOT);
        if (!identifier.matches("[A-Z0-9][A-Z0-9_-]{0,63}")) {
            throw new IllegalArgumentException("The identifier uses letters, digits, - and _ only, for example MAIN-STORAGE-A.");
        }
        String type = type(input.locationType());
        List<String> warehouseStatus = jdbc.queryForList("SELECT record_status FROM warehouse WHERE id = ?", String.class, input.warehouseId());
        if (warehouseStatus.isEmpty()) {
            throw new IllegalArgumentException("No such warehouse.");
        }
        // PRD-063 applied: an archived or suspended record takes no NEW references.
        if (!"ACTIVE".equals(warehouseStatus.getFirst())) {
            throw new IllegalStateException("This warehouse is not active, so it cannot take a new location.");
        }
        if (Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM stock_location WHERE lower(identifier) = lower(?))",
                Boolean.class, identifier))) {
            throw new IllegalStateException("A location with the identifier " + identifier + " already exists.");
        }
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO stock_location (id, warehouse_id, identifier, description, location_type, sellable, record_status, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, input.warehouseId(), identifier, WarehouseService.blankToNull(input.description()), type,
                "STORAGE".equals(type), WarehouseService.status(input.recordStatus(), "ACTIVE"), actor.id(), actor.id());
        return id;
    }

    @Transactional
    public void update(UUID id, Input input) {
        Actor actor = require(MANAGE);
        int changed = jdbc.update("""
                UPDATE stock_location SET description = ?, record_status = ?, updated_at = now(), updated_by = ?, version = version + 1
                 WHERE id = ? AND (?::bigint IS NULL OR version = ?::bigint)
                """, WarehouseService.blankToNull(input.description()), WarehouseService.status(input.recordStatus(), null),
                actor.id(), id, input.version(), input.version());
        if (changed == 0) {
            boolean exists = Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS (SELECT 1 FROM stock_location WHERE id = ?)", Boolean.class, id));
            throw exists ? new IllegalStateException("This location was changed by someone else. Reload and try again.")
                    : new IllegalArgumentException("No such location.");
        }
    }

    static String type(String requested) {
        if (requested == null || requested.isBlank()) {
            throw new IllegalArgumentException("Choose a location type.");
        }
        String upper = requested.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
        if (!TYPES.contains(upper)) {
            throw new IllegalArgumentException("'" + requested + "' is not a location type. Allowed: " + String.join(", ", TYPES));
        }
        return upper;
    }
}
