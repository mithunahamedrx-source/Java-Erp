package com.trioloo.erp.procurement.api;

import com.trioloo.erp.procurement.application.SupplierLedgerService;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/** The Supplier Ledger, read-only ({@code PRC-052}). 🔴 PRJ-031 - HTTP translation only. */
@RestController
@RequestMapping("/api/procurement/suppliers/{id}/ledger")
public class SupplierLedgerController {

    private final SupplierLedgerService ledgers;

    public SupplierLedgerController(SupplierLedgerService ledgers) {
        this.ledgers = ledgers;
    }

    @GetMapping
    public SupplierLedgerService.Ledger ledger(@PathVariable UUID id,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                               @RequestParam(required = false) String type) {
        return ledgers.ledger(id, from, to, type);
    }

    @ExceptionHandler(AccessDeniedByPermissionException.class)
    public ResponseEntity<Map<String, String>> denied(AccessDeniedByPermissionException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> refused(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
    }
}
