package com.trioloo.erp.order.application;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Edit an order before dispatch — {@code PRM-096}, {@code OM §7.9}, {@code BR-058}, {@code BR-169}.
 */
@SpringBootTest
@DisplayName("Edit an order")
class OrderAmendmentServiceTest {

    @Autowired
    private OrderAmendmentService amendments;
    @Autowired
    private JdbcTemplate jdbc;

    private UUID shopId;
    private UUID actorId;

    @BeforeEach
    void setUp() {
        clean();
        actorId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO operational_user_profile (id, username, full_name, lifecycle_state, created_at, activated_at)
                VALUES (?, ?, ?, 'ACTIVE', now(), now())
                """, actorId, "amend-tester-" + actorId, "Amend Tester");
        shopId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type, record_status, market)
                VALUES (?, ?, ?, 'DARAZ', 'ACTIVE', 'BANGLADESH')
                """, shopId, "AMEND-SHOP-" + shopId, "Amend Shop");
        actingWith(OrderPermissions.ORDER_EDIT);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clean();
    }

    @Test
    @DisplayName("changes the name, phone, one address, total and a line; records each change; takes authority")
    void editsAndRecords() {
        UUID id = order("[\"PENDING_VERIFICATION\"]");
        UUID line = lineId(id);

        OrderAmendmentService.Outcome outcome = amendments.edit(id, new OrderAmendmentService.Edit(
                "Customer corrected the address by phone", "Karim Ahmed Uddin", "01911111111",
                "House 9, Road 3, Banani, Gazipur 1213", new BigDecimal("1900.50"), null,
                List.of(new OrderAmendmentService.LineEdit(line, "Corrected product", 2,
                        new BigDecimal("950.25")))));

        assertThat(outcome.fieldsChanged()).isGreaterThanOrEqualTo(6);
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT shipping_first_name, customer_first_name, shipping_last_name, customer_last_name,
                       shipping_phone, shipping_address1, shipping_address3, shipping_city,
                       shipping_post_code, price, ownership, authority_cause, authority_changed_by
                  FROM channel_order WHERE id = ?
                """, id);
        // ONE full-name box, split once on the first space.
        assertThat(row.get("shipping_first_name")).isEqualTo("Karim");
        assertThat(row.get("customer_first_name")).isEqualTo("Karim");
        assertThat(row.get("shipping_last_name")).isEqualTo("Ahmed Uddin");
        assertThat(row.get("customer_last_name")).isEqualTo("Ahmed Uddin");
        assertThat(row.get("shipping_phone")).isEqualTo("01911111111");
        // ONE full-address box: the city and post code are inside it, so the structured parts are cleared.
        assertThat(row.get("shipping_address1")).isEqualTo("House 9, Road 3, Banani, Gazipur 1213");
        assertThat(row.get("shipping_address3")).isNull();
        assertThat(row.get("shipping_city")).isNull();
        assertThat(row.get("shipping_post_code")).isNull();
        assertThat((BigDecimal) row.get("price")).isEqualByComparingTo("1900.50");
        // BR-169 / BR-174 - a meaningful manual action.
        assertThat(row.get("ownership")).isEqualTo("ERP_MANAGED");
        assertThat(row.get("authority_cause")).isEqualTo("EDITED_BY_TRIOLOO");
        assertThat(row.get("authority_changed_by")).isEqualTo(actorId);

        Map<String, Object> item = jdbc.queryForMap(
                "SELECT item_name, quantity, item_price, paid_price FROM channel_order_item WHERE id = ?", line);
        assertThat(item.get("item_name")).isEqualTo("Corrected product");
        assertThat(item.get("quantity")).isEqualTo(2);
        assertThat((BigDecimal) item.get("item_price")).isEqualByComparingTo("950.25");
        // paid_price followed the price because it equalled it before.
        assertThat((BigDecimal) item.get("paid_price")).isEqualByComparingTo("950.25");

        // BR-058 - before, after, actor and moment, field by field.
        List<Map<String, Object>> log = jdbc.queryForList(
                "SELECT field, before_value, after_value, reason, amended_by FROM channel_order_amendment "
                        + "WHERE channel_order_id = ? ORDER BY field", id);
        assertThat(log).extracting(m -> m.get("field")).contains("phone", "address", "total", "recipient_name");
        assertThat(log).extracting(m -> m.get("field")).anyMatch(f -> f.toString().endsWith(".quantity"));
        Map<String, Object> phone = log.stream().filter(m -> "phone".equals(m.get("field"))).findFirst().orElseThrow();
        assertThat(phone.get("before_value")).isEqualTo("01700000000");
        assertThat(phone.get("after_value")).isEqualTo("01911111111");
        assertThat(phone.get("reason")).isEqualTo("Customer corrected the address by phone");
        assertThat(phone.get("amended_by")).isEqualTo(actorId);
        Map<String, Object> address = log.stream().filter(m -> "address".equals(m.get("field"))).findFirst().orElseThrow();
        // The BEFORE value is the full address as it read, city included.
        assertThat(address.get("before_value")).isEqualTo("House 1, Dhanmondi, Dhaka");
    }

    @Test
    @DisplayName("the note is optional: an edit with none is recorded with no note")
    void noteIsOptional() {
        UUID id = order("[\"PENDING_VERIFICATION\"]");

        amendments.edit(id, edit(null, "01711111111"));

        assertThat(jdbc.queryForObject("SELECT reason FROM channel_order_amendment WHERE channel_order_id = ?",
                String.class, id)).isNull();
        // Still accountable without it: field, before, after, actor, moment.
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT field, before_value, after_value, amended_by, amended_at FROM channel_order_amendment "
                        + "WHERE channel_order_id = ?", id);
        assertThat(row.get("after_value")).isEqualTo("01711111111");
        assertThat(row.get("amended_by")).isEqualTo(actorId);
        assertThat(row.get("amended_at")).isNotNull();
    }

    @Test
    @DisplayName("sets, corrects and clears an advance, and it can never exceed the total")
    void editsTheAdvance() {
        UUID id = order("[\"PENDING_VERIFICATION\"]");

        amendments.edit(id, advance(new BigDecimal("400.00"), null));
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT advance_received, advance_recorded_at, advance_recorded_by FROM channel_order WHERE id = ?", id);
        assertThat((BigDecimal) row.get("advance_received")).isEqualByComparingTo("400.00");
        assertThat(row.get("advance_recorded_at")).isNotNull();
        assertThat(row.get("advance_recorded_by")).isEqualTo(actorId);

        amendments.edit(id, advance(new BigDecimal("650.00"), null));
        assertThat(jdbc.queryForObject("SELECT advance_received FROM channel_order WHERE id = ?",
                BigDecimal.class, id)).isEqualByComparingTo("650.00");

        // 0 clears it: the column is absent, never a stand-in zero, and all three facts clear together.
        amendments.edit(id, advance(BigDecimal.ZERO, null));
        Map<String, Object> cleared = jdbc.queryForMap(
                "SELECT advance_received, advance_recorded_at, advance_recorded_by FROM channel_order WHERE id = ?", id);
        assertThat(cleared.values()).containsOnlyNulls();

        // Against the order total (1000.00), or against the total being set in the same edit.
        assertThatThrownBy(() -> amendments.edit(id, advance(new BigDecimal("1000.01"), null)))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("more than the order total");
        assertThatThrownBy(() -> amendments.edit(id, advance(new BigDecimal("600.00"), new BigDecimal("500.00"))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("more than the order total");
        assertThatThrownBy(() -> amendments.edit(id, advance(new BigDecimal("-1"), null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("a note on its own is recorded, changes no order fact and does not take authority")
    void noteOnlyIsRecorded() {
        UUID id = order("[\"PENDING_VERIFICATION\"]");

        assertThat(amendments.edit(id, edit("paid by bkash", null)).fieldsChanged()).isEqualTo(1);

        assertThat(jdbc.queryForObject("SELECT field FROM channel_order_amendment WHERE channel_order_id = ?",
                String.class, id)).isEqualTo("note");
        assertThat(jdbc.queryForObject("SELECT ownership FROM channel_order WHERE id = ?", String.class, id))
                .isEqualTo("API_MANAGED");
    }

    @Test
    @DisplayName("refuses a change that changes nothing, a negative price, a quantity below 1 and a foreign line")
    void refusesBadEdits() {
        UUID id = order("[\"PENDING_VERIFICATION\"]");
        UUID line = lineId(id);

        assertThatThrownBy(() -> amendments.edit(id, edit(null, "01700000000")))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("Nothing");
        assertThatThrownBy(() -> amendments.edit(id, new OrderAmendmentService.Edit("why", null, null, null,
                new BigDecimal("-1"), null, null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> amendments.edit(id, new OrderAmendmentService.Edit(null, null, null, null,
                null, null, List.of(new OrderAmendmentService.LineEdit(line, null, 0, null)))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("at least 1");
        assertThatThrownBy(() -> amendments.edit(id, new OrderAmendmentService.Edit(null, null, null, null,
                null, null, List.of(new OrderAmendmentService.LineEdit(UUID.randomUUID(), "x", null, null)))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("does not belong");
        // Nothing was recorded for any refusal.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM channel_order_amendment WHERE channel_order_id = ?",
                Integer.class, id)).isZero();
    }

    @Test
    @DisplayName("is refused after dispatch and on a cancelled order")
    void refusesOutsideTheWindow() {
        UUID dispatched = order("[\"DISPATCHED\"]");
        assertThatThrownBy(() -> amendments.edit(dispatched, edit("why", "01711111111")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("BR-011");

        UUID cancelled = order("[\"CANCELLED\"]");
        assertThatThrownBy(() -> amendments.edit(cancelled, edit("why", "01711111111")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("cancelled");
    }

    @Test
    @DisplayName("allows a booked order and tells the operator the courier is not updated")
    void bookedOrderIsEditableWithAWarning() {
        UUID id = order("[\"READY_TO_SHIP\"]");
        jdbc.update("""
                INSERT INTO shipment (id, channel_order_id, trioloo_invoice_number, state, consignment_id,
                                      recipient_name, recipient_phone, recipient_address, cod_amount)
                VALUES (gen_random_uuid(), ?, 'TRAMEND1', 'BOOKED', 'C-1', 'T', '017', 'Dhaka', 100.00)
                """, id);

        OrderAmendmentService.Outcome outcome = amendments.edit(id, edit("Customer changed phone", "01711111111"));

        assertThat(outcome.fieldsChanged()).isEqualTo(1);
        assertThat(outcome.note()).contains("Steadfast");
    }

    @Test
    @DisplayName("requires order.order.edit, and the other order permissions grant nothing here")
    void requiresThePermission() {
        UUID id = order("[\"PENDING_VERIFICATION\"]");
        actingWith(OrderPermissions.ORDER_CANCEL, OrderPermissions.ORDER_RESTORE,
                OrderPermissions.CHANNEL_ORDER_VIEW, OrderPermissions.ORDER_CREATE);

        assertThatThrownBy(() -> amendments.edit(id, edit("why", "01711111111")))
                .isInstanceOf(AccessDeniedByPermissionException.class);
    }

    @Test
    @DisplayName("the amendment record is append-only")
    void amendmentsAreAppendOnly() {
        UUID id = order("[\"PENDING_VERIFICATION\"]");
        amendments.edit(id, edit("why", "01711111111"));

        assertThatThrownBy(() -> jdbc.update("UPDATE channel_order_amendment SET reason = 'x'"))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM channel_order_amendment"))
                .hasMessageContaining("append-only");
    }

    /* ------------------------------------------------------------------ fixtures */

    private static OrderAmendmentService.Edit edit(String note, String phone) {
        return new OrderAmendmentService.Edit(note, null, phone, null, null, null, null);
    }

    private static OrderAmendmentService.Edit advance(BigDecimal advance, BigDecimal total) {
        return new OrderAmendmentService.Edit(null, null, null, null, total, advance, null);
    }

    private UUID lineId(UUID orderId) {
        return jdbc.queryForObject("SELECT id FROM channel_order_item WHERE channel_order_id = ?",
                UUID.class, orderId);
    }

    private UUID order(String canonicalJson) {
        UUID id = UUID.randomUUID();
        String ext = "AM-" + id;
        jdbc.update("""
                INSERT INTO channel_order (id, channel_instance_id, external_order_id, order_number,
                    trioloo_invoice_number, ownership, statuses_json, canonical_statuses_json, price,
                    customer_first_name, customer_last_name, shipping_first_name, shipping_last_name,
                    shipping_phone, shipping_address1, shipping_address3, shipping_city,
                    provider_created_at, imported_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, 'API_MANAGED', '[]'::jsonb, CAST(? AS jsonb), 1000.00,
                        'Rahim', 'Uddin', 'Rahim', 'Uddin', '01700000000', 'House 1', 'Dhanmondi', 'Dhaka',
                        now(), now(), now())
                """, id, shopId, ext, ext, "TR" + Math.abs(id.hashCode()), canonicalJson);
        jdbc.update("""
                INSERT INTO channel_order_item (id, channel_order_id, external_order_item_id, external_order_id,
                    item_name, sku, item_price, paid_price, imported_at, last_seen_at)
                VALUES (gen_random_uuid(), ?, ?, ?, 'Original product', 'SKU-1', 1000.00, 1000.00, now(), now())
                """, id, ext + "-1", ext);
        return id;
    }

    private void actingWith(String... permissions) {
        var principal = new AccessUserDetails(actorId, "amend-tester", "Amend Tester",
                "unused", AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null,
                        Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));
    }

    private void clean() {
        String shops = "(SELECT id FROM channel_instance WHERE code LIKE 'AMEND-SHOP-%')";
        String orders = "(SELECT id FROM channel_order WHERE channel_instance_id IN " + shops + ")";
        // The amendment table refuses DELETE by design, so its trigger is lifted for cleanup only.
        jdbc.execute("ALTER TABLE channel_order_amendment DISABLE TRIGGER channel_order_amendment_no_change");
        jdbc.update("DELETE FROM channel_order_amendment WHERE channel_order_id IN " + orders);
        jdbc.execute("ALTER TABLE channel_order_amendment ENABLE TRIGGER channel_order_amendment_no_change");
        jdbc.update("DELETE FROM shipment WHERE channel_order_id IN " + orders);
        jdbc.update("DELETE FROM channel_order_item WHERE channel_order_id IN " + orders);
        jdbc.update("DELETE FROM channel_order WHERE channel_instance_id IN " + shops);
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'AMEND-SHOP-%'");
        jdbc.update("DELETE FROM operational_user_profile WHERE username LIKE 'amend-tester-%'");
    }
}
