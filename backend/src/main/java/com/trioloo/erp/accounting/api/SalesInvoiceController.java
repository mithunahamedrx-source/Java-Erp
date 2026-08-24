package com.trioloo.erp.accounting.api;

import com.trioloo.erp.accounting.application.SalesInvoiceService;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * The Sales Invoice surface — {@code PRM-094}.
 *
 * <p>🔴 THE AUTHORISATION IS NOT HERE. {@code PRM-004} puts the gate in the application service,
 * and this controller carries no annotation that could drift out of step with it.
 */
@RestController
@RequestMapping("/api/accounting/orders/{orderId}/invoice")
public class SalesInvoiceController {

    private final SalesInvoiceService invoices;

    public SalesInvoiceController(SalesInvoiceService invoices) {
        this.invoices = invoices;
    }

    /**
     * ⚠ {@code 404} WHERE NO INVOICE HAS BEEN ISSUED, WHICH IS AN ANSWER RATHER THAN A FAULT.
     * Most orders have none, and `BR-134` makes absence a fact.
     */
    @GetMapping
    public ResponseEntity<SalesInvoiceService.Rendered> read(@PathVariable UUID orderId) {
        return invoices.forRendering(orderId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<SalesInvoiceService.Issued> issue(@PathVariable UUID orderId) {
        return ResponseEntity.status(HttpStatus.CREATED).body(invoices.issue(orderId));
    }

    @ExceptionHandler(AccessDeniedByPermissionException.class)
    public ResponseEntity<Map<String, String>> denied(AccessDeniedByPermissionException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
    }

    /**
     * ⚠ {@code 409}, NOT {@code 500}. {@code INV-39.1} — one sequence, never reused — makes a
     * second invoice a business refusal rather than a system failure, and the operator needs to
     * be told that rather than shown a stack trace.
     */
    @ExceptionHandler(SalesInvoiceService.InvoiceAlreadyIssuedException.class)
    public ResponseEntity<Map<String, String>> alreadyIssued(
            SalesInvoiceService.InvoiceAlreadyIssuedException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
    }
}
