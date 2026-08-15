package com.trioloo.erp.product.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SerializationPolicy;
import com.trioloo.erp.product.infrastructure.persistence.ProductVariantEntity;
import com.trioloo.erp.product.infrastructure.persistence.ProductVariantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * The Stock Items CSV contract, {@code PRD-149}.
 *
 * <p>🔴 The header order below IS the contract and is deterministic ({@code API-058.a}). Export
 * and import headers are identical so a file round-trips ({@code PRD-148.c}).
 *
 * <p>🔴 {@code weighted_average_cost} is OMITTED ENTIRELY — not blanked — for an actor without
 * {@code inventory-costing.valuation.view} ({@code PRD-153.a}). A blank column advertises that
 * a restricted figure exists and is indistinguishable from a genuinely absent value.
 *
 * <p>🔴 {@code physical_stock}, {@code available_quantity} and {@code weighted_average_cost} are
 * exported for information and are NEVER importable ({@code PRD-149.a}, {@code API-058.e}).
 * Import writes no stock, no movement and no cost.
 */
@Service
public class StockItemCsvService {

    /** {@code PRD-149} — the canonical header order. */
    public static final List<String> HEADERS_WITHOUT_COST = List.of(
            "inventory_product_id", "inventory_sku", "technical_name", "brand",
            "inventory_category", "unit_of_measure", "barcode", "serialization_policy",
            "component_class", "record_status", "physical_stock", "available_quantity");

    public static final List<String> HEADERS_WITH_COST = List.of(
            "inventory_product_id", "inventory_sku", "technical_name", "brand",
            "inventory_category", "unit_of_measure", "barcode", "serialization_policy",
            "component_class", "record_status", "physical_stock", "available_quantity",
            "weighted_average_cost");

    /** 🔴 Read-only under {@code PRD-149}: present in an export, never accepted on import. */
    public static final Set<String> READ_ONLY_HEADERS =
            Set.of("physical_stock", "available_quantity", "weighted_average_cost");

    private final StockItemQueryService queries;
    private final StockItemCommandService commands;
    private final ProductVariantRepository variants;
    private final CurrentActor currentActor;
    private final Clock clock;

    private final Map<UUID, ImportPlan> pendingPlans = new HashMap<>();

