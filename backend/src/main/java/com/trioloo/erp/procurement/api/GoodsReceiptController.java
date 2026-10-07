package com.trioloo.erp.procurement.api;

import com.trioloo.erp.procurement.application.GoodsReceiptService;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.format.annotation.DateTimeFormat;
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

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Goods receipts. 🔴 PRJ-031 - HTTP translation only. There is deliberately no PUT and no DELETE: a receipt records one
 * decision and is never edited ({@code PRC-037}); a wrong one is corrected by a linked adjustment ({@code PRC-006}).
 */
@RestController
@RequestMapping("/api/procurement/goods-receipts")
public class GoodsReceiptController {

    private final GoodsReceiptService receipts;

    public GoodsReceiptController(GoodsReceiptService receipts) {
        this.receipts = receipts;
    }

    @GetMapping
    public GoodsReceiptService.Page list(@RequestParam(required = false) String search, @RequestParam(required = false) UUID supplierId,
                                         @RequestParam(required = false) Boolean issues,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                         @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return receipts.list(search, supplierId, issues, from, to, page, size);
    }

    @GetMapping("/{id}")
    public GoodsReceiptService.Detail detail(@PathVariable UUID id) {
        return receipts.detail(id);
    }

    @GetMapping("/receivable-orders")
    public List<GoodsReceiptService.ReceivableOrder> receivableOrders(@RequestParam(required = false) UUID supplierId) {
        return receipts.receivableOrders(supplierId);
    }

    @GetMapping("/order-lines/{purchaseOrderId}")
    public List<GoodsReceiptService.OrderLine> orderLines(@PathVariable UUID purchaseOrderId) {
        return receipts.orderLines(purchaseOrderId);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> record(@RequestBody GoodsReceiptService.Input input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", receipts.record(input)));
    }

    @ExceptionHandler(AccessDeniedByPermissionException.class)
    public ResponseEntity<Map<String, String>> denied(AccessDeniedByPermissionException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, String>> refused(RuntimeException e) {
        HttpStatus status = e instanceof IllegalStateException ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(Map.of("message", e.getMessage()));
    }
}
