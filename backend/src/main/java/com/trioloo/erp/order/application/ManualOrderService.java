package com.trioloo.erp.order.application;

import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
import com.trioloo.erp.order.domain.CanonicalOrderStatus;
import com.trioloo.erp.platform.money.MonetaryAmount;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Manual order capture — {@code OM §22}, {@code PRM-093}, {@code BR-168}.
 *
 * <p>✅ THE ORDER STARTS AT {@code PENDING_VERIFICATION} — the product owner's decision,
 * 2026-08-24 — which is also the state a channel order arrives in ({@code OM §7.4},
 * {@code §7.8}). ⚠ A manual order and an imported one therefore enter the SAME verification queue,
 * and no state is skipped because a person typed it.
 *
 * <p>🔴 CREATION IS NOT CONFIRMATION ({@code PRM-093.b}). This ends at
 * {@code PENDING_VERIFICATION} and stops. Nothing here writes {@code Confirmed By} or
 * {@code Confirmed At} — {@code BR-176} forbids sync doing it and a creation path has no better
 * claim.
 *
 * <p>🔴 A MANUAL ORDER IS {@code ERP_MANAGED} FROM CREATION ({@code BR-168}). There is no
 * marketplace to hold authority over it and no takeover occurs ({@code BR-169}).
 *
 * <p>⚠ IT IS STILL A CHANNEL ORDER, AND THAT IS NOT A COMPROMISE. {@code channel_instance} already
 * ratifies {@code PHONE}, {@code WALKIN} and {@code WEBSITE} alongside {@code DARAZ}, and
 * {@code OM §3.5} calls these the DIRECT channels. ✅ So a manual order is a direct-channel order,
 * not a different entity, and {@code BR-002}'s instance attribution still holds.
 *
 * <p>🔴 IT CREATES NO INVENTORY EFFECT ({@code PRM-093.e}). {@code BR-096}/{@code BR-004} keep
 * reservation and movement elsewhere, and {@code GAP-016}'s finding stands: stock shortage never
 * blocks, holds or cancels an Order — shortage is a condition of the STOCK, not of the ORDER.
 */
@Service
public class ManualOrderService {

    private final JdbcTemplate jdbc;

