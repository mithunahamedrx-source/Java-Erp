package com.trioloo.erp.order.api;

import com.trioloo.erp.order.application.ManualOrderService;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Manual order capture — {@code PRM-093}, {@code OM §22}.
 *
 * <p>🔴 THE AUTHORISATION IS NOT HERE ({@code PRM-004}). The gate is in the application service so
 * it cannot drift out of step with an annotation.
 */
@RestController
@RequestMapping("/api/order/orders")
public class ManualOrderController {

    private final ManualOrderService orders;

    public ManualOrderController(ManualOrderService orders) {
        this.orders = orders;
    }

    @PostMapping
    public ResponseEntity<ManualOrderService.Created> create(
            @RequestBody ManualOrderService.NewOrder request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(orders.create(request));
    }

    @ExceptionHandler(AccessDeniedByPermissionException.class)
    public ResponseEntity<Map<String, String>> denied(AccessDeniedByPermissionException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
    }

    /** ⚠ A rejected capture is the operator's to correct, so it answers 400 with the reason. */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalid(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }
}
