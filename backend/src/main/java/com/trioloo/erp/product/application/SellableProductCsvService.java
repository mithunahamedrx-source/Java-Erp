package com.trioloo.erp.product.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SellableNature;
import com.trioloo.erp.product.infrastructure.persistence.SellableProductEntity;
import com.trioloo.erp.product.infrastructure.persistence.SellableProductRepository;
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
 * The Sellable Products CSV contract, {@code PRD-150}.
 *
 * <p>🔴 THE HEADER ORDER BELOW IS THE CONTRACT and is transcribed column by column from
 * {@code PRD-150}'s matrix — not reconstructed from memory ({@code API-058.a}). Export and
 * import headers are IDENTICAL so a file round-trips ({@code PRD-148.c}).
 *
 * <p>🔴 {@code listing_count} IS DELIBERATELY ABSENT FROM THE HEADER SET ENTIRELY —
 * {@code PRD-150} marks it NOT EXPORTED because no canonical counting basis exists
 * ({@code UX-037.f}). Omitted, never blank: a blank column advertises that a figure exists.
 *
 * <p>🔴 {@code active_build_template_version} is EXPORTED AS A READ-ONLY REFERENCE and is
 * NEVER importable ({@code PRD-150.b}). Exportable does not imply importable
 * ({@code API-058.e}).
 *
 * <p>🔴 {@code nature} IS CREATE-ONLY. An update attempting to change it is an ERROR, never a
 * silent rewrite ({@code PRD-150.a}, {@code PRD-070}, {@code PRD-152.e}).
 *
 * <p>🔴 BOM, BUILD TEMPLATES AND BUNDLE MEMBERSHIP ARE OUT OF V1 CSV SCOPE — a DECISION, not
 * an omission ({@code PRD-150.b}, {@code PRD-150.c}). There is no {@code BuildTemplates.csv},
 * no {@code BOMLines.csv} and no flattened member cell, so a bulk file can never route an
 * approval-bearing, version-creating act through a spreadsheet. A {@code BUNDLE} row may be
 * created or updated; its members are authored in the application.
 */
@Service
public class SellableProductCsvService {

    /** {@code PRD-150} — the canonical header order, exactly. */
    public static final List<String> HEADERS = List.of(
            "sellable_product_id",
            "sellable_sku",
            "name",
            "nature",
            "sellable_category",
            "record_status",
            "simple_target_inventory_sku",
            "simple_quantity_per_sale_unit",
            "assembled_finished_inventory_sku",
            "active_build_template_version",
            "warranty_package");

    /** 🔴 Present in an export, NEVER accepted on import ({@code PRD-150.b}). */
    public static final Set<String> READ_ONLY_HEADERS = Set.of("active_build_template_version");

    /**
     * 🔴 Headers that do not exist in this contract and must be REFUSED rather than ignored.
     *
     * <p>Silently dropping {@code bom_lines} or {@code bundle_members} would let an operator
     * believe a build definition had been imported when nothing was written — the exact
     * failure {@code PRD-150.b} exists to prevent.
     */
    public static final Set<String> EXCLUDED_HEADERS = Set.of(
            "bom_lines", "bom_line", "build_template", "build_template_version", "components",
            "bundle_members", "bundle_member", "members", "listing_count",
            "assembled_finished_variant_id", "ready_built_quantity", "assembled_stock",
            "channel_price", "price", "cost", "margin", "stock", "available_quantity");

    private final SellableProductQueryService queries;
    private final SellableProductCommandService commands;
    private final SellableProductRepository sellables;
    private final CurrentActor currentActor;
    private final Clock clock;

    private final Map<UUID, ImportPlan> pendingPlans = new HashMap<>();

