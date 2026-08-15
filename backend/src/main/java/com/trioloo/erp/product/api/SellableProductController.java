package com.trioloo.erp.product.api;

import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import com.trioloo.erp.product.application.SellableProductCommandService;
import com.trioloo.erp.product.application.SellableProductCsvService;
import com.trioloo.erp.product.application.SellableProductFilter;
import com.trioloo.erp.product.application.SellableProductNotFoundException;
import com.trioloo.erp.product.application.SellableProductQueryService;
import com.trioloo.erp.product.application.SellableProductSummary;
import com.trioloo.erp.product.application.SellableProductValidationException;
import com.trioloo.erp.product.application.SellableProductView;
import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SellableNature;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The Sellable Products REST surface.
 *
 * <p>🔴 {@code PRJ-031} — a controller is not a service. Every method translates HTTP and
 * delegates; no business rule, no authorisation decision and no derivation lives here.
 * Authorisation is enforced in the application services on every entry point
 * ({@code PRM-004}).
 *
 * <p>🔴 NO {@code E-103} / {@code E-104} ENDPOINT EXISTS HERE, and none may be added. This
 * surface deals only with REUSABLE catalogue definitions; an order-specific build
 * configuration is Warehouse-owned ({@code DM-081}) and belongs to a later stage.
 *
 * <p>🔴 {@code E-059} Channel Listings are owned by their own bounded REST surface. This
 * controller never fabricates listing counts on Sellable Product responses ({@code UX-037.f}).
 */
@RestController
@RequestMapping("/api/product/sellable-products")
public class SellableProductController {

    private final SellableProductQueryService queries;
    private final SellableProductCommandService commands;
    private final SellableProductCsvService csv;

    public SellableProductController(SellableProductQueryService queries,
                                     SellableProductCommandService commands,
                                     SellableProductCsvService csv) {
        this.queries = queries;
        this.commands = commands;
        this.csv = csv;
    }

