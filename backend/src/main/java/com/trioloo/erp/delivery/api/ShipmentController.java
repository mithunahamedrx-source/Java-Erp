package com.trioloo.erp.delivery.api;

import com.trioloo.erp.delivery.application.ShipmentBookingService;
import com.trioloo.erp.delivery.application.ShipmentTrackingService;
import com.trioloo.erp.integration.infrastructure.steadfast.SteadfastConfigurationException;
import com.trioloo.erp.integration.infrastructure.steadfast.SteadfastCredentialException;
import com.trioloo.erp.integration.infrastructure.steadfast.SteadfastProtocolException;
import com.trioloo.erp.integration.infrastructure.steadfast.SteadfastTransportException;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Delivery actions exposed to the Orders workspace - {@code PRM-092}, {@code DLV-013},
 * {@code DLV-031}.
 *
 * <p>The permission boundary remains in the application services ({@code PRM-004}); this class is
 * only the narrow HTTP surface needed by the Orders UI.
 */
@RestController
@RequestMapping("/api/delivery")
public class ShipmentController {

    private final ShipmentBookingService bookings;
    private final ShipmentTrackingService tracking;

    public ShipmentController(ShipmentBookingService bookings, ShipmentTrackingService tracking) {
        this.bookings = bookings;
        this.tracking = tracking;
    }

    @PostMapping("/orders/{orderId}/shipment-booking")
    public ResponseEntity<ShipmentBookingService.Booked> book(@PathVariable UUID orderId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(bookings.book(orderId));
    }

    @PostMapping("/orders/{orderId}/tracking-refresh")
    public ShipmentTrackingService.Tracked refreshTracking(@PathVariable UUID orderId) {
        return tracking.refreshForOrder(orderId);
    }

    @ExceptionHandler(AccessDeniedByPermissionException.class)
    public ResponseEntity<Map<String, String>> denied(AccessDeniedByPermissionException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(ShipmentBookingService.ShipmentAlreadyBookedException.class)
    public ResponseEntity<Map<String, String>> alreadyBooked(
            ShipmentBookingService.ShipmentAlreadyBookedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler({
            ShipmentBookingService.ShipmentBookingRefusedException.class,
            IllegalArgumentException.class,
            IllegalStateException.class})
    public ResponseEntity<Map<String, String>> refused(RuntimeException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler({SteadfastConfigurationException.class, SteadfastCredentialException.class})
    public ResponseEntity<Map<String, String>> providerUnavailable(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler({SteadfastTransportException.class, SteadfastProtocolException.class})
    public ResponseEntity<Map<String, String>> providerFailure(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("message", e.getMessage()));
    }
}
