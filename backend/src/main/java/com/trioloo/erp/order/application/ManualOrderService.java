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

    /** The owner's three order types (V32). A recorded attribute; nothing branches on it (BR-001). */
    static final java.util.Set<String> ORDER_TYPES = java.util.Set.of("WALK_IN", "MARKETPLACE", "WEBSITE");

    private final JdbcTemplate jdbc;

    public ManualOrderService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public Created create(NewOrder request) {
        UUID actor = requireCreateAuthority();
        validate(request);
        if (request.soldBy() != null) {
            Integer active = jdbc.queryForObject(
                    "SELECT count(*) FROM operational_user_profile WHERE id = ? AND lifecycle_state = 'ACTIVE'",
                    Integer.class, request.soldBy());
            if (active == null || active == 0) {
                throw new IllegalArgumentException("Sold by must be an active user.");
            }
        }

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

        // A zero or blank advance is NO advance: the column holds NULL, never a stand-in zero (SYS-034).
        BigDecimal advance = request.advanceReceived() != null && request.advanceReceived().signum() > 0
                ? request.advanceReceived() : null;

        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_order (
                    id, channel_instance_id, external_order_id, order_number,
                    trioloo_invoice_number, ownership, statuses_json, canonical_statuses_json,
                    price, customer_first_name, customer_last_name, shipping_first_name,
                    shipping_last_name, shipping_phone, shipping_address1, shipping_city,
                    payment_method, buyer_note, items_count, order_tag,
                    advance_received, advance_recorded_at, advance_recorded_by, sold_by, warranty_term,
                    provider_created_at, imported_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, 'ERP_MANAGED', CAST(? AS jsonb), CAST(? AS jsonb),
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now(), now(), now())
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
                request.total(), nullIfBlank(request.customerFirstName()), nullIfBlank(request.customerLastName()),
                nullIfBlank(request.customerFirstName()), nullIfBlank(request.customerLastName()),
                nullIfBlank(request.customerPhone()), nullIfBlank(request.shippingAddress()),
                nullIfBlank(request.shippingCity()),
                request.paymentMethod(), request.note(), request.lines().size(),
                request.effectiveOrderType(),
                // BR-127 / AGV-001 - recorded only when money was actually received, with who and when.
                advance, advance == null ? null : java.sql.Timestamp.from(java.time.Instant.now()),
                advance == null ? null : actor,
                request.soldBy(), request.warrantyTerm());

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
        // A walk-in customer is present at the counter and may give no name: the name is then ABSENT
        // rather than invented (SYS-034). Every other order still needs one.
        if (!request.isWalkIn() && blank(request.customerFirstName()) && blank(request.customerLastName())) {
            throw new IllegalArgumentException("A customer name is required.");
        }
        if (request.orderType() != null && !ORDER_TYPES.contains(request.orderType())) {
            throw new IllegalArgumentException("The customer type must be Walk-in, Marketplace or Website.");
        }
        if (request.warrantyTerm() != null && !request.warrantyTerm().matches("D7|D15|M1|M3|M6|Y([1-9]|1[0-2])")) {
            throw new IllegalArgumentException("The warranty term must be one of the listed terms (BR-197).");
        }
        if (request.advanceReceived() != null) {
            if (request.advanceReceived().signum() < 0) {
                throw new IllegalArgumentException("An advance is never negative.");
            }
            // BR-127 - an advance cannot exceed what the customer owes on the order.
            if (request.total() != null && request.advanceReceived().compareTo(request.total()) > 0) {
                throw new IllegalArgumentException("The advance cannot be more than the order total.");
            }
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

    /** SYS-034 — a value nobody gave is ABSENT, never an empty string that reads as one. */
    private static String nullIfBlank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    /** 🔴 {@code PRM-004} — the gate is in the application service, never a controller annotation. */
    private UUID requireCreateAuthority() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = auth != null && auth.getAuthorities().stream()
                .anyMatch(g -> OrderPermissions.ORDER_CREATE.equals(g.getAuthority()));
        if (!permitted) {
            throw new AccessDeniedByPermissionException(OrderPermissions.ORDER_CREATE);
        }
        if (auth == null || !(auth.getPrincipal() instanceof AccessUserDetails details)) {
            throw new IllegalStateException(
                    "The creating actor could not be identified (AGV-001).");
        }
        return details.getProfileId();
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
                           List<NewOrderLine> lines, Boolean walkIn,
                           /** BR-127 — money received before delivery; {@code null} or zero = none. */
                           @MonetaryAmount BigDecimal advanceReceived,
                           /** V32 — WALK_IN, MARKETPLACE or WEBSITE; {@code null} = not chosen. */
                           String orderType,
                           /** V32 — the user the sale is attributed to; {@code null} = not recorded. */
                           UUID soldBy,
                           /** V36 / BR-197 — D7, D15, M1, M3, M6 or Y1..Y12; {@code null} = none chosen. */
                           String warrantyTerm) {

        /** Every existing caller: an order that is not tagged walk-in. */
        public NewOrder(UUID channelInstanceId, String customerFirstName, String customerLastName,
                        String customerPhone, String shippingAddress, String shippingCity,
                        String paymentMethod, String note, BigDecimal total, List<NewOrderLine> lines) {
            this(channelInstanceId, customerFirstName, customerLastName, customerPhone, shippingAddress,
                    shippingCity, paymentMethod, note, total, lines, Boolean.FALSE, null, null, null, null);
        }

        public NewOrder(UUID channelInstanceId, String customerFirstName, String customerLastName,
                        String customerPhone, String shippingAddress, String shippingCity,
                        String paymentMethod, String note, BigDecimal total, List<NewOrderLine> lines,
                        Boolean walkIn) {
            this(channelInstanceId, customerFirstName, customerLastName, customerPhone, shippingAddress,
                    shippingCity, paymentMethod, note, total, lines, walkIn, null, null, null, null);
        }

        public NewOrder(UUID channelInstanceId, String customerFirstName, String customerLastName,
                        String customerPhone, String shippingAddress, String shippingCity,
                        String paymentMethod, String note, BigDecimal total, List<NewOrderLine> lines,
                        Boolean walkIn, BigDecimal advanceReceived) {
            this(channelInstanceId, customerFirstName, customerLastName, customerPhone, shippingAddress,
                    shippingCity, paymentMethod, note, total, lines, walkIn, advanceReceived, null, null, null);
        }

        /** Callers that predate {@code V36}: no warranty term. */
        public NewOrder(UUID channelInstanceId, String customerFirstName, String customerLastName,
                        String customerPhone, String shippingAddress, String shippingCity,
                        String paymentMethod, String note, BigDecimal total, List<NewOrderLine> lines,
                        Boolean walkIn, BigDecimal advanceReceived, String orderType, UUID soldBy) {
            this(channelInstanceId, customerFirstName, customerLastName, customerPhone, shippingAddress,
                    shippingCity, paymentMethod, note, total, lines, walkIn, advanceReceived, orderType, soldBy, null);
        }

        /** {@code V30} — created from the quick item line and a total price, customer present. */
        public boolean isWalkIn() {
            return Boolean.TRUE.equals(walkIn) || "WALK_IN".equals(orderType);
        }

        /** The chosen type wins; otherwise the quick order is a walk-in; otherwise no type. */
        public String effectiveOrderType() {
            return orderType != null ? orderType : Boolean.TRUE.equals(walkIn) ? "WALK_IN" : null;
        }
    }

    public record NewOrderLine(int lineNumber, String name, String sku,
                               @MonetaryAmount BigDecimal unitPrice) {
    }

    public record Created(UUID id, String invoiceNumber, String canonicalStatus) {
    }
}
