package com.trioloo.erp.system.api;

import com.trioloo.erp.integration.application.ConnectionUnavailableException;
import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.system.application.ShopAccessDeniedException;
import com.trioloo.erp.system.application.ShopCommandService;
import com.trioloo.erp.system.application.ShopFilter;
import com.trioloo.erp.system.application.ShopNotFoundException;
import com.trioloo.erp.system.application.ShopQueryService;
import com.trioloo.erp.system.application.ShopValidationException;
import com.trioloo.erp.system.application.ShopViews;
import com.trioloo.erp.system.domain.ChannelTypeCode;
import com.trioloo.erp.system.domain.ConfigurationState;
import com.trioloo.erp.system.domain.MarketCode;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
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

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The Shops & Channels REST surface ({@code SC-W}).
 *
 * <p>🔴 {@code PRJ-031} — a controller is not a service. Every method translates HTTP and
 * delegates; no business rule, no derivation and no authorisation decision lives here.
 * Authorisation is enforced in the application service on every entry point
 * ({@code PRM-004}, {@code SCS-050.c}).
 *
 * <p>🔴 NO DELETE ENDPOINT EXISTS, AT ANY AUTHORITY ({@code SCS-053}, {@code INV-16.10},
 * {@code SYS-024}). 🔴 No listing refresh, push or channel sync endpoint exists here either —
 * those are Product's and stay there ({@code UX-273.b}).
 */
@RestController
@RequestMapping("/api/system/shops")
public class ShopController {

    private final ShopQueryService queries;
    private final ShopCommandService commands;

    public ShopController(ShopQueryService queries, ShopCommandService commands) {
        this.queries = queries;
        this.commands = commands;
    }

