package com.trioloo.erp.order.application;

import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
import com.trioloo.erp.platform.money.MonetaryAmount;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Edit an order before dispatch — {@code OM §7.9}, {@code BR-058}, {@code PRM-096}.
 *
 * <p>✅ BUILT ON THE OWNER'S INSTRUCTION, 2026-10-05: every order can be edited until it is
 * dispatched. {@code BR-082} had stopped changes at {@code COURIER_BOOKED}; the owner moves the
 * boundary to dispatch ({@code BR-011}'s original line).
 *
 * <p>🔴 EVERY CHANGE IS RECORDED, FIELD BY FIELD ({@code BR-058}): before, after, reason, actor and
 * moment, in an append-only table. A reason is required — {@code OM §7.9} says every amendment
 * records one — and an edit that changes nothing is refused rather than recorded as noise.
 *
 * <p>🔴 EDITING IS A MEANINGFUL MANUAL ACTION ({@code BR-169}). An {@code API_MANAGED} order becomes
 * {@code ERP_MANAGED}, with cause, actor and moment ({@code BR-174}); the move is one-way in V1. From
 * then on a marketplace pull no longer overwrites the order's price, contact, address or lines
 * ({@code BR-170}).
 *
 * <p>⚠ A CONSIGNMENT ALREADY BOOKED IS NOT UPDATED. No modification endpoint is known ({@code STF-016}
 * found no cancellation either), so the courier keeps the details it was given and the operator is
 * told in the result.
 *
 * <p>🔴 THE TOTAL IS THE ORDER'S OWN FIGURE AND IS NOT RE-DERIVED FROM THE LINES HERE ({@code INV-31.7}).
 * Money crosses as a string and is compared as a {@link BigDecimal} ({@code TEC-015}).
 *
 * <p>🔴 NO INVENTORY, PAYMENT OR MARKETPLACE EFFECT, and no add/remove of lines: only the lines that
 * exist are edited. {@code BR-148}: a price below any recommendation is not a discount and triggers no
 * approval ({@code BR-092} — no discount limit exists).
 */
@Service
public class OrderAmendmentService {

    /** {@code BR-011} — the states from which a change is still available. */
    private static final Set<String> PRE_DISPATCH = Set.of(
            "PENDING_VERIFICATION", "CONFIRMED", "RELEASED", "IN_FULFILLMENT", "READY_TO_SHIP",
            "COURIER_BOOKED");

    private final JdbcTemplate jdbc;

    public OrderAmendmentService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public Outcome edit(UUID orderId, Edit edit) {
        UUID actor = requireEditAuthority();
        if (edit == null) {
            throw new IllegalArgumentException("Nothing was changed.");
        }
        // Owner decision 2026-10-05 (V33): the note is OPTIONAL. The field, before, after, actor and moment
        // stay mandatory — they are what make an amendment accountable (BR-058).
        String amendmentNote = emptyToNull(edit.reason());
        Current current = load(orderId);
        if (current.effective().contains("CANCELLED") || current.effective().contains("PENDING_CANCELLATION")) {
            throw new IllegalStateException("A cancelled order cannot be edited. Restore it first.");
        }
        if (current.effective().stream().noneMatch(PRE_DISPATCH::contains)) {
            throw new IllegalStateException(
                    "This order is past the point where it can be edited (BR-011). Once goods are with "
                            + "the courier the instrument is a return or an exchange.");
        }

        List<Change> changes = new ArrayList<>();
        List<Object[]> orderSets = new ArrayList<>();

        // ONE full-name box. It is split once, on the first space, as the capture form does.
        if (edit.recipientName() != null) {
            String name = edit.recipientName().trim().replaceAll("\\s+", " ");
            if (!name.equals(nullToEmpty(current.fullName()))) {
                changes.add(new Change("recipient_name", current.fullName(), name));
                int cut = name.indexOf(' ');
                String first = cut < 0 ? name : name.substring(0, cut);
                String last = cut < 0 ? null : name.substring(cut + 1);
                orderSets.add(new Object[] {"shipping_first_name", emptyToNull(first)});
                orderSets.add(new Object[] {"customer_first_name", emptyToNull(first)});
                orderSets.add(new Object[] {"shipping_last_name", emptyToNull(last)});
                orderSets.add(new Object[] {"customer_last_name", emptyToNull(last)});
            }
        }
        text(changes, orderSets, "phone", current.phone(), edit.phone(), "shipping_phone");

        // ONE full-address box: it already includes the city and post code, so on a change they are cleared
        // rather than left behind to print twice.
        boolean addressChanged = false;
        if (edit.address() != null && !edit.address().trim().equals(nullToEmpty(current.address()))) {
            changes.add(new Change("address", current.address(), edit.address().trim()));
            addressChanged = true;
        }
        if (edit.total() != null) {
            if (edit.total().signum() < 0) {
                throw new IllegalArgumentException("A total is never negative.");
            }
            if (current.total() == null || edit.total().compareTo(current.total()) != 0) {
                changes.add(new Change("total", plain(current.total()), plain(edit.total())));
                orderSets.add(new Object[] {"price", edit.total()});
            }
        }

        if (edit.warrantyTerm() != null) {
            String requested = edit.warrantyTerm().trim();
            if (!requested.equals("NONE") && !requested.matches("D7|D15|M1|M3|M6|Y([1-9]|1[0-2])")) {
                throw new IllegalArgumentException("The warranty term must be one of the listed terms (BR-197).");
            }
            String after = requested.equals("NONE") ? null : requested;
            if (!Objects.equals(after, current.warrantyTerm())) {
                changes.add(new Change("warranty_term", current.warrantyTerm(), after));
                orderSets.add(new Object[] {"warranty_term", after});
            }
        }

        // BR-127 / BR-193 — the advance may be corrected; 0 clears it. It can never exceed the total.
        boolean advanceChanged = false;
        BigDecimal newAdvance = current.advance();
        if (edit.advanceReceived() != null) {
            BigDecimal requested = edit.advanceReceived();
            if (requested.signum() < 0) {
                throw new IllegalArgumentException("An advance is never negative.");
            }
            newAdvance = requested.signum() == 0 ? null : requested;
            boolean differs = newAdvance == null
                    ? current.advance() != null
                    : current.advance() == null || newAdvance.compareTo(current.advance()) != 0;
            if (differs) {
                BigDecimal ceiling = edit.total() != null ? edit.total() : current.total();
                if (newAdvance != null && ceiling != null && newAdvance.compareTo(ceiling) > 0) {
                    throw new IllegalArgumentException("The advance cannot be more than the order total.");
                }
                changes.add(new Change("advance_received", plain(current.advance()), plain(newAdvance)));
                advanceChanged = true;
            }
        }

        List<LineUpdate> lineUpdates = new ArrayList<>();
        if (edit.lines() != null) {
            for (LineEdit line : edit.lines()) {
                Line existing = current.lines().stream().filter(l -> l.id().equals(line.id())).findFirst()
                        .orElseThrow(() -> new IllegalArgumentException(
                                "Line " + line.id() + " does not belong to this order."));
                String label = "line[" + existing.externalItemId() + "]";
                String newName = line.name() == null ? existing.name() : line.name().trim();
                if (newName.isEmpty()) {
                    throw new IllegalArgumentException("A line needs a product description.");
                }
                if (!Objects.equals(newName, existing.name())) {
                    changes.add(new Change(label + ".name", existing.name(), newName));
                }
                int newQuantity = line.quantity() == null ? existing.quantity() : line.quantity();
                if (newQuantity < 1) {
                    throw new IllegalArgumentException("A quantity is at least 1.");
                }
                if (newQuantity != existing.quantity()) {
                    changes.add(new Change(label + ".quantity", String.valueOf(existing.quantity()),
                            String.valueOf(newQuantity)));
                }
                BigDecimal newPrice = line.unitPrice() == null ? existing.price() : line.unitPrice();
                if (newPrice != null && newPrice.signum() < 0) {
                    throw new IllegalArgumentException("A price is never negative.");
                }
                boolean priceChanged = newPrice != null
                        && (existing.price() == null || newPrice.compareTo(existing.price()) != 0);
                if (priceChanged) {
                    changes.add(new Change(label + ".price", plain(existing.price()), plain(newPrice)));
                }
                if (!Objects.equals(newName, existing.name()) || newQuantity != existing.quantity() || priceChanged) {
                    lineUpdates.add(new LineUpdate(existing, newName, newQuantity, newPrice, priceChanged));
                }
            }
        }

        if (changes.isEmpty()) {
            if (amendmentNote == null) {
                throw new IllegalArgumentException("Nothing was changed.");
            }
            // A note on its own is recorded (attributed, append-only) but changes no order fact, so it is not
            // a meaningful manual action and does not move authority (BR-169).
            jdbc.update("""
                    INSERT INTO channel_order_amendment
                        (channel_order_id, field, before_value, after_value, reason, amended_by)
                    VALUES (?, 'note', NULL, ?, ?, ?)
                    """, orderId, amendmentNote, amendmentNote, actor);
            return new Outcome(orderId, 1, null);
        }

        // ---- apply ------------------------------------------------------------------
        for (Object[] set : orderSets) {
            jdbc.update("UPDATE channel_order SET " + set[0] + " = ? WHERE id = ?", set[1], orderId);
        }
        if (addressChanged) {
            // The operator supplies the whole address, city and post code included, so the structured parts
            // collapse into it rather than leaving a stale second line behind.
            jdbc.update("""
                    UPDATE channel_order
                       SET shipping_address1 = ?, shipping_address2 = NULL, shipping_address3 = NULL,
                           shipping_address4 = NULL, shipping_address5 = NULL,
                           shipping_city = NULL, shipping_post_code = NULL
                     WHERE id = ?
                    """, edit.address().trim(), orderId);
        }
        if (advanceChanged) {
            // AGV-001 - who recorded the correction and when; a cleared advance clears all three together.
            jdbc.update("""
                    UPDATE channel_order
                       SET advance_received = ?, advance_recorded_at = ?, advance_recorded_by = ?
                     WHERE id = ?
                    """, newAdvance, newAdvance == null ? null : java.sql.Timestamp.from(java.time.Instant.now()),
                    newAdvance == null ? null : actor, orderId);
        }
        for (LineUpdate u : lineUpdates) {
            boolean paidFollowsPrice = u.priceChanged() && Objects.equals(
                    u.existing().paid() == null ? null : u.existing().paid().stripTrailingZeros(),
                    u.existing().price() == null ? null : u.existing().price().stripTrailingZeros());
            jdbc.update("""
                    UPDATE channel_order_item
                       SET item_name = ?, quantity = ?, item_price = ?,
                           paid_price = CASE WHEN ? THEN ? ELSE paid_price END,
                           version = version + 1
                     WHERE id = ?
                    """, u.name(), u.quantity(), u.price(), paidFollowsPrice, u.price(), u.existing().id());
        }
        // BR-169 / BR-174 — a meaningful manual action: authority moves to Trioloo, attributed.
        jdbc.update("""
                UPDATE channel_order
                   SET ownership = 'ERP_MANAGED',
                       authority_cause = CASE WHEN ownership = 'API_MANAGED'
                                              THEN 'EDITED_BY_TRIOLOO' ELSE authority_cause END,
                       authority_changed_at = CASE WHEN ownership = 'API_MANAGED'
                                                   THEN now() ELSE authority_changed_at END,
                       authority_changed_by = CASE WHEN ownership = 'API_MANAGED'
                                                   THEN ? ELSE authority_changed_by END,
                       version = version + 1
                 WHERE id = ?
                """, actor, orderId);
        for (Change c : changes) {
            jdbc.update("""
                    INSERT INTO channel_order_amendment
                        (channel_order_id, field, before_value, after_value, reason, amended_by)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, orderId, c.field(), c.before(), c.after(), amendmentNote, actor);
        }

        String note = null;
        if (current.liveShipment()) {
            note = "This order is already booked with Steadfast. The courier keeps the details it was "
                    + "given: update the consignment in the Steadfast panel too.";
        } else if (current.apiManaged()) {
            note = "Trioloo now controls this order and marketplace updates will not overwrite it (BR-170).";
        }
        return new Outcome(orderId, changes.size(), note);
    }

    private void text(List<Change> changes, List<Object[]> sets, String field, String before, String after,
                      String... columns) {
        if (after == null) {
            return;
        }
        String trimmed = after.trim();
        if (trimmed.equals(nullToEmpty(before))) {
            return;
        }
        changes.add(new Change(field, before, trimmed));
        for (String column : columns) {
            sets.add(new Object[] {column, emptyToNull(trimmed)});
        }
    }

    private Current load(UUID orderId) {
        List<Current> found = jdbc.query("""
                SELECT o.ownership, o.price, o.advance_received,
                       channel_order_effective_statuses(o.id)::text AS effective,
                       nullif(btrim(concat_ws(' ', coalesce(o.shipping_first_name, o.customer_first_name),
                                              coalesce(o.shipping_last_name, o.customer_last_name))), '') AS full_name,
                       o.shipping_phone, o.warranty_term,
                       nullif(concat_ws(', ', nullif(o.shipping_address1, ''), nullif(o.shipping_address2, ''),
                                       nullif(o.shipping_address3, ''), nullif(o.shipping_address4, ''),
                                       nullif(o.shipping_address5, ''), nullif(o.shipping_city, ''),
                                       nullif(o.shipping_post_code, '')), '') AS address,
                       EXISTS (SELECT 1 FROM shipment s WHERE s.channel_order_id = o.id
                                  AND s.consignment_id IS NOT NULL
                                  AND s.state NOT IN ('DELIVERED', 'RETURNED_TO_WAREHOUSE', 'LOST',
                                                      'DAMAGED', 'CANCELLED')) AS live_shipment
                  FROM channel_order o WHERE o.id = ?
                """, (rs, n) -> new Current(
                        "API_MANAGED".equals(rs.getString("ownership")), rs.getBigDecimal("price"),
                        rs.getBigDecimal("advance_received"), parse(rs.getString("effective")),
                        rs.getString("full_name"), rs.getString("shipping_phone"), rs.getString("address"),
                        rs.getBoolean("live_shipment"), new ArrayList<>(), rs.getString("warranty_term")), orderId);
        Current current = found.stream().findFirst().orElseThrow(
                () -> new IllegalArgumentException("Order " + orderId + " does not exist."));
        current.lines().addAll(jdbc.query("""
                SELECT id, external_order_item_id, item_name, quantity, item_price, paid_price
                  FROM channel_order_item WHERE channel_order_id = ?
                """, (rs, n) -> new Line((UUID) rs.getObject("id"), rs.getString("external_order_item_id"),
                        rs.getString("item_name"), rs.getInt("quantity"), rs.getBigDecimal("item_price"),
                        rs.getBigDecimal("paid_price")), orderId));
        return current;
    }

    private static List<String> parse(String json) {
        if (json == null) {
            return List.of();
        }
        return Arrays.stream(json.replaceAll("[\\[\\]\"\\s]", "").split(","))
                .filter(s -> !s.isEmpty()).toList();
    }

    private static String plain(BigDecimal value) {
        return value == null ? null : value.toPlainString();
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private static String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /** 🔴 {@code PRM-004} — the gate is here, in the application service. */
    private UUID requireEditAuthority() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean permitted = auth != null && auth.getAuthorities().stream()
                .anyMatch(g -> OrderPermissions.ORDER_EDIT.equals(g.getAuthority()));
        if (!permitted) {
            throw new AccessDeniedByPermissionException(OrderPermissions.ORDER_EDIT);
        }
        if (!(auth.getPrincipal() instanceof AccessUserDetails details)) {
            throw new IllegalStateException("The acting user could not be identified (AGV-001).");
        }
        return details.getProfileId();
    }

    private record Current(boolean apiManaged, BigDecimal total, BigDecimal advance, List<String> effective,
                           String fullName, String phone, String address,
                           boolean liveShipment, List<Line> lines, String warrantyTerm) {
    }

    private record Line(UUID id, String externalItemId, String name, int quantity, BigDecimal price,
                        BigDecimal paid) {
    }

    private record LineUpdate(Line existing, String name, int quantity, BigDecimal price, boolean priceChanged) {
    }

    private record Change(String field, String before, String after) {
    }

    /**
     * Only the fields that are present are considered. {@code lines} edits existing lines only; adding
     * or removing a line is not part of this slice.
     */
    public record Edit(String reason, String recipientName, String phone, String address,
                       @MonetaryAmount BigDecimal total,
                       /** BR-127 — {@code null} = leave as is; {@code 0} = clear; otherwise the new advance. */
                       @MonetaryAmount BigDecimal advanceReceived,
                       List<LineEdit> lines,
                       /** BR-197 — {@code null} = leave as is; {@code NONE} = clear; otherwise D7 .. Y12. */
                       String warrantyTerm) {

        /** Callers that predate the warranty term. */
        public Edit(String reason, String recipientName, String phone, String address, BigDecimal total,
                    BigDecimal advanceReceived, List<LineEdit> lines) {
            this(reason, recipientName, phone, address, total, advanceReceived, lines, null);
        }
    }

    /** A line's description, quantity and unit price. {@code null} = leave as is. No SKU: the owner removed it. */
    public record LineEdit(UUID id, String name, Integer quantity, @MonetaryAmount BigDecimal unitPrice) {
    }

    /** @param note what the operator must still do outside Trioloo, or {@code null}. */
    public record Outcome(UUID orderId, int fieldsChanged, String note) {
    }
}
