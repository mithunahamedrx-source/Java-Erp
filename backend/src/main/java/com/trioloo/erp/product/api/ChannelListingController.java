package com.trioloo.erp.product.api;

import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import com.trioloo.erp.product.application.ChannelListingCommandService;
import com.trioloo.erp.product.application.ChannelListingCsvService;
import com.trioloo.erp.product.application.ai.ListingAiAuthoringService;
import com.trioloo.erp.product.application.ai.ListingAiAuthoringPort;
import com.trioloo.erp.product.application.ChannelListingFilter;
import com.trioloo.erp.product.application.ChannelListingNotFoundException;
import com.trioloo.erp.product.application.ChannelListingQueryService;
import com.trioloo.erp.product.application.ChannelListingSummary;
import com.trioloo.erp.product.application.ChannelListingValidationException;
import com.trioloo.erp.product.application.ChannelListingView;
import com.trioloo.erp.product.application.ChannelListingMediaService;
import com.trioloo.erp.product.application.ListingViews;
import com.trioloo.erp.product.application.PushReviewService;
import com.trioloo.erp.product.application.PushReviewView;
import com.trioloo.erp.product.domain.ListingStatus;
import com.trioloo.erp.product.domain.LocalLifecycle;
import com.trioloo.erp.product.domain.SyncState;
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
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/product/channel-listings")
public class ChannelListingController {

    private final ChannelListingQueryService queries;
    private final ChannelListingCommandService commands;
    private final ChannelListingMediaService media;
    private final ChannelListingCsvService csv;
    private final ListingAiAuthoringService ai;
    private final PushReviewService pushReview;

    public ChannelListingController(ChannelListingQueryService queries,
                                    ChannelListingCommandService commands,
                                    ChannelListingMediaService media,
                                    ChannelListingCsvService csv,
                                    ListingAiAuthoringService ai,
                                    PushReviewService pushReview) {
        this.queries = queries;
        this.commands = commands;
        this.media = media;
        this.csv = csv;
        this.ai = ai;
        this.pushReview = pushReview;
    }

    /**
     * What would be sent for ONE listing, and whether it can be sent, {@code PRD-185}.
     *
     * <p>🔴 A READ. Composing a review contacts no marketplace, records no operation, writes
     * no activity and changes no state — including the derived unsent condition.
     *
     * <p>🔴 {@code PRD-196.a} — requires {@code publish}. Reading a listing requires
     * {@code view}; holding view or manage ALONE therefore cannot reach this at all.
     */
    @GetMapping("/{id}/push-review")
    public PushReviewView pushReview(@PathVariable UUID id) {
        return pushReview.review(id);
    }

    /**
     * Dispatches the reviewed outbound act, {@code PRD-186}.
     *
     * <p>🔴 {@code reviewVersion} is the version the operator actually read. A listing that
     * moved on since is refused BEFORE dispatch rather than sent from a stale review.
     *
     * <p>⚠ With no adapter configured this refuses at preflight and nothing is recorded.
     */
    @PostMapping("/{id}/push-review/confirm")
    public ConfirmedOperation confirmPushReview(@PathVariable UUID id,
                                                @RequestBody ConfirmPushRequest request) {
        return new ConfirmedOperation(pushReview.confirm(id, request.reviewVersion()));
    }

    /** 🔴 The reviewed version travels with the confirmation; it is never optional in the UI. */
    public record ConfirmPushRequest(Long reviewVersion) {
    }

    public record ConfirmedOperation(UUID batchId) {
    }

    /**
     * Whether an AI assistant is configured, {@code PRD-200.r}.
     *
     * <p>⚠ An honest boolean. The UI opens AI Assist either way and says which state it is in;
     * it never fabricates a candidate locally to hide an absent provider.
     */
    @GetMapping("/ai/status")
    public Map<String, Object> aiStatus() {
        return Map.of("configured", ai.isConfigured());
    }

    /**
     * Produces AI CANDIDATES for one authoring request, {@code PRD-200.a}.
     *
     * <p>🔴 THIS ENDPOINT WRITES NOTHING. It returns text. Acceptance is a later, separate
     * act by the operator, and even that only edits the form — saving is separate again
     * ({@code PRD-200.k}), and pushing is separate after that.
     */
    @PostMapping("/ai/generate")
    public Map<String, Object> aiGenerate(@RequestBody AiGenerateRequest request) {
        var candidates = ai.generate(request.kind(), request.language(), request.instruction(),
                request.facts(), request.adapterConstraints());
        return Map.of("candidates", candidates.candidates());
    }