    @GetMapping
    public Map<String, Object> list(SellableProductQuery query,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "50") int size,
                                    @RequestParam(defaultValue = "sellableSku") String sort,
                                    @RequestParam(defaultValue = "ASC") String direction) {
        Sort.Direction dir = "DESC".equalsIgnoreCase(direction) ? Sort.Direction.DESC : Sort.Direction.ASC;
        Page<SellableProductView> result = queries.list(query.toFilter(),
                PageRequest.of(Math.max(page, 0), clampSize(size), Sort.by(dir, safeSort(sort))));

        return Map.of(
                "content", result.getContent(),
                "page", result.getNumber(),
                "size", result.getSize(),
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages());
    }

    /** 🔴 Pagination-independent, so deliberately a separate call ({@code UX-044.b}). */
    @GetMapping("/summary")
    public SellableProductSummary summary(SellableProductQuery query) {
        return queries.summary(query.toFilter());
    }

    @GetMapping("/{id}")
    public SellableProductView detail(@PathVariable UUID id) {
        return queries.detail(id);
    }

    /** Every version, newest first. 🔴 Includes SUPERSEDED ones ({@code PRD-068}). */
    @GetMapping("/{id}/build-templates")
    public List<SellableProductQueryService.BuildTemplateView> buildTemplates(@PathVariable UUID id) {
        return queries.buildTemplates(id);
    }

    @GetMapping("/{id}/members")
    public List<SellableProductQueryService.BundleMemberView> members(@PathVariable UUID id) {
        return queries.bundleMembers(id);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody SellableProductRequest request) {
        UUID id = commands.create(request.toInput());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> update(@PathVariable UUID id,
                                       @RequestBody SellableProductRequest request) {
        commands.update(id, request.toInput(), request.version());
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ build definition

    /** 🔴 {@code PRD-069} — always a NEW version. There is no edit-the-active-one endpoint. */
    @PostMapping("/{id}/build-templates")
    public ResponseEntity<Map<String, Object>> createDraft(@PathVariable UUID id) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("id", commands.createDraftBuildTemplate(id)));
    }

    @PostMapping("/build-templates/{templateId}/lines")
    public ResponseEntity<Map<String, Object>> addLine(@PathVariable UUID templateId,
                                                       @RequestBody BomLineRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("id", commands.addBomLine(templateId, request.toInput())));
    }

    @DeleteMapping("/build-templates/{templateId}/lines/{lineId}")
    public ResponseEntity<Void> removeLine(@PathVariable UUID templateId, @PathVariable UUID lineId) {
        commands.removeBomLine(templateId, lineId);
        return ResponseEntity.noContent().build();
    }

    /**
     * 🔴 A SEPARATE ENDPOINT AND A SEPARATE CAPABILITY.
     *
     * <p>{@code product.build-template.activate}, not {@code manage} ({@code PRD-155}). Holding
     * authority to author a draft never carries authority to activate it.
     */
    @PostMapping("/build-templates/{templateId}/activate")
    public ResponseEntity<Void> activate(@PathVariable UUID templateId) {
        commands.activateBuildTemplate(templateId);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ bundle membership

    @PostMapping("/{id}/members")
    public ResponseEntity<Map<String, Object>> addMember(@PathVariable UUID id,
                                                         @RequestBody BundleMemberRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("id", commands.addBundleMember(id, request.toInput())));
    }

    @DeleteMapping("/{id}/members/{memberId}")
    public ResponseEntity<Void> removeMember(@PathVariable UUID id, @PathVariable UUID memberId) {
        commands.removeBundleMember(id, memberId);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------ CSV

    /** 🔴 The ACTIVE result set, never only the visible page ({@code UX-044.b}). */
    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<byte[]> export(SellableProductQuery query) {
        byte[] body = csv.export(query.toFilter()).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"sellable-products.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(body);
    }

    /** Headers only — 🔴 no fabricated example row ({@code UX-043.e}). */
    @GetMapping(value = "/import/template", produces = "text/csv")
    public ResponseEntity<byte[]> template() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"sellable-products-template.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csv.template().getBytes(StandardCharsets.UTF_8));
    }

    /** 🔴 Validation writes NOTHING ({@code API-060.f}). It returns a plan to confirm. */
    @PostMapping("/import/validate")
    public Map<String, Object> validate(@RequestBody Map<String, String> body) {
        SellableProductCsvService.ImportPlan plan = csv.validate(body.getOrDefault("csv", ""));
        return Map.of(
                "planId", plan.errorCount() == 0 ? plan.planId() : "",
                "validRows", plan.validCount(),
                "errorRows", plan.errorCount(),
                "outcomes", plan.outcomes());
    }

    /** 🔴 Atomic per confirmed job ({@code API-060.d}), reported per row ({@code API-060.c}). */
    @PostMapping("/import/confirm")
    public SellableProductCsvService.ImportResult confirm(@RequestBody Map<String, String> body) {
        String planId = body.get("planId");
        if (planId == null || planId.isBlank()) {
            throw new SellableProductValidationException("planId", "Validate the file before confirming.");
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

    @ExceptionHandler(SellableProductValidationException.class)
    public ResponseEntity<Map<String, Object>> invalid(SellableProductValidationException e) {
        return ResponseEntity.badRequest()
                .body(Map.of("error", "VALIDATION_FAILED",
                        "field", e.field() == null ? "" : e.field(),
                        "message", e.getMessage()));
    }

    @ExceptionHandler(SellableProductNotFoundException.class)
    public ResponseEntity<Map<String, Object>> missing(SellableProductNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "NOT_FOUND", "message", e.getMessage()));
    }

    private static int clampSize(int size) {
        return Math.min(Math.max(size, 1), 200);
    }

    private static String safeSort(String field) {
        return List.of("sellableSku", "name", "nature", "sellableCategory", "recordStatus", "updatedAt")
                .contains(field) ? field : "sellableSku";
    }

    // ------------------------------------------------------------------ requests

    /** One shape for list, summary and export, so their scopes cannot disagree. */
    public record SellableProductQuery(String search, SellableNature nature, RecordStatus status,
                                       String sellableCategory) {

        SellableProductFilter toFilter() {
            return new SellableProductFilter(search, nature, status, sellableCategory);
        }
    }

    /**
     * 🔴 Deliberately carries no price, cost, margin, stock, availability or listing field. A
     * client cannot ask this API to write any of them, because the request has nowhere to put
     * them.
     */
    public record SellableProductRequest(String sellableSku, String name, SellableNature nature,
                                         String description, String sellableCategory,
                                         String warrantyPackage, RecordStatus recordStatus,
                                         String simpleTargetInventorySku,
                                         BigDecimal simpleQuantityPerSaleUnit,
                                         String assembledFinishedInventorySku,
                                         Long version) {

        SellableProductCommandService.SellableProductInput toInput() {
            return new SellableProductCommandService.SellableProductInput(sellableSku, name, nature,
                    description, sellableCategory, warrantyPackage, recordStatus,
                    simpleTargetInventorySku, simpleQuantityPerSaleUnit, assembledFinishedInventorySku);
        }
    }

    /** 🔴 Identified by INVENTORY SKU — a BOM line references a physical component. */
    public record BomLineRequest(String inventorySku, BigDecimal quantityRequired,
                                 String componentRole, Boolean optional, String substitutionGroup) {

        SellableProductCommandService.BomLineInput toInput() {
            return new SellableProductCommandService.BomLineInput(inventorySku, quantityRequired,
                    componentRole, Boolean.TRUE.equals(optional), substitutionGroup);
        }
    }

    /** 🔴 Identified by SELLABLE SKU — a bundle member is a Sellable Product. */
    public record BundleMemberRequest(String memberSellableSku, BigDecimal quantity,
                                      Boolean optional, String priceAllocationBasis) {

        SellableProductCommandService.BundleMemberInput toInput() {
            return new SellableProductCommandService.BundleMemberInput(memberSellableSku, quantity,
                    Boolean.TRUE.equals(optional), priceAllocationBasis);
        }
    }
}
