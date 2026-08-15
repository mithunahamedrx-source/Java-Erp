package com.trioloo.erp.product.api;

import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import com.trioloo.erp.product.application.ChannelListingNotFoundException;
import com.trioloo.erp.product.application.ChannelListingOperationService;
import com.trioloo.erp.product.application.ChannelListingValidationException;
import com.trioloo.erp.product.application.ListingViews;
import com.trioloo.erp.product.application.RefreshResultView;
import com.trioloo.erp.product.domain.ActivityKind;
import com.trioloo.erp.product.domain.OperationKind;
import com.trioloo.erp.product.domain.OperationOutcome;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Every endpoint that CONTACTS a channel, plus the records those acts leave behind.
 *
 * <p>🔴 {@code API-064.a} — deliberately separate from the local save endpoints. A save is
 * never a push ({@code PRD-185}), and separating the routes makes that boundary visible in
 * the API surface itself rather than buried in a service.
 *
 * <p>🔴 {@code PRD-196.a} — outbound acts require {@code product.channel-listing.publish};
 * inbound acts require {@code product.channel-listing.sync}. Enforcement is in the
 * application layer, because frontend hiding is not authorization.
 */
@RestController
@RequestMapping("/api/product/channel-listings")
public class ChannelListingOperationController {

    private final ChannelListingOperationService operations;

    public ChannelListingOperationController(ChannelListingOperationService operations) {
        this.operations = operations;
    }

    /**
     * Requests one remote act against an EXPLICIT selection.
     *
     * <p>🔴 {@code INV-108.4} — the scope is exactly what was selected. The server never
     * expands a batch to sibling listings sharing a Sellable Product ({@code PRD-187.b}).
     */
    @PostMapping("/operations")
    public ResponseEntity<Map<String, Object>> request(@RequestBody OperationRequest request) {
        if (request.kind() == null) {
            throw new ChannelListingValidationException("kind", "An operation kind is required.");
        }
        UUID batchId = operations.request(request.kind(), request.listingIds(),
                request.scopeDescription());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("batchId", batchId));
    }

    /**
     * Re-reads ONE listing from its channel, {@code PRD-189.c} — FRAME 16.
     *
     * <p>🔴 REFRESH READS THE MARKETPLACE AND NEVER WRITES TO IT. It updates the REPORTED side
     * only; intended values, mappings, publication intent and the unsent condition are all
     * left exactly as they were ({@code PRD-181.a}).
     *
     * <p>🔴 {@code PRD-196.a} — requires {@code sync}. Publish does not grant it and manage
     * does not grant it.
     *
     * <p>⚠ Refuses BEFORE recording anything when the listing has no remote identity or the
     * channel has no adapter: an operation row for an attempt that never happened would be a
     * lie the operator could not detect.
     */
    @PostMapping("/{id}/refresh")
    public RefreshResultView refreshOne(@PathVariable UUID id) {
        return operations.refreshOne(id);
    }

    /**
     * Retries only the FAILED members of a batch, {@code PRD-186.d}.
     *
     * <p>🔴 Items needing manual attention are excluded by design — a person must decide
     * those before anything is sent again.
     */
    @PostMapping("/operations/batches/{batchId}/retry")
    public ResponseEntity<Map<String, Object>> retry(@PathVariable UUID batchId) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(Map.of("batchId", operations.retryFailed(batchId)));
    }

    /**
     * Enumerates a channel's active listings, {@code PRD-175}.
     *
     * <p>🔴 The response reports whether the run COMPLETED. A truncated run is never
     * presented as a full picture ({@code API-066.b}), because {@code PRD-177}'s
     * absence-is-not-deletion guarantee depends on the operator knowing.
     */
    @PostMapping("/discovery")
    public ChannelListingOperationService.DiscoveryOutcome discover(
            @RequestBody DiscoveryRequest request) {
        if (request.channelInstanceId() == null) {
            throw new ChannelListingValidationException("channelInstanceId",
                    "Choose a channel to discover.");
        }
        return operations.discover(request.channelInstanceId());
    }

    /** A batch and its DERIVED tally ({@code INV-108.2}). */
    @GetMapping("/operations/batches/{batchId}")
    public ListingViews.BatchView batch(@PathVariable UUID batchId) {
        return operations.batch(batchId);
    }

    /**
     * The batch's members, server-paginated.
     *
     * <p>🔴 {@code INV-107.1} — per-listing outcomes are returned individually and never
     * collapsed into an aggregate. {@code INV-107.2} — a failed sibling never makes a
     * succeeded record appear failed.
     */
    @GetMapping("/operations/batches/{batchId}/members")
    public Map<String, Object> members(@PathVariable UUID batchId,
                                       @RequestParam(required = false) OperationOutcome outcome,
                                       @RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "50") int size) {
        Page<ListingViews.OperationView> result = operations.batchMembers(batchId, outcome,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200)));
        return page(result);
    }

    @GetMapping("/operations/batches")
    public Map<String, Object> batches(@RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "20") int size) {
        return page(operations.recentBatches(
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100))));
    }

    @GetMapping("/{id}/operations")
    public List<ListingViews.OperationView> forListing(@PathVariable UUID id) {
        return operations.operationsFor(id);
    }

    /**
     * A listing's activity history, {@code PRD-129}.
     *
     * <p>✅ An ACTIVITY log, not an audit log ({@code AUD-001}). It replaces no audit
     * obligation.
     */
    @GetMapping("/{id}/activity")
    public Map<String, Object> activity(@PathVariable UUID id,
                                        @RequestParam(required = false) ActivityKind kind,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "50") int size) {
        return page(operations.activity(id, kind,
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200))));
    }

    private static Map<String, Object> page(Page<?> result) {
        return Map.of("content", result.getContent(), "page", result.getNumber(),
                "size", result.getSize(), "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages());
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

    public record OperationRequest(OperationKind kind, List<UUID> listingIds,
                                   String scopeDescription) {
    }

    public record DiscoveryRequest(UUID channelInstanceId) {
    }
}