    public StockItemCsvService(StockItemQueryService queries, StockItemCommandService commands,
                              ProductVariantRepository variants, CurrentActor currentActor, Clock clock) {
        this.queries = queries;
        this.commands = commands;
        this.variants = variants;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ export

    public List<String> headersFor(boolean includeCost) {
        return includeCost ? HEADERS_WITH_COST : HEADERS_WITHOUT_COST;
    }

    /** The import template — canonical headers, and 🔴 no fabricated example row ({@code UX-043.e}). */
    public String template() {
        return String.join(",", HEADERS_WITHOUT_COST) + "\r\n";
    }

    /**
     * Exports the ACTIVE result set — search, filters and sort — never only the visible page
     * ({@code UX-044.a}, {@code UX-044.b}).
     */
    @Transactional(readOnly = true)
    public String export(StockItemFilter filter) {
        boolean includeCost = queries.maySeeValuation();
        List<String> headers = headersFor(includeCost);
        List<StockItemView> rows = queries.allMatching(filter);

        StringBuilder csv = new StringBuilder();
        csv.append(String.join(",", headers)).append("\r\n");
        for (StockItemView row : rows) {
            List<String> cells = new ArrayList<>();
            cells.add(text(row.id().toString()));
            cells.add(text(row.inventorySku()));
            cells.add(text(row.technicalName()));
            cells.add(text(row.brand()));
            cells.add(text(row.inventoryCategory()));
            cells.add(text(row.unitOfMeasure()));
            cells.add(text(row.barcode()));
            cells.add(text(row.serializationPolicy() == null ? null : row.serializationPolicy().name()));
            cells.add(text(row.componentClass()));
            cells.add(text(row.recordStatus() == null ? null : row.recordStatus().name()));
            cells.add(decimal(row.physicalStock()));
            cells.add(decimal(row.availableQuantity()));
            if (includeCost) {
                cells.add(decimal(row.weightedAverageCost()));
            }
            csv.append(String.join(",", cells)).append("\r\n");
        }
        return csv.toString();
    }

    /**
     * Money and quantity as plain decimal text — no thousands separator, no currency symbol,
     * no locale formatting ({@code API-058.c}).
     *
     * <p>🔴 Nothing is rounded here. {@code DB-079} is the sole rounding owner and precision is
     * emitted exactly as held. An absent value is an empty cell, never {@code 0}.
     */
    static String decimal(BigDecimal value) {
        return value == null ? "" : value.toPlainString();
    }

    /**
     * RFC 4180 quoting, plus reversible spreadsheet formula-injection neutralisation
     * ({@code API-059}).
     *
     * <p>🔴 The STORED value is never mutated — the prefix exists only in the serialised file
     * and {@link #unprotect} removes it on import, so a round trip returns the original text.
     */
    static String text(String value) {
        if (value == null) {
            return "";
        }
        String out = value;
        if (!out.isEmpty() && "=+-@\t\r".indexOf(out.charAt(0)) >= 0) {
            out = "'" + out;
        }
        if (out.contains(",") || out.contains("\"") || out.contains("\n") || out.contains("\r")) {
            out = "\"" + out.replace("\"", "\"\"") + "\"";
        }
        return out;
    }

    static String unprotect(String value) {
        if (value != null && value.length() > 1 && value.charAt(0) == '\''
                && "=+-@\t\r".indexOf(value.charAt(1)) >= 0) {
            return value.substring(1);
        }
        return value;
    }

    // ------------------------------------------------------------------ import

    /**
     * Parses and validates without writing anything ({@code API-060.f}, {@code UX-043.a}).
     *
     * <p>Returns a plan the operator confirms separately. 🔴 Nothing before explicit
     * confirmation mutates a record.
     */
    @Transactional(readOnly = true)
    public ImportPlan validate(String csv) {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.STOCK_ITEM_MANAGE)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.STOCK_ITEM_MANAGE);
        }

        List<RowOutcome> outcomes = new ArrayList<>();
        List<List<String>> parsed = CsvReader.parse(csv);
        if (parsed.isEmpty()) {
            throw new StockItemValidationException("file", "The file is empty.");
        }

        List<String> headers = parsed.getFirst().stream()
                .map(h -> h.trim().toLowerCase(Locale.ROOT)).toList();

        Set<String> duplicates = new HashSet<>();
        Set<String> seen = new HashSet<>();
        for (String h : headers) {
            if (!seen.add(h)) {
                duplicates.add(h);
            }
        }
        if (!duplicates.isEmpty()) {
            throw new StockItemValidationException("header", "Duplicate column(s): " + duplicates);
        }
        for (String required : List.of("inventory_sku")) {
            if (!headers.contains(required)) {
                throw new StockItemValidationException("header", "Missing required column: " + required);
            }
        }

        Set<String> skusInFile = new HashSet<>();
        List<PlannedRow> planned = new ArrayList<>();

        for (int i = 1; i < parsed.size(); i++) {
            int rowNumber = i + 1; // 1-based including the header row, as an operator counts.
            List<String> cells = parsed.get(i);
            if (cells.stream().allMatch(c -> c == null || c.isBlank())) {
                continue;
            }
            Map<String, String> row = new LinkedHashMap<>();
            for (int c = 0; c < headers.size(); c++) {
                row.put(headers.get(c), c < cells.size() ? unprotect(cells.get(c)) : null);
            }

            try {
                // 🔴 PRD-149 - a read-only column carrying a value is an ERROR, never a silent
                // ignore. Exportable does not imply importable (API-058.e), and silently
                // dropping it would let an operator believe stock had been imported.
                for (String readOnly : READ_ONLY_HEADERS) {
                    String supplied = row.get(readOnly);
                    if (supplied != null && !supplied.isBlank()) {
                        throw new StockItemValidationException(readOnly,
                                "'" + readOnly + "' is derived and read-only (PRD-149). Remove the value; "
                                        + "stock and cost are never set through Product CSV.");
                    }
                }

                String sku = value(row, "inventory_sku");
                if (sku == null || sku.isBlank()) {
                    throw new StockItemValidationException("inventory_sku", "Inventory SKU is required.");
                }
                if (!skusInFile.add(sku.toLowerCase(Locale.ROOT))) {
                    throw new StockItemValidationException("inventory_sku",
                            "Duplicate Inventory SKU '" + sku + "' appears more than once in this file.");
                }

                // PRD-152 - identity is a stable canonical identifier. Never a name, never
                // fuzzy, never row order.
                Optional<ProductVariantEntity> existing = variants.findByInventorySkuIgnoreCase(sku);
                String idCell = value(row, "inventory_product_id");
                if (idCell != null && !idCell.isBlank()) {
                    UUID id = parseUuid(idCell);
                    Optional<ProductVariantEntity> byId = variants.findById(id);
                    if (byId.isEmpty()) {
                        throw new StockItemValidationException("inventory_product_id",
                                "No Stock Item with id " + idCell + ".");
                    }
                    if (existing.isPresent() && !existing.get().getId().equals(id)) {
                        throw new StockItemValidationException("inventory_product_id",
                                "Ambiguous identity: this id and this Inventory SKU identify different records.");
                    }
                    existing = byId;
                }

                StockItemCommandService.StockItemInput input = new StockItemCommandService.StockItemInput(
                        sku, value(row, "technical_name"), value(row, "brand"),
                        value(row, "inventory_category"), value(row, "unit_of_measure"),
                        value(row, "barcode"), enumValue(SerializationPolicy.class, row, "serialization_policy"),
                        value(row, "component_class"), enumValue(RecordStatus.class, row, "record_status"));

                if (existing.isPresent()) {
                    planned.add(new PlannedRow(rowNumber, existing.get().getId(), input, RowAction.UPDATE));
                    outcomes.add(new RowOutcome(rowNumber, RowResult.VALID, null, "Update " + sku));
                } else {
                    if (blank(input.technicalName()) || blank(input.unitOfMeasure())) {
                        throw new StockItemValidationException("technical_name",
                                "Creating a Stock Item requires inventory_sku, technical_name and unit_of_measure.");
                    }
                    planned.add(new PlannedRow(rowNumber, null, input, RowAction.CREATE));
                    outcomes.add(new RowOutcome(rowNumber, RowResult.VALID, null, "Create " + sku));
                }
            } catch (StockItemValidationException e) {
                outcomes.add(new RowOutcome(rowNumber, RowResult.ERROR, e.field(), e.getMessage()));
            }
        }

        ImportPlan plan = new ImportPlan(UUID.randomUUID(), outcomes, planned);
        if (plan.errorCount() == 0) {
            pendingPlans.put(plan.planId(), plan);
        }
        return plan;
    }

    /**
     * Executes a previously validated plan.
     *
     * <p>🔴 ATOMIC per confirmed job ({@code API-060.d}): the whole method is one transaction,
     * so a failure on any row commits nothing. Per-row outcomes are still reported
     * ({@code API-060.c}) — atomic commit and per-record reporting are not in tension.
     *
     * <p>🔴 IDEMPOTENT ({@code API-061.a}): a plan is consumed on first confirmation, so
     * re-submitting the same job creates no duplicates. Identity is the plan and the canonical
     * row identifiers — never the filename.
     */
    @Transactional
    public ImportResult confirm(UUID planId) {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.STOCK_ITEM_MANAGE)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.STOCK_ITEM_MANAGE);
        }

        ImportPlan plan = pendingPlans.remove(planId);
        if (plan == null) {
            throw new StockItemValidationException("planId",
                    "This import was already confirmed, or its validation has expired. Re-upload the file.");
        }

        Instant now = Instant.now(clock);
        List<RowOutcome> outcomes = new ArrayList<>();
        int created = 0;
        int updated = 0;

        for (PlannedRow row : plan.rows()) {
            if (row.action() == RowAction.CREATE) {
                commands.createInternal(row.input(), actor.id(), now);
                created++;
                outcomes.add(new RowOutcome(row.rowNumber(), RowResult.VALID, null,
                        "Created " + row.input().inventorySku()));
            } else {
                commands.updateInternal(row.id(), row.input(), null, actor.id(), now);
                updated++;
                outcomes.add(new RowOutcome(row.rowNumber(), RowResult.VALID, null,
                        "Updated " + row.input().inventorySku()));
            }
        }
        return new ImportResult(planId, created, updated, outcomes);
    }

    private static boolean blank(String v) {
        return v == null || v.isBlank();
    }

    private static String value(Map<String, String> row, String header) {
        String v = row.get(header);
        return v == null || v.isBlank() ? null : v.trim();
    }

    private static UUID parseUuid(String raw) {
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            throw new StockItemValidationException("inventory_product_id", "'" + raw + "' is not a valid identifier.");
        }
    }

    private static <E extends Enum<E>> E enumValue(Class<E> type, Map<String, String> row, String header) {
        String raw = value(row, header);
        if (raw == null) {
            return null;
        }
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new StockItemValidationException(header,
                    "'" + raw + "' is not a permitted value. Allowed: "
                            + String.join(", ", java.util.Arrays.stream(type.getEnumConstants())
                            .map(Enum::name).toList()));
        }
    }

    // ------------------------------------------------------------------ types

    public enum RowResult { VALID, WARNING, ERROR }

    enum RowAction { CREATE, UPDATE }

    /** ⚠ A workflow result, NOT a business entity state ({@code UX-043.b}). */
    public record RowOutcome(int rowNumber, RowResult result, String field, String message) {
    }

    record PlannedRow(int rowNumber, UUID id, StockItemCommandService.StockItemInput input, RowAction action) {
    }

    public record ImportPlan(UUID planId, List<RowOutcome> outcomes, List<PlannedRow> rows) {
        public long errorCount() {
            return outcomes.stream().filter(o -> o.result() == RowResult.ERROR).count();
        }

        public long validCount() {
            return outcomes.stream().filter(o -> o.result() == RowResult.VALID).count();
        }
    }

    public record ImportResult(UUID planId, int created, int updated, List<RowOutcome> outcomes) {
    }

    /** A minimal RFC 4180 reader — quoted fields, escaped quotes, embedded newlines. */
    static final class CsvReader {
        static List<List<String>> parse(String input) {
            List<List<String>> rows = new ArrayList<>();
            List<String> row = new ArrayList<>();
            StringBuilder cell = new StringBuilder();
            boolean quoted = false;

            for (int i = 0; i < input.length(); i++) {
                char c = input.charAt(i);
                if (quoted) {
                    if (c == '"') {
                        if (i + 1 < input.length() && input.charAt(i + 1) == '"') {
                            cell.append('"');
                            i++;
                        } else {
                            quoted = false;
                        }
                    } else {
                        cell.append(c);
                    }
                } else if (c == '"') {
                    quoted = true;
                } else if (c == ',') {
                    row.add(cell.toString());
                    cell.setLength(0);
                } else if (c == '\n') {
                    row.add(cell.toString());
                    cell.setLength(0);
                    rows.add(row);
                    row = new ArrayList<>();
                } else if (c != '\r') {
                    cell.append(c);
                }
            }
            if (cell.length() > 0 || !row.isEmpty()) {
                row.add(cell.toString());
                rows.add(row);
            }
            return rows;
        }

        private CsvReader() {
        }
    }
}
