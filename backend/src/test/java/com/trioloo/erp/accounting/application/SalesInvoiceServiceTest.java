package com.trioloo.erp.accounting.application;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Issuing the {@code E-039} Sales Invoice — {@code INV-39.1}, {@code INV-39.2}.
 *
 * <p>🔴 THE SNAPSHOT IS THE POINT. {@code INV-39.2} requires the document reproducible years
 * later, so {@link #snapshotSurvivesTheOrderChanging} is the test that matters: change the order
 * afterwards and the invoice must not move.
 */
@SpringBootTest
@DisplayName("Sales invoice")
class SalesInvoiceServiceTest {

    @Autowired
    private SalesInvoiceService invoices;
    @Autowired
    private JdbcTemplate jdbc;

    private UUID orderId;
    private UUID actorId;

    @BeforeEach
    void setUp() {
        clean();
        actorId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO operational_user_profile (id, username, full_name, lifecycle_state, created_at, activated_at)
                VALUES (?, ?, ?, 'ACTIVE', ?, ?)
                """, actorId, "invoice-tester-" + actorId, "Invoice Tester",
                Timestamp.from(Instant.now()), Timestamp.from(Instant.now()));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        new AccessUserDetails(actorId, "invoice-tester", "Invoice Tester",
                                "unused", AccountLifecycleState.ACTIVE, Set.of(), Set.of()),
                        null, java.util.List.of()));
        orderId = seedOrder();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clean();
    }

    @Test
    @DisplayName("adopts the order's invoice number rather than minting a second one")
    void adoptsTheOrderNumber() {
        SalesInvoiceService.Issued issued = invoices.issue(orderId);

        // 🔴 BD-443 / INV-39.1 — ONE sequence, and creating a second is prohibited outright.
        // OSC-057 already assigned this number and V19's trigger made it immutable.
        assertThat(issued.invoiceNumber()).isEqualTo("TR-INV-0001");
    }

    @Test
    @DisplayName("totals the snapshot from the order's own lines")
    void totalsFromTheLines() {
        SalesInvoiceService.Issued issued = invoices.issue(orderId);

        // Two items at 1000 and 500, plus the order's own shipping fee of 60.
        assertThat(issued.subtotal()).isEqualByComparingTo("1500.00");
        assertThat(issued.deliveryCharge()).isEqualByComparingTo("60.00");
        assertThat(issued.total()).isEqualByComparingTo("1560.00");
    }

    @Test
    @DisplayName("records the ratified 0% as a RATE, not as an absence")
    void recordsTheRatifiedZeroRate() {
        /*
          ✅ THE PRODUCT OWNER RATIFIED 0% ON 2026-08-24 - "for now".

          🔴 ZERO AND NULL ARE DIFFERENT ANSWERS AND THIS TEST PINS THE DIFFERENCE. 0.000 STATES
          that no tax applies at present; NULL would say nobody had decided (SYS-034). The owner
          decided, so the invoice carries the claim - which is what BD-307 permits displaying
          while the ERP maintains no VAT accounts.

          🔴 THE DESIGN'S 7.5 IS STILL REFUSED. It is hard-coded in the mock's renderVals() beside
          its sample Lenovo and Samsung line items and a sample `charges = 800`, and GAP-003 still
          supplies no BIN, no Mushak requirement and no rule about which rate applies to which
          product category. What is ratified is Trioloo's CURRENT POSITION, not a tax model.
        */
        SalesInvoiceService.Issued issued = invoices.issue(orderId);

        assertThat(issued.taxRatePercent()).isEqualByComparingTo("0");
        assertThat(issued.taxAmount()).isEqualByComparingTo("0.00");
        // ⚠ And the total is unchanged by a zero rate, which is the arithmetic saying the same.
        assertThat(issued.total()).isEqualByComparingTo("1560.00");
    }

    @Test
    @DisplayName("🔴 a later rate change cannot rewrite an invoice already issued")
    void aLaterRateChangeCannotRewriteAnIssuedInvoice() {
        /*
          🔴 THE REASON INV-39.2 EXISTS, STATED AS A TEST. The owner's 0% is explicitly "for now".
          When it changes - and a tax position usually does - every invoice already raised must
          stay exactly as it was printed and handed to a customer.

          ⚠ A renderer that re-derived tax from current configuration would silently restate every
          historical invoice at the new rate, which is both wrong for the customer and the kind of
          thing a tax authority reads as falsification.

          ✅ The snapshot makes that impossible: the rate and the amount are COLUMNS on the issued
          document, not a calculation performed at render time (PRN-022).
        */
        SalesInvoiceService.Issued issued = invoices.issue(orderId);
        assertThat(issued.taxRatePercent()).isEqualByComparingTo("0");

        // A service configured with a different rate - the same class, new configuration.
        SalesInvoiceService atFifteenPercent = new SalesInvoiceService(
                jdbc, java.time.Clock.systemUTC(), "15");
        UUID laterOrder = seedSecondOrder();
        SalesInvoiceService.Issued later = atFifteenPercent.issue(laterOrder);

        // ✅ The new invoice carries the new rate...
        assertThat(later.taxRatePercent()).isEqualByComparingTo("15");
        assertThat(later.taxAmount()).isEqualByComparingTo("234.00");

        // 🔴 ...and the ALREADY ISSUED one is untouched.
        java.util.Map<String, Object> first = jdbc.queryForMap(
                "SELECT tax_rate_percent, tax_amount, total FROM sales_invoice WHERE id = ?",
                issued.id());
        assertThat((BigDecimal) first.get("tax_rate_percent")).isEqualByComparingTo("0");
        assertThat((BigDecimal) first.get("tax_amount")).isEqualByComparingTo("0.00");
        assertThat((BigDecimal) first.get("total")).isEqualByComparingTo("1560.00");
    }

    @Test
    @DisplayName("🔴 the snapshot survives the order changing underneath it")
    void snapshotSurvivesTheOrderChanging() {
        /*
          🔴 INV-39.2 — the content is snapshotted so the invoice stays reproducible YEARS LATER,
          and PRN-022 makes this record the printable's one authoritative source. ⚠ A renderer
          that re-read the order would reprint last year's invoice with this year's address.
        */
        invoices.issue(orderId);

        jdbc.update("""
                UPDATE channel_order
                   SET customer_first_name = 'Someone', customer_last_name = 'Else',
                       shipping_first_name = 'Someone', shipping_last_name = 'Else',
                       shipping_address1 = 'A completely different street',
                       shipping_phone = '01900000000', price = 999999
                 WHERE id = ?
                """, orderId);
        jdbc.update("UPDATE channel_order_item SET item_name = 'Renamed', paid_price = 1 "
                + "WHERE channel_order_id = ?", orderId);

        Map<String, Object> stored = jdbc.queryForMap(
                "SELECT customer_name, customer_address, subtotal, total, lines_json::text AS lines "
                        + "FROM sales_invoice WHERE channel_order_id = ?", orderId);

        assertThat(stored.get("customer_name")).isEqualTo("Invoice Customer");
        assertThat((String) stored.get("customer_address")).contains("House 9");
        assertThat((BigDecimal) stored.get("subtotal")).isEqualByComparingTo("1500.00");
        assertThat((BigDecimal) stored.get("total")).isEqualByComparingTo("1560.00");
        // ⚠ Including the line NAMES — a product renamed next year must not rename itself on
        // last year's document.
        assertThat((String) stored.get("lines")).contains("Widget A").doesNotContain("Renamed");
    }

    @Test
    @DisplayName("keeps each external reference with its issuing party")
    void keepsReferencesWithTheirIssuer() {
        SalesInvoiceService.Issued issued = invoices.issue(orderId);

        // 🔴 DB-013 — a Daraz order number and a courier consignment number are only meaningful
        // alongside the party that issued them, and two parties may issue the same string. They
        // are separate columns, never one merged "reference".
        Map<String, Object> stored = jdbc.queryForMap(
                "SELECT external_order_reference, consignment_reference FROM sales_invoice WHERE id = ?",
                issued.id());
        assertThat(stored.get("external_order_reference")).isEqualTo("INV-ORDER-EXT");
        // ⚠ Null because nothing is booked — absent is not empty (BR-134).
        assertThat(stored.get("consignment_reference")).isNull();
    }

    @Test
    @DisplayName("🔴 refuses to issue a second invoice for one order")
    void refusesASecondInvoice() {
        invoices.issue(orderId);

        // 🔴 INV-39.1 — one sequence, never reused. A second document claiming the same identity
        // is exactly what DB-012 retires a cancelled number to prevent.
        assertThatThrownBy(() -> invoices.issue(orderId))
                .isInstanceOf(SalesInvoiceService.InvoiceAlreadyIssuedException.class)
                .hasMessageContaining("INV-39.1");

        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM sales_invoice WHERE channel_order_id = ?", Integer.class, orderId))
                .isEqualTo(1);
    }

    /* ------------------------------------------------------------------ fixtures */

    private UUID seedOrder() {
        UUID instanceId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type, record_status, market)
                VALUES (?, ?, ?, 'DARAZ', 'ACTIVE', 'BANGLADESH')
                """, instanceId, "INV-SHOP-" + instanceId, "Invoice Test Shop");
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_order (
                    id, channel_instance_id, external_order_id, ownership, statuses_json,
                    canonical_statuses_json, price, shipping_fee, customer_first_name,
                    customer_last_name, shipping_phone, shipping_address1, shipping_city,
                    imported_at, last_seen_at)
                VALUES (?, ?, 'INV-ORDER-EXT', 'API_MANAGED', '[]'::jsonb, '[]'::jsonb,
                        ?, ?, ?, ?, ?, ?, ?, now(), now())
                """, id, instanceId, new BigDecimal("1500.00"), new BigDecimal("60.00"),
                "Invoice", "Customer", "01700000000", "House 9, Banani", "Dhaka");
        jdbc.update("UPDATE channel_order SET trioloo_invoice_number = 'TR-INV-0001' WHERE id = ?", id);

        seedItem(id, "INV-ITEM-1", "Widget A", new BigDecimal("1000.00"));
        seedItem(id, "INV-ITEM-2", "Widget B", new BigDecimal("500.00"));
        return id;
    }

    /** A second order so a differently-configured service has something of its own to issue. */
    private UUID seedSecondOrder() {
        UUID instanceId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type, record_status, market)
                VALUES (?, ?, ?, 'DARAZ', 'ACTIVE', 'BANGLADESH')
                """, instanceId, "INV-SHOP-2-" + instanceId, "Invoice Test Shop 2");
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_order (
                    id, channel_instance_id, external_order_id, ownership, statuses_json,
                    canonical_statuses_json, price, shipping_fee, customer_first_name,
                    customer_last_name, shipping_phone, shipping_address1, shipping_city,
                    imported_at, last_seen_at)
                VALUES (?, ?, 'INV-ORDER-EXT', 'API_MANAGED', '[]'::jsonb, '[]'::jsonb,
                        ?, ?, ?, ?, ?, ?, ?, now(), now())
                """, id, instanceId, new BigDecimal("1500.00"), new BigDecimal("60.00"),
                "Second", "Customer", "01700000000", "House 9, Banani", "Dhaka");
        jdbc.update("UPDATE channel_order SET trioloo_invoice_number = 'TR-INV-0002' WHERE id = ?", id);
        seedItem(id, "INV-ITEM-3", "Widget C", new BigDecimal("1500.00"));
        return id;
    }

    private void seedItem(UUID orderId, String externalItemId, String name, BigDecimal price) {
        jdbc.update("""
                INSERT INTO channel_order_item (
                    id, channel_order_id, external_order_item_id, external_order_id,
                    item_name, item_price, paid_price, imported_at, last_seen_at)
                VALUES (gen_random_uuid(), ?, ?, 'INV-ORDER-EXT', ?, ?, ?, now(), now())
                """, orderId, externalItemId, name, price, price);
    }

    private void clean() {
        jdbc.update("DELETE FROM sales_invoice WHERE invoice_number LIKE 'TR-INV-%'");
        jdbc.update("DELETE FROM shipment WHERE trioloo_invoice_number LIKE 'TR-INV-%'");
        jdbc.update("DELETE FROM channel_order_item WHERE external_order_id = 'INV-ORDER-EXT'");
        jdbc.update("DELETE FROM channel_order WHERE external_order_id = 'INV-ORDER-EXT'");
        jdbc.update("DELETE FROM operational_user_profile WHERE username LIKE 'invoice-tester-%'");
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'INV-SHOP-%'");
    }
}
