package com.trioloo.erp.accounting.application;

import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
import com.trioloo.erp.platform.money.MonetaryAmount;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Issues the {@code E-039} Sales Invoice — {@code INV-39.1}, {@code INV-39.2}, {@code PRN-022}.
 *
 * <p>🔴 ISSUING IS TAKING A SNAPSHOT, AND THAT IS THE WHOLE JOB. {@code INV-39.2} requires the
 * content preserved so the document renders identically years later, and {@code PRN-022} makes
 * this record the printable's ONE authoritative source. ⚠ A renderer that re-read the order would
 * quietly reprint last year's invoice with this year's prices and this year's address.
 *
 * <p>🔴 IT ISSUES NO NUMBER. {@code OSC-057} already assigned one to the order and {@code V19}'s
 * trigger makes it immutable, so the invoice ADOPTS it. ⚠ Minting a second number here would be
 * the second sequence {@code BD-443} prohibits outright.
 *
 * <p>🔴 IT COMPUTES NO TAX. The product owner ratified that the invoice CARRIES VAT and
 * {@code BD-307} permits displaying it while the ERP maintains no VAT accounts — but
 * {@code GAP-003} supplies no rate, no BIN, no Mushak requirement and no calculation. ⚠ The rate
 * is CONFIGURATION and is unset by default; unset means the invoice records no tax rather than a
 * confident zero ({@code SYS-034} — and a `0%` line is a claim, not an absence).
 */
@Service
public class SalesInvoiceService {

    private final JdbcTemplate jdbc;
    private final Clock clock;
    private final ObjectMapper json = new ObjectMapper();
    private final BigDecimal taxRatePercent;

    public SalesInvoiceService(
            JdbcTemplate jdbc,
            Clock clock,
            /*
              ⚠ EMPTY BY DEFAULT, DELIBERATELY. GAP-003 has not ratified a rate, and Bangladesh
              has more than one lawful one - which applies depends on Trioloo's registration and
              product categories, which is a legal question. 🔴 The design's `vatRate = 7.5` sits
              in the mock beside sample Lenovo line items and a sample delivery charge, so it is
              sample data (design-reference/TrioLoo Invoice.md §4) and is not read from here.
            */
            @Value("${trioloo.invoice.tax-rate-percent:}") String configuredTaxRate) {
        this.jdbc = jdbc;
        this.clock = clock;
        this.taxRatePercent = configuredTaxRate == null || configuredTaxRate.isBlank()
                ? null
                : new BigDecimal(configuredTaxRate.trim());
    }

    /**
     * @throws InvoiceAlreadyIssuedException if this order already has one
     */
    @Transactional
    public Issued issue(UUID channelOrderId) {
        UUID actor = actorId();
        OrderSnapshot order = load(channelOrderId);

        if (order.invoiceNumber() == null || order.invoiceNumber().isBlank()) {
            throw new IllegalStateException(
                    "Order " + channelOrderId + " carries no Trioloo invoice number (OSC-057).");
        }

        List<Map<String, Object>> lines = loadLines(channelOrderId);

        BigDecimal subtotal = lines.stream()
                .map(line -> (BigDecimal) line.get("lineTotal"))
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        /*
          ⚠ THE DELIVERY CHARGE IS THE ORDER'S OWN, NOT AN ASSUMED ONE. DLV §13 owns the customer
          delivery charge, and the design's `charges = 800` is sample data.
        */
        BigDecimal deliveryCharge = order.shippingFee();
        BigDecimal taxable = subtotal.add(deliveryCharge == null ? BigDecimal.ZERO : deliveryCharge);

        BigDecimal taxAmount = taxRatePercent == null
                ? null
                /*
                  💰 Rounded HALF_UP to two places at the moment the invoice is SNAPSHOTTED, which
                  is a document figure and therefore the correct place to round. 🔴 PRJ / DB-079
                  forbid premature rounding of a RATE or a weighted average; this is neither - it
                  is the printed amount, fixed once and never recomputed (INV-39.2).
                */
                : taxable.multiply(taxRatePercent)
                        .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);

        BigDecimal total = taxable.add(taxAmount == null ? BigDecimal.ZERO : taxAmount);