    /** {@code SCS-024} — the workspace rows, server-resolved and pageable ({@code TEC-096}). */
    @GetMapping
    public Map<String, Object> list(ShopQuery query,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "50") int size,
                                    @RequestParam(defaultValue = "name") String sort,
                                    @RequestParam(defaultValue = "ASC") String direction) {
        Sort.Direction dir = "DESC".equalsIgnoreCase(direction) ? Sort.Direction.DESC : Sort.Direction.ASC;
        Page<ShopViews.ShopRow> result = queries.list(query.toFilter(),
                PageRequest.of(Math.max(page, 0), clampSize(size), Sort.by(dir, safeSort(sort))));

        return Map.of(
                "content", result.getContent(),
                "page", result.getNumber(),
                "size", result.getSize(),
                "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages(),
                /* {@code SCS-023.c} — "Showing N of M shops" needs the unfiltered corpus size. */
                "totalRegistered", queries.totalRegistered());
    }

    /** {@code SCS-020} — pagination-independent, so deliberately a separate call. */
    @GetMapping("/summary")
    public ShopViews.ShopSummary summary(ShopQuery query) {
        return queries.summary(query.toFilter());
    }

    /** {@code SCS-040} — one shop in full, for `SC-D` and to prefill the edit modal. */
    @GetMapping("/{id}")
    public ShopViews.ShopDetail detail(@PathVariable UUID id) {
        return queries.detail(id);
    }

    /**
     * {@code SC-F} add — 🔴 registers a LOCAL record only. It neither creates nor contacts the
     * remote account ({@code SCS-030.d}).
     */
    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody ShopRequest request) {
        UUID id = commands.create(request.toInput());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }

    /** {@code SC-F} edit — the mutable local facts only ({@code SCS-030}). */
    @PutMapping("/{id}")
    public ResponseEntity<Void> update(@PathVariable UUID id, @RequestBody ShopRequest request) {
        commands.update(id, request.toInput());
        return ResponseEntity.noContent().build();
    }

    /**
     * {@code SCS-051} — {@code DRAFT → ACTIVE}.
     *
     * <p>🔴 A SEPARATE ENDPOINT AND A SEPARATE CAPABILITY: {@code system.channel-instance
     * .lifecycle}, never {@code manage} ({@code PRM-090.a}). Holding authority to edit a
     * shop's name never carries authority to approve it for operational use.
     */
    @PostMapping("/{id}/activate")
    public ResponseEntity<Void> activate(@PathVariable UUID id) {
        commands.activate(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * The channel types the REGISTRY OFFERS.
     *
     * <p>🔴 {@code SCS-092.b} — DELIBERATELY A SUBSET of {@code E-015}'s recognised set, and
     * the two are different facts. The registry omits the manual channels because they carry
     * no listings ({@code PRD-028}); the set itself is unchanged and {@code INV-15.4} is not
     * weakened by the omission.
     *
     * <p>🔴 The list is served BY THE SERVER so the form can never offer a value the backend
     * would reject, and so free text has nowhere to enter ({@code SCS-030.b}).
     */
    @GetMapping("/channel-types")
    public List<Map<String, String>> channelTypes() {
        return OFFERED.stream()
                .map(type -> Map.of("code", type.name(), "label", type.label()))
                .toList();
    }

    /**
     * The channel types the Shops & Channels registry offers.
     *
     * <p>⚠ Transcribed from the approved pack's Add Shop selector ({@code SCS-092.a}), not
     * chosen here, and shared with the validator so the two can never disagree.
     */
    static final List<ChannelTypeCode> OFFERED = ShopCommandService.OFFERED;

    /**
     * {@code INV-16.7} — the recognised Market set.
     *
     * <p>🔴 SERVED BY THE SERVER, exactly as the channel types are, so the form can never
     * offer a value the backend would reject and free text has nowhere to enter.
     *
     * <p>⚠ It returns ONE member today. That is the ratified set, not a placeholder, and a
     * second member arrives by canonical amendment rather than by editing this method.
     */
    @GetMapping("/markets")
    public List<Map<String, String>> markets() {
        return java.util.Arrays.stream(MarketCode.values())
                .map(market -> Map.of("code", market.name(), "label", market.label()))
                .toList();
    }

    // ------------------------------------------------------------------ errors

    /** {@code PRM-003} — a denial is 403 and names the capability, never the subject. */
    @ExceptionHandler(ShopAccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> denied(ShopAccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "FORBIDDEN", "requiredPermission", e.requiredPermission(),
                        "message", e.getMessage()));
    }

    @ExceptionHandler(ShopValidationException.class)
    public ResponseEntity<Map<String, Object>> invalid(ShopValidationException e) {
        return ResponseEntity.badRequest()
                .body(Map.of("error", "VALIDATION_FAILED",
                        "field", e.field() == null ? "" : e.field(),
                        "message", e.getMessage()));
    }

    @ExceptionHandler(ShopNotFoundException.class)
    public ResponseEntity<Map<String, Object>> missing(ShopNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "NOT_FOUND", "message", e.getMessage()));
    }

    /**
     * 🔴 {@code SCS-043.a} — Integration had no answer. This reaches HTTP only where the
     * request DEPENDED on a connection fact (filtering by it); an ordinary list or detail
     * read degrades to "not known" and still returns the shops.
     */
    @ExceptionHandler(ConnectionUnavailableException.class)
    public ResponseEntity<Map<String, Object>> connectionUnavailable(ConnectionUnavailableException e) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("error", "CONNECTION_UNAVAILABLE", "message", e.getMessage()));
    }

    private static int clampSize(int size) {
        return Math.min(Math.max(size, 1), 200);
    }

    private static String safeSort(String field) {
        return List.of("name", "code", "channelType", "configuration").contains(field) ? field : "name";
    }

    /** One shape for the list and the summary, so their scopes cannot disagree. */
    public record ShopQuery(String search, ChannelTypeCode channelType, ConnectionState connection,
                            ConfigurationState configuration) {

        ShopFilter toFilter() {
            return new ShopFilter(search, channelType, connection, configuration);
        }
    }

    /**
     * 🔴 THE THREE OPERATOR INPUTS, AND NOTHING ELSE ({@code SCS-030.a}).
     *
     * <p>There is no field here for an internal code, an external account identity, an
     * external link, a configuration state, a connection state, an app key, an app secret or
     * a token — so a client cannot submit one even deliberately ({@code SCS-052}).
     */
    public record ShopRequest(String name, String channelType, String market) {

        ShopCommandService.ShopInput toInput() {
            return new ShopCommandService.ShopInput(name, channelType, market);
        }
    }
}
