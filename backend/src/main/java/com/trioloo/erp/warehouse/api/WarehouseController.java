package com.trioloo.erp.warehouse.api;

import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import com.trioloo.erp.warehouse.application.StockLocationService;
import com.trioloo.erp.warehouse.application.WarehouseService;
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
 * Warehouses and Stock Locations. 🔴 PRJ-031 - HTTP translation only; every rule and every authorisation decision is in
 * the services. There is deliberately no DELETE: a record referenced by history is archived, never deleted
 * ({@code INV-4.3}).
 */
@RestController
@RequestMapping("/api/warehouse")
public class WarehouseController {

    private final WarehouseService warehouses;
    private final StockLocationService locations;

    public WarehouseController(WarehouseService warehouses, StockLocationService locations) {
        this.warehouses = warehouses;
        this.locations = locations;
    }

    @GetMapping("/warehouses")
    public WarehouseService.Page listWarehouses(@RequestParam(required = false) String search,
                                                @RequestParam(required = false) String status,
                                                @RequestParam(defaultValue = "0") int page,
                                                @RequestParam(defaultValue = "10") int size) {
        return warehouses.list(search, status, page, size);
    }

    @PostMapping("/warehouses")
    public ResponseEntity<Map<String, Object>> createWarehouse(@RequestBody WarehouseService.Input input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", warehouses.create(input)));
    }

    @PutMapping("/warehouses/{id}")
    public ResponseEntity<Void> updateWarehouse(@PathVariable UUID id, @RequestBody WarehouseService.Input input) {
        warehouses.update(id, input);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/locations")
    public StockLocationService.Page listLocations(@RequestParam(required = false) String search,
                                                   @RequestParam(required = false) UUID warehouseId,
                                                   @RequestParam(required = false) String type,
                                                   @RequestParam(required = false) Boolean sellable,
                                                   @RequestParam(required = false) String status,
                                                   @RequestParam(defaultValue = "0") int page,
                                                   @RequestParam(defaultValue = "10") int size) {
        return locations.list(search, warehouseId, type, sellable, status, page, size);
    }

    @PostMapping("/locations")
    public ResponseEntity<Map<String, Object>> createLocation(@RequestBody StockLocationService.Input input) {
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", locations.create(input)));
    }

    @PutMapping("/locations/{id}")
    public ResponseEntity<Void> updateLocation(@PathVariable UUID id, @RequestBody StockLocationService.Input input) {
        locations.update(id, input);
        return ResponseEntity.noContent().build();
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
