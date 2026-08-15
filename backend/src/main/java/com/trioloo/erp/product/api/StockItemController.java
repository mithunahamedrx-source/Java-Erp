package com.trioloo.erp.product.api;

import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import com.trioloo.erp.product.application.StockItemCommandService;
import com.trioloo.erp.product.application.StockItemCsvService;
import com.trioloo.erp.product.application.StockItemFilter;
import com.trioloo.erp.product.application.StockItemNotFoundException;
import com.trioloo.erp.product.application.StockItemQueryService;
import com.trioloo.erp.product.application.StockItemSummary;
import com.trioloo.erp.product.application.StockItemValidationException;
import com.trioloo.erp.product.application.StockItemView;
import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SerializationPolicy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The Stock Items REST surface.
 *
 * <p>🔴 {@code PRJ-031} — a controller is not a service. Every method here translates HTTP and
 * delegates; no business rule, no authorisation decision and no derivation lives in this class.
 * Authorisation is enforced in the application services, on every entry point
 * ({@code PRM-004}), so an alternative entry point cannot bypass it.
 *
 * <p>🔴 {@code TEC-015} — every monetary field crosses as a JSON STRING via
 * {@code @MonetaryAmount} on the view records. Nothing here re-serialises a decimal.
 */
@RestController
@RequestMapping("/api/product/stock-items")
public class StockItemController {

    private final StockItemQueryService queries;
    private final StockItemCommandService commands;
    private final StockItemCsvService csv;

    public StockItemController(StockItemQueryService queries, StockItemCommandService commands,
                               StockItemCsvService csv) {
        this.queries = queries;
        this.commands = commands;
        this.csv = csv;
    }

    /** Server-side pagination and sorting. The client never receives an unbounded list. */
    @GetMapping
    public Map<String, Object> list(StockItemQuery query,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "50") int size,
                                    @RequestParam(defaultValue = "inventorySku") String sort,
                                    @RequestParam(defaultValue = "ASC") String direction) {
        Sort.Direction dir = "DESC".equalsIgnoreCase(direction) ? Sort.Direction.DESC : Sort.Direction.ASC;
        Page<StockItemView> result = queries.list(query.toFilter(),
                PageRequest.of(Math.max(page, 0), clampSize(size), Sort.by(dir, safeSort(sort))));

        return Map.of(
                "content", result.getContent(),
                "page", result.getNumber(),
                "size", result.getSize(),
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages());
    }

    /**
     * The five summary values over the ACTIVE filters.
     *
     * <p>🔴 Deliberately a separate call from the page: it is pagination-independent
     * ({@code UX-044.b}), so binding it to a page response would misstate its scope.
     */
    @GetMapping("/summary")
    public StockItemSummary summary(StockItemQuery query) {
        return queries.summary(query.toFilter());
    }

    @GetMapping("/{id}")
    public StockItemView detail(@PathVariable UUID id) {
        return queries.detail(id);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody StockItemRequest request) {
        UUID id = commands.create(request.toInput());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> update(@PathVariable UUID id, @RequestBody StockItemRequest request) {
        commands.update(id, request.toInput(), request.version());
        return ResponseEntity.noContent().build();
    }

    /**
     * CSV export of the ACTIVE result set.
     *
     * <p>🔴 Never only the visible page ({@code UX-044.b}), and the restricted cost column is
     * omitted entirely for an unauthorised actor ({@code PRD-153.a}).
     */
    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<byte[]> export(StockItemQuery query) {
        byte[] body = csv.export(query.toFilter()).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"stock-items.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(body);
    }

    /** Headers only — 🔴 no fabricated example row ({@code UX-043.e}). */
    @GetMapping(value = "/import/template", produces = "text/csv")
    public ResponseEntity<byte[]> template() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"stock-items-template.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csv.template().getBytes(StandardCharsets.UTF_8));
    }

    /** 🔴 Validation writes NOTHING ({@code API-060.f}). It returns a plan to confirm. */
    @PostMapping("/import/validate")
    public Map<String, Object> validate(@RequestBody Map<String, String> body) {
        StockItemCsvService.ImportPlan plan = csv.validate(body.getOrDefault("csv", ""));
        return Map.of(
                "planId", plan.errorCount() == 0 ? plan.planId() : "",
                "validRows", plan.validCount(),
                "errorRows", plan.errorCount(),
                "outcomes", plan.outcomes());
    }

    /** 🔴 Atomic per confirmed job ({@code API-060.d}), reported per row ({@code API-060.c}). */
    @PostMapping("/import/confirm")
    public StockItemCsvService.ImportResult confirm(@RequestBody Map<String, String> body) {
        String planId = body.get("planId");
        if (planId == null || planId.isBlank()) {
            throw new StockItemValidationException("planId", "Validate the file before confirming.");
        }
        return csv.confirm(UUID.fromString(planId));
    }

    // ------------------------------------------------------------------ errors

    /** {@code PRM-003} — a denial is 403 and names the capability, never the subject. */
    @ExceptionHandler(AccessDeniedByPermissionException.class)
    public ResponseEntity<Map<String, Object>> denied(AccessDeniedByPermissionException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "FORBIDDEN", "requiredPermission", e.requiredPermission(),
                        "message", e.getMessage()));
    }

    @ExceptionHandler(StockItemValidationException.class)
    public ResponseEntity<Map<String, Object>> invalid(StockItemValidationException e) {
        return ResponseEntity.badRequest()
                .body(Map.of("error", "VALIDATION_FAILED",
                        "field", e.field() == null ? "" : e.field(),
                        "message", e.getMessage()));
    }

    @ExceptionHandler(StockItemNotFoundException.class)
    public ResponseEntity<Map<String, Object>> missing(StockItemNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "NOT_FOUND", "message", e.getMessage()));
    }

    private static int clampSize(int size) {
        // Page-size options are §3.16's ratified set. A hostile or accidental huge page is
        // clamped; 🔴 the clamp is an engineering bound and never changes what a query means.
        return Math.min(Math.max(size, 1), 200);
    }

    private static String safeSort(String field) {
        return List.of("inventorySku", "technicalName", "brand", "inventoryCategory",
                "recordStatus", "updatedAt").contains(field) ? field : "inventorySku";
    }

    // ------------------------------------------------------------------ requests

    /** Query parameters for list, summary and export — one shape, so their scopes agree. */
    public record StockItemQuery(String search, RecordStatus status, String category, String brand,
                                 SerializationPolicy serializationPolicy, String componentClass,
                                 Boolean outOfStockOnly) {

        StockItemFilter toFilter() {
            return new StockItemFilter(search, status, category, brand, serializationPolicy,
                    componentClass, Boolean.TRUE.equals(outOfStockOnly));
        }
    }

    /**
     * 🔴 Deliberately carries no quantity, valuation, cost, price or supplier field. A client
     * cannot ask this API to write stock, because the request has nowhere to put it.
     */
    public record StockItemRequest(String inventorySku, String technicalName, String brand,
                                   String inventoryCategory, String unitOfMeasure, String barcode,
                                   SerializationPolicy serializationPolicy, String componentClass,
                                   RecordStatus recordStatus, Long version) {

        StockItemCommandService.StockItemInput toInput() {
            return new StockItemCommandService.StockItemInput(inventorySku, technicalName, brand,
                    inventoryCategory, unitOfMeasure, barcode, serializationPolicy, componentClass,
                    recordStatus);
        }
    }
}
