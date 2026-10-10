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
        // 🔴 PRM-004 — the gate is in the application service, never a controller annotation.
        UUID actor = requireAuthority(AccountingPermissions.SALES_INVOICE_ISSUE);
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
        /*
          The DISCOUNT is the seller voucher the channel reported, less whatever the line prices already carry.
          A marketplace that reports a net price per line (Daraz's paid price) has already taken its voucher off the
          lines, so taking it off again would charge the customer's saving twice; a channel that reports the unit
          prices as the customer saw them (the Zeon Tech website) has not. Either way the lines are never altered.
        */
        BigDecimal discount = order.voucherSeller() == null ? BigDecimal.ZERO
                : order.voucherSeller().subtract(alreadyInLines(channelOrderId)).max(BigDecimal.ZERO);
        boolean discounted = discount.signum() > 0;
        BigDecimal taxable = subtotal.subtract(discount).add(deliveryCharge == null ? BigDecimal.ZERO : deliveryCharge);

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
        // BR-127 / INV-39.2 - the advance and the balance are DOCUMENT figures, fixed at issue.
        BigDecimal advance = order.advanceReceived();
        BigDecimal balanceDue = advance == null ? null : total.subtract(advance);

        Instant now = Instant.now(clock);
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("""
                    INSERT INTO sales_invoice (
                        id, channel_order_id, invoice_number, issued_at, issued_by,
                        customer_name, customer_phone, customer_address,
                        external_order_reference, consignment_reference,
                        subtotal, delivery_charge, tax_rate_percent, tax_amount, total,
                        advance_received, balance_due, lines_json, discount, discount_code)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)
                    """,
                    id, channelOrderId, order.invoiceNumber(), Timestamp.from(now), actor,
                    order.customerName(), order.customerPhone(), order.customerAddress(),
                    order.externalOrderId(), order.consignmentId(),
                    subtotal, deliveryCharge, taxRatePercent, taxAmount, total,
                    advance, balanceDue, json.writeValueAsString(lines),
                    discounted ? discount : null, discounted ? order.voucherCode() : null);
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

        return new Issued(id, order.invoiceNumber(), subtotal, discounted ? discount : null, deliveryCharge,
                taxRatePercent, taxAmount, total);
    }

    /**
     * Reads an issued invoice for rendering — {@code PRN-022}.
     *
     * <p>🔴 IT RETURNS THE SNAPSHOT AND RE-DERIVES NOTHING. {@code PRN-022} — every printable has
     * exactly one deterministic authoritative source, and the RENDERING NEVER BECOMES THAT SOURCE.
     * ⚠ A renderer that recomputed a total, re-read an address or re-applied the current tax rate
     * would silently restate a document a customer already holds.
     */
    public Optional<Rendered> forRendering(UUID channelOrderId) {
        requireAuthority(AccountingPermissions.SALES_INVOICE_VIEW);
        return Optional.ofNullable(jdbc.query("""
                SELECT i.invoice_number, i.issued_at, i.customer_name, i.customer_phone, i.customer_address,
                       i.external_order_reference,
                       /*
                         Owner, 2026-10-05: the Parcel ID is the Steadfast booking, which usually happens AFTER the invoice
                         was issued - so, like the advance, it is read from the order's CURRENT shipment and falls back to the
                         value stored at issue. Every other figure stays the issued snapshot (INV-39.2).
                       */
                       coalesce((SELECT s.consignment_id FROM shipment s
                                  WHERE s.channel_order_id = i.channel_order_id AND s.consignment_id IS NOT NULL
                                    AND s.state <> 'CANCELLED'
                                  ORDER BY s.created_at DESC LIMIT 1), i.consignment_reference) AS consignment_reference,
                       i.subtotal, i.discount, i.discount_code, i.delivery_charge,
                       i.tax_rate_percent, i.tax_amount, i.total,
                       o.advance_received, o.warranty_term, o.buyer_note, i.lines_json::text AS lines
                  FROM sales_invoice i JOIN channel_order o ON o.id = i.channel_order_id
                 WHERE i.channel_order_id = ?
                """, rs -> {
            if (!rs.next()) {
                return null;
            }
            /*
              Owner instruction 2026-10-05: the printed invoice shows the advance received NOW recorded on the
              order and the balance still due. The advance is a payment fact the order may correct (BR-193), not
              commercial content, so it is read live; every other figure stays the issued snapshot (INV-39.2).
            */
            BigDecimal liveAdvance = rs.getBigDecimal("advance_received");
            BigDecimal total = rs.getBigDecimal("total");
            boolean hasAdvance = liveAdvance != null && liveAdvance.signum() > 0;
            return new Rendered(
                    rs.getString("invoice_number"),
                    rs.getTimestamp("issued_at").toInstant(),
                    rs.getString("customer_name"), rs.getString("customer_phone"),
                    rs.getString("customer_address"),
                    rs.getString("external_order_reference"), rs.getString("consignment_reference"),
                    rs.getBigDecimal("subtotal"), rs.getBigDecimal("discount"), rs.getString("discount_code"),
                    rs.getBigDecimal("delivery_charge"),
                    rs.getBigDecimal("tax_rate_percent"), rs.getBigDecimal("tax_amount"),
                    total,
                    hasAdvance ? liveAdvance : null, hasAdvance ? total.subtract(liveAdvance) : null,
                    readLines(rs.getString("lines")), rs.getString("warranty_term"),
                    rs.getString("buyer_note"));
        }, channelOrderId));
    }

    private List<Line> readLines(String linesJson) {
        List<Line> out = new ArrayList<>();
        for (tools.jackson.databind.JsonNode node : json.readTree(linesJson == null ? "[]" : linesJson)) {
            out.add(new Line(
                    node.path("name").isNull() ? null : node.path("name").asString(),
                    node.path("sku").isNull() ? null : node.path("sku").asString(),
                    node.path("quantity").asInt(),
                    node.path("unitPrice").isNull() ? null : new BigDecimal(node.path("unitPrice").asString()),
                    node.path("lineTotal").isNull() ? null : new BigDecimal(node.path("lineTotal").asString())));
        }
        return List.copyOf(out);
    }

    /**
     * ⚠ EVERY FIGURE HERE IS A STORED COLUMN, NOT A CALCULATION. That is what makes the document
     * reproducible years later ({@code INV-39.2}).
     */
    public record Rendered(String invoiceNumber, Instant issuedAt, String customerName,
                           String customerPhone, String customerAddress,
                           String externalOrderReference, String consignmentReference,
                           @MonetaryAmount BigDecimal subtotal,
                           /** INV-39.2 - the seller voucher taken off the subtotal, fixed at issue; {@code null} = none. */
                           @MonetaryAmount BigDecimal discount,
                           /** The voucher code behind {@code discount}, or {@code null}. */
                           String discountCode,
                           @MonetaryAmount BigDecimal deliveryCharge,
                           // A RATE, not money - but it crosses as TEXT all the same: the page trims it as a
                           // string, and a JSON number here crashed the invoice page (blank screen).
                           @com.fasterxml.jackson.annotation.JsonFormat(shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
                           BigDecimal taxRatePercent,
                           @MonetaryAmount BigDecimal taxAmount,
                           @MonetaryAmount BigDecimal total,
                           /** BR-127 — money received before delivery, or {@code null} where none was recorded. */
                           @MonetaryAmount BigDecimal advanceReceived,
                           /** INV-39.2 — total less the advance, fixed at issue; {@code null} = same as the total. */
                           @MonetaryAmount BigDecimal balanceDue,
                           List<Line> lines,
                           /** BR-197 — the order's warranty term code (D7 .. Y12), or {@code null}. */
                           String warrantyTerm,
                           /** The note typed on the order (read live), or {@code null}; the invoice prints nothing else under Note. */
                           String note) {
    }

    public record Line(String name, String sku, int quantity,
                       @MonetaryAmount BigDecimal unitPrice,
                       @MonetaryAmount BigDecimal lineTotal) {
    }

    /* ------------------------------------------------------------------ internals */

    private UUID requireAuthority(String code) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = auth != null && auth.getAuthorities().stream()
                .anyMatch(g -> code.equals(g.getAuthority()));
        if (!permitted) {
            throw new com.trioloo.erp.product.application.AccessDeniedByPermissionException(code);
        }
        return actorId();
    }


    private List<Map<String, Object>> loadLines(UUID channelOrderId) {
        List<Map<String, Object>> lines = new ArrayList<>();
        jdbc.query("""
                SELECT item_name, sku, item_price, paid_price, quantity
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
            int quantity = rs.getInt("quantity");
            line.put("quantity", quantity);
            line.put("unitPrice", unit);
            // BR-145 - the unit price is the snapshot; the line value is unit price x quantity (exact).
            line.put("lineTotal", unit == null ? null : unit.multiply(BigDecimal.valueOf(quantity)));
            lines.add(line);
        }, channelOrderId);
        return lines;
    }

    /** What the lines already take off for a voucher: (item price - paid price) x quantity where a paid price is reported. */
    private BigDecimal alreadyInLines(UUID channelOrderId) {
        BigDecimal reflected = jdbc.queryForObject("""
                SELECT coalesce(sum(greatest(item_price - paid_price, 0) * quantity), 0)
                  FROM channel_order_item
                 WHERE channel_order_id = ? AND paid_price IS NOT NULL AND item_price IS NOT NULL
                """, BigDecimal.class, channelOrderId);
        return reflected == null ? BigDecimal.ZERO : reflected;
    }

    private OrderSnapshot load(UUID channelOrderId) {
        return Optional.ofNullable(jdbc.query("""
                SELECT o.trioloo_invoice_number, o.external_order_id, o.shipping_fee, o.advance_received,
                       o.voucher_seller, o.voucher_code,
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
                    rs.getString("consignment_id"), rs.getBigDecimal("advance_received"),
                    rs.getBigDecimal("voucher_seller"), rs.getString("voucher_code"));
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
                                 BigDecimal shippingFee, String consignmentId, BigDecimal advanceReceived,
                                 BigDecimal voucherSeller, String voucherCode) {
    }

    /**
     * ⚠ {@code taxRatePercent} and {@code taxAmount} are BOTH null where no rate is configured.
     * {@code V22}'s CHECK constraint keeps them stated together — a rate without an amount is a
     * half-stated tax fact.
     */
    public record Issued(UUID id, String invoiceNumber,
                         @MonetaryAmount BigDecimal subtotal,
                         @MonetaryAmount BigDecimal discount,
                         @MonetaryAmount BigDecimal deliveryCharge,
                         @com.fasterxml.jackson.annotation.JsonFormat(shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
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
