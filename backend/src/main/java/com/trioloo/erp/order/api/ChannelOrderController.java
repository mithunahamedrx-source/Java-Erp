package com.trioloo.erp.order.api;

import com.trioloo.erp.order.application.ChannelOrderImportException;
import com.trioloo.erp.order.application.ChannelOrderImportService;
import com.trioloo.erp.order.application.ChannelOrderNotFoundException;
import com.trioloo.erp.order.application.ChannelOrderQueryService;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
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

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/order/channel-orders")
public class ChannelOrderController {

    private final ChannelOrderQueryService queries;
    private final ChannelOrderImportService imports;

    public ChannelOrderController(ChannelOrderQueryService queries, ChannelOrderImportService imports) {
        this.queries = queries;
        this.imports = imports;
    }

    @GetMapping
    public Map<String, Object> list(ChannelOrderHttpQuery query,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "50") int size) {
        Page<ChannelOrderQueryService.ChannelOrderRow> result = queries.list(query.toFilter(),
                PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 200)));
        return Map.of("content", result.getContent(), "page", result.getNumber(),
                "size", result.getSize(), "totalElements", result.getTotalElements(),
                "totalPages", result.getTotalPages());
    }

    @GetMapping("/summary")
    public ChannelOrderQueryService.Summary summary(ChannelOrderHttpQuery query) {
        return queries.summary(query.toFilter());
    }

    @GetMapping("/{id}")
    public ChannelOrderQueryService.ChannelOrderDetail detail(@PathVariable UUID id) {
        return queries.detail(id);
    }

    @PostMapping("/imports")
    public ChannelOrderImportService.ImportOutcome importWindow(@RequestBody ImportRequest request) {
        return imports.importWindow(request.channelInstanceId(), request.createdAfter(),
                request.createdBefore(), request.pageSize() == null ? 0 : request.pageSize());
    }

    @ExceptionHandler(AccessDeniedByPermissionException.class)
    public ResponseEntity<Map<String, Object>> denied(AccessDeniedByPermissionException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "FORBIDDEN", "requiredPermission", e.requiredPermission(),
                        "message", e.getMessage()));
    }

    @ExceptionHandler(ChannelOrderImportException.class)
    public ResponseEntity<Map<String, Object>> invalidImport(ChannelOrderImportException e) {
        return ResponseEntity.badRequest()
                .body(Map.of("error", "VALIDATION_FAILED", "message", e.getMessage()));
    }

    @ExceptionHandler(ChannelOrderNotFoundException.class)
    public ResponseEntity<Map<String, Object>> missing(ChannelOrderNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "NOT_FOUND", "message", e.getMessage()));
    }

    public record ChannelOrderHttpQuery(UUID channelInstanceId, String status, String search) {
        ChannelOrderQueryService.Filter toFilter() {
            return new ChannelOrderQueryService.Filter(channelInstanceId, status, search);
        }
    }

    public record ImportRequest(UUID channelInstanceId, Instant createdAfter,
                                Instant createdBefore, Integer pageSize) {
    }
}