    public ManualOrderService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public Created create(NewOrder request) {
        requireCreateAuthority();
        validate(request);

        /*
          🔴 THE NUMBER IS TAKEN BEFORE THE INSERT, UNLIKE THE IMPORT PATH, AND THE REASON IS THE
          OPPOSITE OF THAT PATH'S. Import assigns the number AFTER the upsert so a re-poll of an
          existing order consumes nothing (ChannelOrderImportService.issueInvoiceNumber). A manual
          order is a single deliberate act that cannot collide with itself, and it needs the number
          up front because `external_order_id` is NOT NULL and a direct order has no external one.
        */
        String invoiceNumber = jdbc.queryForObject(
                "SELECT 'TR' || lpad(nextval('trioloo_invoice_number_seq')::text, 4, '0')",
                String.class);

        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_order (
                    id, channel_instance_id, external_order_id, order_number,
                    trioloo_invoice_number, ownership, statuses_json, canonical_statuses_json,
                    price, customer_first_name, customer_last_name, shipping_first_name,
                    shipping_last_name, shipping_phone, shipping_address1, shipping_city,
                    payment_method, buyer_note, items_count,
                    provider_created_at, imported_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, 'ERP_MANAGED', CAST(? AS jsonb), CAST(? AS jsonb),
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now(), now(), now())
                """,
                id, request.channelInstanceId(),
                /*
                  ⚠ THE TRIOLOO NUMBER STANDS IN FOR THE EXTERNAL REFERENCE, AND `DB-013` IS WHY
                  THAT IS HONEST RATHER THAN A FUDGE. An external identifier is meaningful only
                  alongside its issuing party — and on a DIRECT channel the issuing party IS
                  Trioloo. There is no other system's number to record, so recording our own under
                  our own name states the truth.
                */
                invoiceNumber, invoiceNumber, invoiceNumber,
                // 🔴 The marketplace status array is EMPTY, not a fabricated word. No marketplace
                // said anything about this order (BR-171, SYS-034).
                "[]",
                canonicalJson(CanonicalOrderStatus.PENDING_VERIFICATION),
                request.total(), request.customerFirstName(), request.customerLastName(),
                request.customerFirstName(), request.customerLastName(),
                request.customerPhone(), request.shippingAddress(), request.shippingCity(),
                request.paymentMethod(), request.note(), request.lines().size());

        for (NewOrderLine line : request.lines()) {
            jdbc.update("""
                    INSERT INTO channel_order_item (
                        id, channel_order_id, external_order_item_id, external_order_id,
                        item_name, sku, item_price, paid_price, imported_at, last_seen_at)
                    VALUES (gen_random_uuid(), ?, ?, ?, ?, ?, ?, ?, now(), now())
                    """, id, invoiceNumber + "-" + line.lineNumber(), invoiceNumber,
                    line.name(), line.sku(),
                    /*
                      ✅ BR-145 — the actual selling price is captured at ORDER LINE CREATION and
                      preserved. PRD-139 — on a manual order staff determine it. 🔴 BR-148
                      forecloses the dangerous reading: a manual price below the Ideal /
                      Recommended Selling Price is NOT a discount, and no approval path exists.
                    */
                    line.unitPrice(), line.unitPrice());
        }

        return new Created(id, invoiceNumber, CanonicalOrderStatus.PENDING_VERIFICATION.name());
    }

    /* ------------------------------------------------------------------ internals */

    private static void validate(NewOrder request) {
        if (request.channelInstanceId() == null) {
            // 🔴 BR-002 — channel type alone is never sufficient attribution; the INSTANCE is named.
            throw new IllegalArgumentException("A shop must be chosen for the order (BR-002).");
        }
        if (blank(request.customerFirstName()) && blank(request.customerLastName())) {
            throw new IllegalArgumentException("A customer name is required.");
        }
        if (request.lines() == null || request.lines().isEmpty()) {
            throw new IllegalArgumentException("An order needs at least one line.");
        }
        for (NewOrderLine line : request.lines()) {
            if (blank(line.name())) {
                throw new IllegalArgumentException("Every line needs a product description.");
            }
            if (line.unitPrice() == null || line.unitPrice().signum() < 0) {
                /*
                  ⚠ ZERO IS PERMITTED AND NEGATIVE IS NOT. OM §4.5 makes a non-catalogued line's
                  cost unknown and a free item is a real business case; a negative price is not a
                  price, and no discount mechanism exists here (BR-148).
                */
                throw new IllegalArgumentException(
                        "Every line needs a price, and a price is never negative.");
            }
        }
    }

    private static String canonicalJson(CanonicalOrderStatus status) {
        return "[\"" + status.name() + "\"]";
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    /** 🔴 {@code PRM-004} — the gate is in the application service, never a controller annotation. */
    private void requireCreateAuthority() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = auth != null && auth.getAuthorities().stream()
                .anyMatch(g -> OrderPermissions.ORDER_CREATE.equals(g.getAuthority()));
        if (!permitted) {
            throw new AccessDeniedByPermissionException(OrderPermissions.ORDER_CREATE);
        }
        if (auth == null || !(auth.getPrincipal() instanceof AccessUserDetails)) {
            throw new IllegalStateException(
                    "The creating actor could not be identified (AGV-001).");
        }
    }

    /**
     * ⚠ {@code total} IS THE ORDER'S OWN FIGURE AND IS NOT RE-DERIVED FROM THE LINES HERE.
     * `INV-31.7` snapshots what was agreed; a service that recomputed it would silently correct a
     * figure a person deliberately entered.
     */
    public record NewOrder(UUID channelInstanceId, String customerFirstName, String customerLastName,
                           String customerPhone, String shippingAddress, String shippingCity,
                           String paymentMethod, String note,
                           @MonetaryAmount BigDecimal total,
                           List<NewOrderLine> lines) {
    }

    public record NewOrderLine(int lineNumber, String name, String sku,
                               @MonetaryAmount BigDecimal unitPrice) {
    }

    public record Created(UUID id, String invoiceNumber, String canonicalStatus) {
    }
}
