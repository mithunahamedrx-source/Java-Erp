package com.trioloo.erp.order.api;

import com.trioloo.erp.order.application.OrderLifecycleService;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Cancel and restore — {@code PRM-095}. 🔴 THE AUTHORISATION IS IN THE SERVICE, NOT HERE
 * ({@code PRM-004}).
 */
@RestController
@RequestMapping("/api/order/orders")
public class OrderLifecycleController {

    private final OrderLifecycleService lifecycle;

    public OrderLifecycleController(OrderLifecycleService lifecycle) {
        this.lifecycle = lifecycle;
    }

    @PostMapping("/{orderId}/cancel")
    public OrderLifecycleService.Outcome cancel(@PathVariable UUID orderId,
                                                @RequestBody CancelRequest request) {
        return lifecycle.cancel(orderId, request.reason(), request.note());
    }

    @PostMapping("/{orderId}/restore")
    public OrderLifecycleService.Outcome restore(@PathVariable UUID orderId) {
        return lifecycle.restore(orderId);
    }

    public record CancelRequest(String reason, String note) {
    }

    @ExceptionHandler(AccessDeniedByPermissionException.class)
    public ResponseEntity<Map<String, String>> denied(AccessDeniedByPermissionException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
    }

    /** ⚠ A refused act is the operator's to understand, so it answers 4xx with the reason. */
    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    public ResponseEntity<Map<String, String>> refused(RuntimeException e) {
        HttpStatus status = e instanceof IllegalStateException ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(Map.of("message", e.getMessage()));
    }
}