    public SellableProductCsvService(SellableProductQueryService queries,
                                     SellableProductCommandService commands,
                                     SellableProductRepository sellables,
                                     CurrentActor currentActor,
                                     Clock clock) {
        this.queries = queries;
        this.commands = commands;
        this.sellables = sellables;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ export

    /** Canonical headers, and 🔴 no fabricated example row ({@code UX-043.e}). */
    public String template() {
        return String.join(",", HEADERS) + "\r\n";
    }

    /**
     * Exports the ACTIVE result set — search, filters and sort — never only the visible page
     * ({@code UX-044.a}, {@code UX-044.b}).
     */
    @Transactional(readOnly = true)
    public String export(SellableProductFilter filter) {
        List<SellableProductView> rows = queries.allMatching(filter);

        StringBuilder csv = new StringBuilder();
        csv.append(String.join(",", HEADERS)).append("\r\n");
        for (SellableProductView row : rows) {
            List<String> cells = new ArrayList<>();
            cells.add(StockItemCsvService.text(row.id().toString()));
            cells.add(StockItemCsvService.text(row.sellableSku()));
            cells.add(StockItemCsvService.text(row.name()));
            cells.add(StockItemCsvService.text(row.nature().name()));
            cells.add(StockItemCsvService.text(row.sellableCategory()));
            cells.add(StockItemCsvService.text(row.recordStatus().name()));
            cells.add(StockItemCsvService.text(row.simpleTargetInventorySku()));
            cells.add(StockItemCsvService.decimal(row.simpleQuantityPerSaleUnit()));
            cells.add(StockItemCsvService.text(row.assembledFinishedInventorySku()));
            cells.add(StockItemCsvService.text(row.activeBuildTemplateVersion() == null
                    ? null : String.valueOf(row.activeBuildTemplateVersion())));
            cells.add(StockItemCsvService.text(row.warrantyPackage()));
            csv.append(String.join(",", cells)).append("\r\n");
        }
        return csv.toString();
    }

    // ------------------------------------------------------------------ import

    /** Parses and validates WITHOUT WRITING ANYTHING ({@code API-060.f}, {@code UX-043.a}). */
    @Transactional(readOnly = true)
    public ImportPlan validate(String csv) {
        requireManager();

        List<RowOutcome> outcomes = new ArrayList<>();
        List<List<String>> parsed = StockItemCsvService.CsvReader.parse(csv);
        if (parsed.isEmpty()) {
            throw new SellableProductValidationException("file", "The file is empty.");
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
            throw new SellableProductValidationException("header", "Duplicate column(s): " + duplicates);
        }
        if (!headers.contains("sellable_sku")) {
            throw new SellableProductValidationException("header",
                    "Missing required column: sellable_sku");
        }
        for (String excluded : EXCLUDED_HEADERS) {
            if (headers.contains(excluded)) {
                throw new SellableProductValidationException("header",
                        "'" + excluded + "' is not part of the Sellable Products contract "
                                + "(PRD-150). Build Templates, BOM lines and bundle membership are "
                                + "authored in the application, never imported.");
            }
        }

        Set<String> skusInFile = new HashSet<>();
        List<PlannedRow> planned = new ArrayList<>();

        for (int i = 1; i < parsed.size(); i++) {
            int rowNumber = i + 1;
            List<String> cells = parsed.get(i);
            if (cells.stream().allMatch(c -> c == null || c.isBlank())) {
                continue;
            }
            Map<String, String> row = new LinkedHashMap<>();
            for (int c = 0; c < headers.size(); c++) {
                row.put(headers.get(c), c < cells.size()
                        ? StockItemCsvService.unprotect(cells.get(c)) : null);
            }

            try {
                // 🔴 PRD-150.b — a read-only column carrying a value is an ERROR, never a
                // silent ignore. Dropping it quietly would let an operator believe a template
                // version had been set.
                for (String readOnly : READ_ONLY_HEADERS) {
                    String supplied = row.get(readOnly);
                    if (supplied != null && !supplied.isBlank()) {
                        throw new SellableProductValidationException(readOnly,
                                "'" + readOnly + "' is a READ-ONLY reference (PRD-150.b). Remove the "
                                        + "value; a Build Template version is never set through CSV.");
                    }
                }

                String sku = value(row, "sellable_sku");
                if (sku == null) {
                    throw new SellableProductValidationException("sellable_sku",
                            "Sellable SKU is required.");
                }
                if (!skusInFile.add(sku.toLowerCase(Locale.ROOT))) {
                    throw new SellableProductValidationException("sellable_sku",
                            "Duplicate Sellable SKU '" + sku + "' appears more than once in this file.");
                }

                // 🔴 PRD-152 — identity is a STABLE CANONICAL IDENTIFIER. Never a name, never
                // fuzzy, never row order (PRD-152.a, PRD-152.c).
                Optional<SellableProductEntity> existing = sellables.findBySellableSkuIgnoreCase(sku);
                String idCell = value(row, "sellable_product_id");
                if (idCell != null) {
                    UUID id = parseUuid(idCell);
                    Optional<SellableProductEntity> byId = sellables.findById(id);
                    if (byId.isEmpty()) {
                        throw new SellableProductValidationException("sellable_product_id",
                                "No Sellable Product with id " + idCell + ".");
                    }
                    if (existing.isPresent() && !existing.get().getId().equals(id)) {
                        throw new SellableProductValidationException("sellable_product_id",
                                "Ambiguous identity: this id and this Sellable SKU identify "
                                        + "different records.");
                    }
                    existing = byId;
                }

                SellableNature nature = enumValue(SellableNature.class, row, "nature");

                SellableProductCommandService.SellableProductInput input =
                        new SellableProductCommandService.SellableProductInput(
                                sku,
                                value(row, "name"),
                                nature,
                                null, // description is not part of the PRD-150 contract
                                value(row, "sellable_category"),
                                value(row, "warranty_package"),
                                enumValue(RecordStatus.class, row, "record_status"),
                                value(row, "simple_target_inventory_sku"),
                                decimalValue(row, "simple_quantity_per_sale_unit"),
                                value(row, "assembled_finished_inventory_sku"));

                if (existing.isPresent()) {
                    // 🔴 PRD-150.a / PRD-070 — nature is IMMUTABLE on update. Detected here so
                    // the operator sees it in the preview, and refused again in the command
                    // service so no other entry point can bypass it.
                    if (nature != null && nature != existing.get().getNature()) {
                        throw new SellableProductValidationException("nature",
                                "Nature is immutable (PRD-070). '" + sku + "' is "
                                        + existing.get().getNature() + " and cannot become " + nature
                                        + ". Create a new Sellable Product instead.");
                    }
                    planned.add(new PlannedRow(rowNumber, existing.get().getId(), input, RowAction.UPDATE));
                    outcomes.add(new RowOutcome(rowNumber, StockItemCsvService.RowResult.VALID, null,
                            "Update " + sku));
                } else {
                    if (nature == null || blank(input.name())) {
                        throw new SellableProductValidationException("nature",
                                "Creating a Sellable Product requires sellable_sku, name and nature.");
                    }
                    if (nature == SellableNature.SIMPLE
                            && (blank(input.simpleTargetInventorySku())
                                || input.simpleQuantityPerSaleUnit() == null)) {
                        throw new SellableProductValidationException("simple_target_inventory_sku",
                                "A SIMPLE Sellable Product requires simple_target_inventory_sku and "
                                        + "simple_quantity_per_sale_unit (PRD-021).");
                    }
                    if (nature == SellableNature.ASSEMBLED
                            && blank(input.assembledFinishedInventorySku())) {
                        throw new SellableProductValidationException("assembled_finished_inventory_sku",
                                "An ASSEMBLED Sellable Product requires assembled_finished_inventory_sku "
                                        + "(PRD-156).");
                    }
                    planned.add(new PlannedRow(rowNumber, null, input, RowAction.CREATE));
                    outcomes.add(new RowOutcome(rowNumber, StockItemCsvService.RowResult.VALID, null,
                            "Create " + sku + " (" + nature + ")"));
                }
            } catch (SellableProductValidationException e) {
                outcomes.add(new RowOutcome(rowNumber, StockItemCsvService.RowResult.ERROR,
                        e.field(), e.getMessage()));
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
     * <p>🔴 ATOMIC per confirmed job ({@code API-060.d}) — one transaction, so a failure on any
     * row commits nothing. Per-row outcomes are still reported ({@code API-060.c}).
     *
     * <p>🔴 IDEMPOTENT ({@code API-061.a}) — the plan is consumed on first confirmation, so
     * resubmitting creates no duplicates. Identity is the plan and the canonical row
     * identifiers, never the filename.
     *
     * <p>🔴 AN IMPORT NEVER DELETES ({@code PRD-152.d}). A record absent from the file is
     * untouched; CSV is not synchronisation-by-absence.
     */
    @Transactional
    public ImportResult confirm(UUID planId) {
        Actor actor = requireManager();

        ImportPlan plan = pendingPlans.remove(planId);
        if (plan == null) {
            throw new SellableProductValidationException("planId",
                    "This import was already confirmed, or its validation has expired. "
                            + "Re-upload the file.");
        }

        Instant now = Instant.now(clock);
        List<RowOutcome> outcomes = new ArrayList<>();
        int created = 0;
        int updated = 0;

        for (PlannedRow row : plan.rows()) {
            if (row.action() == RowAction.CREATE) {
                commands.createInternal(row.input(), actor.id(), now);
                created++;
                outcomes.add(new RowOutcome(row.rowNumber(), StockItemCsvService.RowResult.VALID,
                        null, "Created " + row.input().sellableSku()));
            } else {
                commands.updateInternal(row.id(), row.input(), null, actor.id(), now);
                updated++;
                outcomes.add(new RowOutcome(row.rowNumber(), StockItemCsvService.RowResult.VALID,
                        null, "Updated " + row.input().sellableSku()));
            }
        }
        return new ImportResult(planId, created, updated, outcomes);
    }

    private Actor requireManager() {
        Actor actor = currentActor.require();
        // 🔴 PRD-155.e — CSV consumes the module's capabilities and adds none. Import requires
        // `manage`; there is no CSV-specific permission and no path to `activate`.
        if (!actor.hasPermission(ProductPermissions.SELLABLE_PRODUCT_MANAGE)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.SELLABLE_PRODUCT_MANAGE);
        }
        return actor;
    }

    private static boolean blank(String v) {
        return v == null || v.isBlank();
    }

    private static String value(Map<String, String> row, String header) {
        String v = row.get(header);
        return v == null || v.isBlank() ? null : v.trim();
    }

    private static BigDecimal decimalValue(Map<String, String> row, String header) {
        String raw = value(row, header);
        if (raw == null) {
            return null;
        }
        try {
            // 🔴 Nothing is rounded here. DB-079 is the sole rounding owner and the value is
            // carried at the precision the file states.
            return new BigDecimal(raw);
        } catch (NumberFormatException e) {
            throw new SellableProductValidationException(header,
                    "'" + raw + "' is not a valid number.");
        }
    }

    private static UUID parseUuid(String raw) {
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            throw new SellableProductValidationException("sellable_product_id",
                    "'" + raw + "' is not a valid identifier.");
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
            throw new SellableProductValidationException(header,
                    "'" + raw + "' is not a permitted value. Allowed: "
                            + String.join(", ", java.util.Arrays.stream(type.getEnumConstants())
                            .map(Enum::name).toList()));
        }
    }

    // ------------------------------------------------------------------ types

    /** ⚠ A workflow result, NOT a business entity state ({@code UX-043.b}). */
    public record RowOutcome(int rowNumber, StockItemCsvService.RowResult result,
                             String field, String message) {
    }

    record PlannedRow(int rowNumber, UUID id,
                      SellableProductCommandService.SellableProductInput input, RowAction action) {
    }

    enum RowAction { CREATE, UPDATE }

    public record ImportPlan(UUID planId, List<RowOutcome> outcomes, List<PlannedRow> rows) {
        public long errorCount() {
            return outcomes.stream().filter(o -> o.result() == StockItemCsvService.RowResult.ERROR).count();
        }

        public long validCount() {
            return outcomes.stream().filter(o -> o.result() == StockItemCsvService.RowResult.VALID).count();
        }
    }

    public record ImportResult(UUID planId, int created, int updated, List<RowOutcome> outcomes) {
    }
}
