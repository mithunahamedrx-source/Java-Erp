package com.trioloo.erp.procurement.api;

import com.trioloo.erp.procurement.application.PurchaseOrderService;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
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

import java.util.Map;
import java.util.UUID;

/**
 * Purchase Orders. 🔴 PRJ-031 - HTTP translation only. There is deliberately no DELETE: a cancelled order keeps its number
 * and its history ({@code PRC-022}, {@code PRC-026}).
 */
@RestController
@RequestMapping("/api/procurement/purchase-orders")
public class PurchaseOrderController {

    private final PurchaseOrderService orders;

    public PurchaseOrderController(PurchaseOrderService orders) {
        this.orders = orders;
    }

    @GetMapping
    public PurchaseOrderService.Page list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                          @RequestParam(required = false) UUID supplierId, @RequestParam(required = false) Boolean shipped,
                                          @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return orders.list(search, status, supplierId, shipped, page, size);
    }

    @GetMapping("/{id}")
    public PurchaseOrderService.Detail detail(@PathVariable UUID id) {
        return orders.detail(id);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(@RequestBody PurchaseOrderService.Input input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", orders.create(input)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> update(@PathVariable UUID id, @RequestBody PurchaseOrderService.Input input) {
        orders.update(id, input);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<Void> approve(@PathVariable UUID id) {
        orders.approve(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/send")
    public ResponseEntity<Void> send(@PathVariable UUID id) {
        orders.send(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/supplier-shipped")
    public ResponseEntity<Void> supplierShipped(@PathVariable UUID id) {
        orders.recordSupplierShipment(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<Void> cancel(@PathVariable UUID id, @RequestBody PurchaseOrderService.CancelInput input) {
        orders.cancel(id, input);
        return ResponseEntity.noContent().build();
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
