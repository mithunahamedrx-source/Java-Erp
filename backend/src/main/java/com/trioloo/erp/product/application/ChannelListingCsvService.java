package com.trioloo.erp.product.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.product.domain.ListingStatus;
import com.trioloo.erp.product.domain.SyncState;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ChannelListingCsvService {

    /**
     * The exported columns.
     *
     * <p>⚠ Channel-owned and REPORTED facts are exported so an operator can read them, and
     * refused on import — see {@link #READ_ONLY_HEADERS}.
     */
    public static final List<String> HEADERS = List.of(
            "listing_id",
            "channel_instance",
            "external_listing_id",
            "channel_sku",
            "mapped_sellable_sku",
            "intended_title",
            "intended_description",
            "sale_price",
            "promotion_price",
            "promotion_starts_at",
            "promotion_ends_at",
            "published_marketplace_stock",
            "publication_intent",
            "intended_channel_category",
            "channel_reported_title",
            "listing_status",
            "sync_state",
            "local_lifecycle",
            "last_sync_at");

    /**
     * 🔴 {@code PRD-181.a} / {@code API-062.c} — REPORTED and channel-owned facts are written
     * ONLY by inbound readback. A spreadsheet can never author them, so supplying one is a
     * refusal rather than a silently ignored column.
     */
    public static final Set<String> READ_ONLY_HEADERS = Set.of(
            "channel_reported_title", "listing_status", "sync_state", "local_lifecycle",
            "last_sync_at");

    /**
     * 🔴 {@code PRD-195.b} / {@code PRD-195.c} — the ONLY required column. A Listing may be
     * created before the channel has issued an identifier ({@code PRD-188.b}) and while it is
     * still {@code UNMAPPED} ({@code PRD-178}); demanding either would force the operator to
     * invent data the ERP does not own.
     */
    private static final List<String> REQUIRED_HEADERS = List.of("channel_instance");

    /**
     * 🔴 {@code PRD-199.k} — the ONE backwards-compatible import alias.
     *
     * <p>The superseded {@code channel_price} column meant "what Trioloo publishes"
     * ({@code PRD-138}) — the price the listing is offered at. It therefore maps to
     * {@code sale_price} and to nothing else. ⚠ It NEVER maps to a promotion: a file that
     * predates this model schedules no promotion, and inventing one would manufacture an
     * offer nobody entered ({@code PRD-199.k}).
     *
     * <p>🔴 Supplying BOTH the alias and {@code sale_price} in one file is a refusal, not a
     * precedence puzzle.
     */
    private static final String LEGACY_PRICE_ALIAS = "channel_price";

    private final ChannelListingQueryService queries;
    private final ChannelListingCommandService commands;
    private final ChannelListingRepository listings;
    private final ChannelInstanceRepository channels;
    private final CurrentActor currentActor;
    private final Map<UUID, ImportPlan> pendingPlans = new HashMap<>();

    public ChannelListingCsvService(ChannelListingQueryService queries,
                                    ChannelListingCommandService commands,
                                    ChannelListingRepository listings,
                                    ChannelInstanceRepository channels,
                                    CurrentActor currentActor) {
        this.queries = queries;
        this.commands = commands;
        this.listings = listings;
        this.channels = channels;
        this.currentActor = currentActor;
    }

    public String template() {
        return String.join(",", HEADERS) + "\r\n";
    }

    @Transactional(readOnly = true)
    public String export(ChannelListingFilter filter) {
        // TEC-096 / PRD-174.b — the export scope is resolved SERVER-SIDE from the same filter
        // the workspace is showing. The browser never re-selects the corpus.
        List<ChannelListingView> rows = queries.list(filter, Pageable.unpaged()).getContent();
        StringBuilder csv = new StringBuilder();
        csv.append(String.join(",", HEADERS)).append("\r\n");
        for (ChannelListingView row : rows) {
            // A multi-SKU listing has no single channel_sku or mapped SKU; PRD-190 makes the
            // orderable unit the mapping unit, so those cells are left empty rather than
            // reporting one variation's value as the listing's.
            boolean single = row.skuCount() == 1;
            List<String> cells = new ArrayList<>();
            cells.add(StockItemCsvService.text(row.id().toString()));
            cells.add(StockItemCsvService.text(row.channelInstance()));
            cells.add(StockItemCsvService.text(row.externalListingId()));
            cells.add(StockItemCsvService.text(single && !row.skus().isEmpty()
                    ? row.skus().getFirst().channelSku() : null));
            cells.add(StockItemCsvService.text(single ? row.mappedSellableSku() : null));
            cells.add(StockItemCsvService.text(row.intendedTitle()));
            cells.add(StockItemCsvService.text(row.intendedDescription()));
            cells.add(StockItemCsvService.text(row.salePrice()));
            cells.add(StockItemCsvService.text(row.promotionPrice()));
            // ⚠ ISO-8601 instants. The EFFECTIVE price is deliberately NOT exported: it is
            // derived from the clock (PRD-199.d), so a cell holding it would be stale the
            // moment the file was written.
            cells.add(StockItemCsvService.text(
                    row.promotionStartsAt() == null ? null : row.promotionStartsAt().toString()));
            cells.add(StockItemCsvService.text(
                    row.promotionEndsAt() == null ? null : row.promotionEndsAt().toString()));
            cells.add(StockItemCsvService.text(row.listingStock()));
            cells.add(StockItemCsvService.text(row.publicationIntent()));
            cells.add(StockItemCsvService.text(row.intendedChannelCategory()));
            // SYS-034 — a value the adapter could not read is exported as empty, and the
            // column is refused on import, so an operator can never turn "unreadable" into
            // an authored blank.
            cells.add(StockItemCsvService.text(
                    row.reportedTitleReadable() ? row.channelReportedTitle() : null));
            cells.add(StockItemCsvService.text(row.listingStatus() == null ? null : row.listingStatus().name()));
            cells.add(StockItemCsvService.text(row.syncState().name()));
            cells.add(StockItemCsvService.text(row.localLifecycle().name()));
            cells.add(StockItemCsvService.text(row.lastSyncAt() == null ? null : row.lastSyncAt().toString()));
            csv.append(String.join(",", cells)).append("\r\n");
        }
        return csv.toString();
    }

    /**
     * One ISO-8601 instant from a cell, or {@code null} when the cell is absent or blank.
     *
     * <p>⚠ A cell that is present but unparseable is a REFUSAL against its line number. It is
     * never coerced to "now" or to null, either of which would silently schedule a promotion
     * for a window the operator did not write.
     */
    private static Instant instant(Map<String, String> row, String column) {
        String raw = value(row, column);
        if (raw == null) {
            return null;
        }
        try {
            return Instant.parse(raw);
        } catch (DateTimeParseException cause) {
            throw new ChannelListingValidationException(column,
                    "'" + column + "' must be an ISO-8601 instant such as "
                            + "2026-08-20T00:00:00Z. Got '" + raw + "'.");
        }
    }

    @Transactional(readOnly = true)
    public ImportPlan validate(String csv) {
        requireManager();
        List<List<String>> parsed = StockItemCsvService.CsvReader.parse(csv);
        if (parsed.isEmpty()) {
            throw new ChannelListingValidationException("file", "The file is empty.");
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
            throw new ChannelListingValidationException("header", "Duplicate column(s): " + duplicates);
        }
        for (String required : REQUIRED_HEADERS) {
            if (!headers.contains(required)) {
                throw new ChannelListingValidationException("header", "Missing required column: " + required);
            }
        }

        List<RowOutcome> outcomes = new ArrayList<>();
        List<PlannedRow> planned = new ArrayList<>();
        Set<String> identityInFile = new HashSet<>();

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
                for (String readOnly : READ_ONLY_HEADERS) {
                    String supplied = value(row, readOnly);
                    if (supplied != null) {
                        throw new ChannelListingValidationException(readOnly,
                                "'" + readOnly + "' is READ-ONLY and cannot be imported.");
                    }
                }
                ChannelInstanceEntity channel = resolveChannel(value(row, "channel_instance"));
                // PRD-188.b — a Listing may legitimately have no channel identifier yet.
                String external = value(row, "external_listing_id");
                if (external != null) {
                    String identityKey = channel.getCode().toLowerCase(Locale.ROOT) + "\n"
                            + external.toLowerCase(Locale.ROOT);
                    if (!identityInFile.add(identityKey)) {
                        throw new ChannelListingValidationException("external_listing_id",
                                "Duplicate channel_instance + external_listing_id appears in this file.");
                    }
                }

                ChannelListingEntity existing = null;
                String idCell = value(row, "listing_id");
                if (idCell != null) {
                    UUID id = parseUuid(idCell);
                    existing = listings.findById(id)
                            .orElseThrow(() -> new ChannelListingValidationException("listing_id",
                                    "No Channel Listing with id " + idCell + "."));
                    if (!existing.getChannelInstanceId().equals(channel.getId())) {
                        throw new ChannelListingValidationException("listing_id",
                                "Ambiguous identity: listing_id and channel_instance identify "
                                        + "different records.");
                    }
                    if (external != null && existing.getExternalListingId() != null
                            && !existing.getExternalListingId().equalsIgnoreCase(external)) {
                        throw new ChannelListingValidationException("listing_id",
                                "Ambiguous identity: listing_id and external_listing_id identify "
                                        + "different records.");
                    }
                } else if (external != null) {
                    existing = listings.findByChannelInstanceIdAndExternalListingIdIgnoreCase(
                            channel.getId(), external).orElse(null);
                }
                // ⚠ With neither a listing_id nor an external_listing_id there is nothing to
                // match on, so the row can only ever be a CREATE. That is deliberate: guessing
                // an identity from title or SKU would be exactly the fuzzy matching PRD-179.b
                // forbids.

                String label = channel.getCode() + " / "
                        + (external == null ? "(no channel identifier yet)" : external);
                // 🔴 PRD-197.f — the legacy alias resolves to Sale Price, and only when the
                // file does not also carry the current column.
                String legacyPrice = value(row, LEGACY_PRICE_ALIAS);
                String salePriceCell = value(row, "sale_price");
                if (legacyPrice != null && salePriceCell != null) {
                    throw new ChannelListingValidationException(LEGACY_PRICE_ALIAS,
                            "This file supplies both '" + LEGACY_PRICE_ALIAS + "' and "
                                    + "'sale_price'. '" + LEGACY_PRICE_ALIAS + "' is the "
                                    + "superseded name for 'sale_price' — supply one of them.");
                }
                BigDecimal salePrice = salePriceCell != null
                        ? decimal(row, "sale_price") : decimal(row, LEGACY_PRICE_ALIAS);
                BigDecimal promotionPrice = decimal(row, "promotion_price");
                Instant promotionStartsAt = instant(row, "promotion_starts_at");
                Instant promotionEndsAt = instant(row, "promotion_ends_at");
                /*
                  🔴 PRD-199.c / PRD-199.e — refused at VALIDATION time, so a bad row is
                  reported against its line number rather than failing halfway through a
                  confirmed import (API-060: the local import commits atomically).
                */
                if (promotionPrice != null && salePrice != null
                        && promotionPrice.compareTo(salePrice) > 0) {
                    throw new ChannelListingValidationException("promotion_price",
                            "Promotion Price (" + promotionPrice.toPlainString() + ") cannot be "
                                    + "above the Sale Price (" + salePrice.toPlainString() + ").");
                }
                if (promotionPrice != null
                        && (promotionStartsAt == null || promotionEndsAt == null)) {
                    throw new ChannelListingValidationException("promotion_window",
                            "A Promotion Price needs both 'promotion_starts_at' and "
                                    + "'promotion_ends_at'.");
                }
                if (promotionStartsAt != null && promotionEndsAt != null
                        && !promotionEndsAt.isAfter(promotionStartsAt)) {
                    throw new ChannelListingValidationException("promotion_ends_at",
                            "'promotion_ends_at' must be later than 'promotion_starts_at'.");
                }

                ChannelListingCommandService.ChannelListingInput input =
                        new ChannelListingCommandService.ChannelListingInput(channel.getCode(), external,
                                value(row, "channel_sku"), value(row, "mapped_sellable_sku"),
                                value(row, "intended_title"), value(row, "intended_description"),
                                salePrice, promotionPrice, promotionStartsAt, promotionEndsAt,
                                decimal(row, "published_marketplace_stock"),
                                value(row, "publication_intent"),
                                value(row, "intended_channel_category"), null,
                                // PRD-195.e / PRD-202 / PRD-201 - structured content, the
                                // Bangla overrides and the package facts are NOT in the
                                // ratified CSV scope. null means "said nothing", so an import
                                // never silently deletes what an operator authored.
                                // highlights, titleBn, descriptionBn, highlightsBn,
                                // packageWeight/Length/Width/Height, packageContent
                                // ⚠ A spreadsheet accepts no AI candidate, so provenance is
                                // never AI-assisted on an import.
                                null, null, null, null, null, null, null, null, null, null);
                if (existing == null) {
                    planned.add(new PlannedRow(rowNumber, null, input, RowAction.CREATE));
                    outcomes.add(new RowOutcome(rowNumber, StockItemCsvService.RowResult.VALID,
                            null, "Create " + label));
                } else {
                    planned.add(new PlannedRow(rowNumber, existing.getId(), input, RowAction.UPDATE));
                    outcomes.add(new RowOutcome(rowNumber, StockItemCsvService.RowResult.VALID,
                            null, "Update " + label));
                }
            } catch (ChannelListingValidationException e) {
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

    @Transactional
    public ImportResult confirm(UUID planId) {
        requireManager();
        ImportPlan plan = pendingPlans.remove(planId);
        if (plan == null) {
            throw new ChannelListingValidationException("planId",
                    "This import was already confirmed, or its validation has expired. Re-upload the file.");
        }
        int created = 0;
        int updated = 0;
        List<RowOutcome> outcomes = new ArrayList<>();
        for (PlannedRow row : plan.rows()) {
            if (row.action() == RowAction.CREATE) {
                commands.create(row.input());
                created++;
                outcomes.add(new RowOutcome(row.rowNumber(), StockItemCsvService.RowResult.VALID,
                        null, "Created"));
            } else {
                commands.update(row.id(), row.input(), null);
                updated++;
                outcomes.add(new RowOutcome(row.rowNumber(), StockItemCsvService.RowResult.VALID,
                        null, "Updated"));
            }
        }
        return new ImportResult(planId, created, updated, outcomes);
    }

    private Actor requireManager() {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(ProductPermissions.CHANNEL_LISTING_MANAGE)) {
            throw new AccessDeniedByPermissionException(ProductPermissions.CHANNEL_LISTING_MANAGE);
        }
        return actor;
    }

    private ChannelInstanceEntity resolveChannel(String code) {
        if (code == null || code.isBlank()) {
            throw new ChannelListingValidationException("channel_instance", "Channel instance is required.");
        }
        return channels.findByCodeIgnoreCase(code.trim())
                .orElseThrow(() -> new ChannelListingValidationException("channel_instance",
                        "No registered Channel Instance '" + code.trim() + "'."));
    }

    private static String value(Map<String, String> row, String header) {
        String v = row.get(header);
        return v == null || v.isBlank() ? null : v.trim();
    }

    private static BigDecimal decimal(Map<String, String> row, String header) {
        String raw = value(row, header);
        if (raw == null) {
            return null;
        }
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException e) {
            throw new ChannelListingValidationException(header, "'" + raw + "' is not a valid number.");
        }
    }

    private static UUID parseUuid(String raw) {
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException e) {
            throw new ChannelListingValidationException("listing_id",
                    "'" + raw + "' is not a valid identifier.");
        }
    }

    public record RowOutcome(int rowNumber, StockItemCsvService.RowResult result,
                             String field, String message) {
    }

    record PlannedRow(int rowNumber, UUID id,
                      ChannelListingCommandService.ChannelListingInput input, RowAction action) {
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