    @GetMapping
    public Map<String, Object> list(ChannelListingQuery query,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "50") int size,
                                    @RequestParam(defaultValue = "channelInstance") String sort,
                                    @RequestParam(defaultValue = "ASC") String direction) {
        Sort.Direction dir = "DESC".equalsIgnoreCase(direction) ? Sort.Direction.DESC : Sort.Direction.ASC;
        Page<ChannelListingView> result = queries.list(query.toFilter(),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200),
                        Sort.by(dir, safeSort(sort))));
        return Map.of("content", result.getContent(), "page", result.getNumber(),
                "size", result.getSize(), "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages());
    }

    @GetMapping("/summary")
    public ChannelListingSummary summary(ChannelListingQuery query) {
        return queries.summary(query.toFilter());
    }

    @GetMapping("/{id}")
    public ChannelListingView detail(@PathVariable UUID id) {
        return queries.detail(id);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody ChannelListingRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", commands.create(request.toInput())));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> update(@PathVariable UUID id, @RequestBody ChannelListingRequest request) {
        commands.update(id, request.toInput(), request.version());
        return ResponseEntity.noContent().build();
    }

    /** {@code PRD-028} — the channels a Listing may belong to, with adapter availability. */
    @GetMapping("/channels")
    public List<ListingViews.ChannelView> channels() {
        return queries.channels();
    }

    /**
     * The server-side selection scope for a filter, {@code UX-044}.
     *
     * <p>🔴 "Select all matching" resolves HERE. The browser never enumerates a 3000+ corpus
     * to build a batch ({@code PRD-174.b}).
     */
    @GetMapping("/selection-scope")
    public ChannelListingQueryService.SelectionScope selectionScope(ChannelListingQuery query) {
        return queries.selectionScope(query.toFilter());
    }

    /** {@code PRD-183} — intended vs reported, fact by fact. */
    @GetMapping("/{id}/comparison")
    public List<ListingViews.ComparisonRow> comparison(@PathVariable UUID id) {
        return queries.comparison(id);
    }

    @GetMapping("/{id}/media")
    public ListingViews.MediaSetView media(@PathVariable UUID id) {
        return media.mediaSet(id);
    }

    /**
     * Replaces the listing's intended media override, {@code PRD-170}.
     *
     * <p>🔴 ALL-OR-NOTHING. An empty list clears the override and the Sellable Product master
     * set becomes effective again; the fallback is never materialised as a copy.
     */
    @PutMapping("/{id}/media")
    public ResponseEntity<Void> replaceMedia(@PathVariable UUID id,
                                             @RequestBody IntendedMediaRequest request) {
        media.replaceIntendedMedia(id, request.items() == null ? List.of()
                : request.items().stream()
                        .map(i -> new ChannelListingMediaService.IntendedMediaInput(
                                i.mediaAssetId(), i.primary()))
                        .toList());
        return ResponseEntity.noContent().build();
    }

    /** {@code PRD-183} — adopts the channel-reported media set as the ERP intent. */
    @PostMapping("/{id}/media/accept-marketplace")
    public ResponseEntity<Void> acceptMedia(@PathVariable UUID id) {
        media.acceptReportedMedia(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Adopts the channel-reported value of ONE field, {@code PRD-183}.
     *
     * <p>🔴 Explicit and per-field. Divergence is never auto-resolved ({@code PRD-183.c}).
     */
    @PostMapping("/{id}/accept-marketplace")
    public ResponseEntity<Void> acceptMarketplace(@PathVariable UUID id,
                                                  @RequestBody AcceptRequest request) {
        commands.acceptMarketplaceValue(id, request.field());
        return ResponseEntity.noContent().build();
    }

    /**
     * Advisory mapping suggestions for one orderable SKU, {@code PRD-179}.
     *
     * <p>🔴 A READ. It suggests and never maps ({@code PRD-179.b}); the mapping is made by the
     * PUT below, after an explicit operator confirmation.
     */
    @GetMapping("/skus/{skuId}/mapping-suggestions")
    public List<ListingViews.MappingSuggestionView> mappingSuggestions(@PathVariable UUID skuId) {
        return queries.mappingSuggestions(skuId);
    }

    /** {@code INV-106.2} — maps ONE orderable SKU to ONE Sellable Product, explicitly. */
    @PutMapping("/skus/{skuId}/mapping")
    public ResponseEntity<Void> mapSku(@PathVariable UUID skuId,
                                       @RequestBody MapSkuRequest request) {
        commands.mapSku(skuId, request.mappedSellableSku(), request.version());
        return ResponseEntity.noContent().build();
    }

    /** ⚠ Clears an ERP-side mapping only. Nothing is deleted on the marketplace. */
    @DeleteMapping("/skus/{skuId}/mapping")
    public ResponseEntity<Void> unmapSku(@PathVariable UUID skuId,
                                         @RequestParam(required = false) Long version) {
        commands.unmapSku(skuId, version);
        return ResponseEntity.noContent().build();
    }

    /** {@code INV-106.3} / {@code INV-106.4} — per-SKU intended commercial values. */
    @PutMapping("/skus/{skuId}")
    public ResponseEntity<Void> updateSku(@PathVariable UUID skuId,
                                          @RequestBody SkuValuesRequest request) {
        commands.updateSku(skuId, request.salePrice(), request.promotionPrice(),
                request.promotionStartsAt(), request.promotionEndsAt(),
                request.publishedMarketplaceStock(), request.version());
        return ResponseEntity.noContent().build();
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<byte[]> export(ChannelListingQuery query) {
        byte[] body = csv.export(query.toFilter()).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"channel-listings.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(body);
    }

    @GetMapping(value = "/import/template", produces = "text/csv")
    public ResponseEntity<byte[]> template() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"channel-listings-template.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csv.template().getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping("/import/validate")
    public Map<String, Object> validate(@RequestBody Map<String, String> body) {
        ChannelListingCsvService.ImportPlan plan = csv.validate(body.getOrDefault("csv", ""));
        return Map.of("planId", plan.errorCount() == 0 ? plan.planId() : "",
                "validRows", plan.validCount(), "errorRows", plan.errorCount(),
                "outcomes", plan.outcomes());
    }

    @PostMapping("/import/confirm")
    public ChannelListingCsvService.ImportResult confirm(@RequestBody Map<String, String> body) {
        String planId = body.get("planId");
        if (planId == null || planId.isBlank()) {
            throw new ChannelListingValidationException("planId", "Validate the file before confirming.");
        }
        return csv.confirm(UUID.fromString(planId));
    }

    @ExceptionHandler(AccessDeniedByPermissionException.class)
    public ResponseEntity<Map<String, Object>> denied(AccessDeniedByPermissionException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "FORBIDDEN", "requiredPermission", e.requiredPermission(),
                        "message", e.getMessage()));
    }

    @ExceptionHandler(ChannelListingValidationException.class)
    public ResponseEntity<Map<String, Object>> invalid(ChannelListingValidationException e) {
        return ResponseEntity.badRequest()
                .body(Map.of("error", "VALIDATION_FAILED", "field",
                        e.field() == null ? "" : e.field(), "message", e.getMessage()));
    }

    @ExceptionHandler(ChannelListingNotFoundException.class)
    public ResponseEntity<Map<String, Object>> missing(ChannelListingNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "NOT_FOUND", "message", e.getMessage()));
    }

    private static String safeSort(String field) {
        return List.of("externalListingId", "intendedTitle", "listingStatus", "syncState", "updatedAt")
                .contains(field) ? field : "externalListingId";
    }

    /**
     * The workspace query string.
     *
     * <p>🔴 {@code TEC-096} — every dimension is bound here and applied by the DATABASE. The
     * browser filters nothing ({@code PRD-174.b}).
     */
    public record ChannelListingQuery(String search,
                                      String channelInstance,
                                      ListingStatus listingStatus,
                                      SyncState syncState,
                                      LocalLifecycle lifecycle,
                                      String publicationIntent,
                                      UUID sellableProductId,
                                      Boolean mapped,
                                      Boolean divergedOnly,
                                      Boolean unsentOnly) {
        ChannelListingFilter toFilter() {
            return new ChannelListingFilter(search, channelInstance, listingStatus, syncState,
                    lifecycle, publicationIntent, sellableProductId, mapped,
                    Boolean.TRUE.equals(divergedOnly), Boolean.TRUE.equals(unsentOnly));
        }
    }

    /**
     * The LOCAL editable surface.
     *
     * <p>🔴 No channel-REPORTED field is accepted — the reported side is written by inbound
     * readback alone ({@code PRD-181.a}), and a save is never a push ({@code PRD-185}).
     */
    public record ChannelListingRequest(String channelInstance,
                                        String externalListingId,
                                        String channelSku,
                                        String mappedSellableSku,
                                        String intendedTitle,
                                        String intendedDescription,
                                        BigDecimal salePrice,
                                        /*
                                          🔴 `PRD-199` supersedes `PRD-197`: the commercial
                                          model is a base price plus an OPTIONAL, time-bounded
                                          promotion. `mrp` is deliberately absent — it is no
                                          longer a Channel Listing price and is not accepted.
                                        */
                                        BigDecimal promotionPrice,
                                        Instant promotionStartsAt,
                                        Instant promotionEndsAt,
                                        BigDecimal publishedMarketplaceStock,
                                        String publicationIntent,
                                        String intendedChannelCategory,
                                        String intendedChannelCategoryRef,
                                        /*
                                          🔴 `PRD-198.d` — the Listing's OWN ordered highlights.
                                          An ABSENT field leaves them untouched; an EMPTY array
                                          clears the override and restores the master fallback.
                                          The two are deliberately different answers.
                                        */
                                        List<String> highlights,
                                        /*
                                          🔴 `PRD-202.b` — OPTIONAL Bangla overrides. An absent
                                          field leaves them untouched; a blank one is absent and
                                          falls back to English (`PRD-202.e`).
                                        */
                                        String intendedTitleBn,
                                        String intendedDescriptionBn,
                                        List<String> highlightsBn,
                                        /* 🔴 `PRD-201` — kilograms and centimetres. */
                                        BigDecimal packageWeightKg,
                                        BigDecimal packageLengthCm,
                                        BigDecimal packageWidthCm,
                                        BigDecimal packageHeightCm,
                                        String packageContent,
                                        /* 🔴 `PRD-200.e` — accepted-from-AI field keys, this save only. */
                                        List<String> aiAssistedFields,
                                        Long version) {
        ChannelListingCommandService.ChannelListingInput toInput() {
            return new ChannelListingCommandService.ChannelListingInput(channelInstance,
                    externalListingId, channelSku, mappedSellableSku, intendedTitle,
                    intendedDescription, salePrice, promotionPrice, promotionStartsAt,
                    promotionEndsAt, publishedMarketplaceStock,
                    publicationIntent, intendedChannelCategory, intendedChannelCategoryRef,
                    highlights, intendedTitleBn, intendedDescriptionBn, highlightsBn,
                    packageWeightKg, packageLengthCm, packageWidthCm, packageHeightCm,
                    packageContent, aiAssistedFields);
        }
    }

    public record MapSkuRequest(String mappedSellableSku, Long version) {
    }

    public record SkuValuesRequest(BigDecimal salePrice,
                                   BigDecimal promotionPrice,
                                   Instant promotionStartsAt,
                                   Instant promotionEndsAt,
                                   BigDecimal publishedMarketplaceStock,
                                   Long version) {
    }

    public record AcceptRequest(String field) {
    }

    /**
     * One AI authoring request, {@code PRD-200.f}.
     *
     * <p>🔴 {@code facts} carries ONLY what the Listing being authored actually holds. A blank
     * value is reported to the assistant as ABSENT rather than dropped, so a missing warranty
     * period can never come back as an invented one ({@code PRD-200.g}).
     */
    public record AiGenerateRequest(ListingAiAuthoringPort.AuthoringKind kind,
                                    String language,
                                    String instruction,
                                    Map<String, String> facts,
                                    List<String> adapterConstraints) {
    }

    public record IntendedMediaRequest(List<MediaItem> items) {
        public record MediaItem(UUID mediaAssetId, boolean primary) {
        }
    }
}