        Instant now = Instant.now(clock);
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("""
                    INSERT INTO sales_invoice (
                        id, channel_order_id, invoice_number, issued_at, issued_by,
                        customer_name, customer_phone, customer_address,
                        external_order_reference, consignment_reference,
                        subtotal, delivery_charge, tax_rate_percent, tax_amount, total, lines_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb))
                    """,
                    id, channelOrderId, order.invoiceNumber(), Timestamp.from(now), actor,
                    order.customerName(), order.customerPhone(), order.customerAddress(),
                    order.externalOrderId(), order.consignmentId(),
                    subtotal, deliveryCharge, taxRatePercent, taxAmount, total,
                    json.writeValueAsString(lines));
        } catch (DuplicateKeyException e) {
            /*
              🔴 INV-39.1 - one order, one invoice, and a number is never reused. Re-issuing would
              produce a second document claiming the same identity.
            */
            throw new InvoiceAlreadyIssuedException(
                    "Order " + channelOrderId + " already has invoice " + order.invoiceNumber()
                            + ". INV-39.1 - one sequence, never reused, and a cancelled number is "
                            + "retired rather than recycled (DB-012).");
        }

        return new Issued(id, order.invoiceNumber(), subtotal, deliveryCharge,
                taxRatePercent, taxAmount, total);
    }

    /* ------------------------------------------------------------------ internals */

    private List<Map<String, Object>> loadLines(UUID channelOrderId) {
        List<Map<String, Object>> lines = new ArrayList<>();
        jdbc.query("""
                SELECT item_name, sku, item_price, paid_price
                  FROM channel_order_item
                 WHERE channel_order_id = ?
                 ORDER BY external_order_item_id
                """, rs -> {
            /*
              ⚠ ONE ROW PER MARKETPLACE ITEM, QUANTITY 1. Daraz publishes one order-item row per
              UNIT rather than a quantity column (DZC-045), so collapsing rows into a quantity
              would be an inference. 🔴 The snapshot records what the channel actually sent.
            */
            Map<String, Object> line = new LinkedHashMap<>();
            line.put("name", rs.getString("item_name"));
            line.put("sku", rs.getString("sku"));
            BigDecimal unit = rs.getBigDecimal("paid_price") != null
                    ? rs.getBigDecimal("paid_price")
                    : rs.getBigDecimal("item_price");
            line.put("quantity", 1);
            line.put("unitPrice", unit);
            line.put("lineTotal", unit);
            lines.add(line);
        }, channelOrderId);
        return lines;
    }

    private OrderSnapshot load(UUID channelOrderId) {
        return Optional.ofNullable(jdbc.query("""
                SELECT o.trioloo_invoice_number, o.external_order_id, o.shipping_fee,
                       coalesce(o.shipping_first_name, o.customer_first_name) AS first_name,
                       coalesce(o.shipping_last_name, o.customer_last_name)  AS last_name,
                       o.shipping_phone,
                       concat_ws(', ', nullif(o.shipping_address1, ''), nullif(o.shipping_address3, ''),
                                 nullif(o.shipping_city, ''), nullif(o.shipping_post_code, '')) AS address,
                       (SELECT s.consignment_id FROM shipment s
                         WHERE s.channel_order_id = o.id AND s.consignment_id IS NOT NULL
                         ORDER BY s.created_at DESC LIMIT 1) AS consignment_id
                  FROM channel_order o
                 WHERE o.id = ?
                """, rs -> {
            if (!rs.next()) {
                return null;
            }
            String name = ((rs.getString("first_name") == null ? "" : rs.getString("first_name")) + " "
                    + (rs.getString("last_name") == null ? "" : rs.getString("last_name"))).trim();
            return new OrderSnapshot(
                    rs.getString("trioloo_invoice_number"),
                    rs.getString("external_order_id"),
                    name.isEmpty() ? "Customer not recorded" : name,
                    rs.getString("shipping_phone"),
                    rs.getString("address"),
                    rs.getBigDecimal("shipping_fee"),
                    rs.getString("consignment_id"));
        }, channelOrderId)).orElseThrow(
                () -> new IllegalArgumentException("Order " + channelOrderId + " does not exist."));
    }

    private static UUID actorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AccessUserDetails details) {
            return details.getProfileId();
        }
        // 🔴 AGV-001 - an invoice is a document with legal weight; an unattributable one is refused.
        throw new IllegalStateException(
                "The issuing actor could not be identified, and an invoice must be attributable "
                        + "(AGV-001).");
    }

    private record OrderSnapshot(String invoiceNumber, String externalOrderId, String customerName,
                                 String customerPhone, String customerAddress,
                                 BigDecimal shippingFee, String consignmentId) {
    }

    /**
     * ⚠ {@code taxRatePercent} and {@code taxAmount} are BOTH null where no rate is configured.
     * {@code V22}'s CHECK constraint keeps them stated together — a rate without an amount is a
     * half-stated tax fact.
     */
    public record Issued(UUID id, String invoiceNumber,
                         @MonetaryAmount BigDecimal subtotal,
                         @MonetaryAmount BigDecimal deliveryCharge,
                         BigDecimal taxRatePercent,
                         @MonetaryAmount BigDecimal taxAmount,
                         @MonetaryAmount BigDecimal total) {
    }

    public static class InvoiceAlreadyIssuedException extends RuntimeException {
        public InvoiceAlreadyIssuedException(String message) {
            super(message);
        }
    }
}
