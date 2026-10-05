package com.trioloo.erp.order.application;

import com.trioloo.erp.integration.infrastructure.website.WebsiteTransport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * BR-203 - only the DUE amount reaches the courier: a website order the customer already paid online is imported
 * with that payment as its advance, so the collect-on-delivery amount (price less advance) is zero.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "integration.website.erp-key=test-website-erp-key-0000000000000000",
        "trioloo.order.pull.admit-draft-shops=true"})
@DisplayName("A payment the website reports becomes the advance")
class ChannelPaymentAdvanceTest {

    private static final String BODY = """
            {"data":[
              {"orderNumber":"ZT-PAID-1","customerName":"Rahim Uddin","phone":"01712345678","address":"Mirpur, Dhaka",
               "division":"Dhaka","paymentMethod":"BKASH","paymentReference":"TX9","paymentStatus":"PAID","status":"PENDING",
               "subtotal":1000,"delivery":100,"total":1100,
               "createdAt":"2026-10-04 10:00:00","updatedAt":"2026-10-04 10:00:00",
               "items":[{"productId":"P1","sku":"P1","name":"Thing","unitPrice":1000,"quantity":1,"lineTotal":1000}]},
              {"orderNumber":"ZT-COD-1","customerName":"Karim","phone":"01812345678","address":"Dhanmondi, Dhaka",
               "division":"Dhaka","paymentMethod":"COD","paymentStatus":"PENDING","status":"PENDING",
               "subtotal":2000,"delivery":100,"total":2100,
               "createdAt":"2026-10-04 11:00:00","updatedAt":"2026-10-04 11:00:00",
               "items":[{"productId":"P2","sku":"P2","name":"Other","unitPrice":2000,"quantity":1,"lineTotal":2000}]}
            ]}
            """;

    @TestConfiguration
    static class StubTransport {
        @Bean
        @Primary
        WebsiteTransport websiteTransport() {
            return new WebsiteTransport() {
                @Override
                public Response get(String url, Map<String, String> headers) {
                    return new Response(200, BODY);
                }

                @Override
                public Response patch(String url, String body, Map<String, String> headers) {
                    return new Response(200, "{}");
                }
            };
        }
    }

    @Autowired
    private ChannelOrderImportService imports;
    @Autowired
    private JdbcTemplate jdbc;

    private UUID shopId;

    @BeforeEach
    void setUp() {
        clean();
        shopId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type, record_status, market)
                VALUES (?, ?, ?, 'WEBSITE', 'ACTIVE', 'BANGLADESH')
                """, shopId, "CPA-SHOP-" + shopId, "CPA Shop");
        jdbc.update("""
                INSERT INTO channel_connection (channel_instance_id, state, last_checked_at, updated_at)
                VALUES (?, 'CONNECTED', now(), now())
                """, shopId);
    }

    @AfterEach
    void tearDown() {
        clean();
    }

    @Test
    @DisplayName("a paid order carries its payment as the advance, so nothing is left to collect; an unpaid one carries none")
    void paidOrderHasNothingToCollect() {
        ChannelOrderImportService.ImportOutcome outcome =
                imports.importUpdatedSinceAsSystem(shopId, Instant.parse("2026-10-01T00:00:00Z"));
        assertThat(outcome.ordersCreated()).as(outcome.toString()).isEqualTo(2);

        Map<String, Object> paid = row("ZT-PAID-1");
        assertThat((java.math.BigDecimal) paid.get("price")).isEqualByComparingTo("1100.00");
        assertThat((java.math.BigDecimal) paid.get("advance_received")).isEqualByComparingTo("1100.00");
        assertThat(paid.get("advance_source")).isEqualTo("CHANNEL_PAYMENT");
        assertThat(paid.get("advance_recorded_by")).isNull();
        // The courier is asked to collect price less advance (ShipmentBookingService): zero.
        assertThat(((java.math.BigDecimal) paid.get("price")).subtract((java.math.BigDecimal) paid.get("advance_received")))
                .isEqualByComparingTo("0");

        Map<String, Object> cod = row("ZT-COD-1");
        assertThat((java.math.BigDecimal) cod.get("price")).isEqualByComparingTo("2100.00");
        assertThat(cod.get("advance_received")).isNull();
    }

    @Test
    @DisplayName("a person's later correction is never overwritten by the next poll")
    void aPersonsCorrectionSurvivesThePoll() {
        imports.importUpdatedSinceAsSystem(shopId, Instant.parse("2026-10-01T00:00:00Z"));
        // The ERP takes the order over and clears the advance (as an Edit would).
        jdbc.update("""
                UPDATE channel_order SET ownership = 'ERP_MANAGED', advance_received = NULL, advance_recorded_at = NULL,
                       advance_recorded_by = NULL, advance_source = NULL
                 WHERE external_order_id = 'ZT-PAID-1'
                """);

        imports.importUpdatedSinceAsSystem(shopId, Instant.parse("2026-10-01T00:00:00Z"));

        assertThat(row("ZT-PAID-1").get("advance_received")).isNull();
    }

    private Map<String, Object> row(String externalId) {
        return jdbc.queryForMap("""
                SELECT price, advance_received, advance_source, advance_recorded_by FROM channel_order
                 WHERE external_order_id = ? AND channel_instance_id = ?
                """, externalId, shopId);
    }

    private void clean() {
        String shops = "(SELECT id FROM channel_instance WHERE code LIKE 'CPA-SHOP-%')";
        jdbc.update("DELETE FROM channel_order_item WHERE channel_order_id IN "
                + "(SELECT id FROM channel_order WHERE channel_instance_id IN " + shops + ")");
        jdbc.update("DELETE FROM channel_order WHERE channel_instance_id IN " + shops);
        jdbc.update("DELETE FROM channel_connection WHERE channel_instance_id IN " + shops);
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'CPA-SHOP-%'");
    }
}
