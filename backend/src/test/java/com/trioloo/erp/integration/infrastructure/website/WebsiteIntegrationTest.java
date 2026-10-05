package com.trioloo.erp.integration.infrastructure.website;

import com.trioloo.erp.order.application.ChannelOrderProvider;
import com.trioloo.erp.order.application.ChannelOrderSnapshot;
import com.trioloo.erp.order.domain.CanonicalOrderStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Website (Zeon Tech storefront) orders in and statuses out")
class WebsiteIntegrationTest {

    private static final String BODY = """
            {"data":[
              {"orderNumber":"ZT-1001","customerName":"Rahim Uddin","phone":"01712345678","email":"r@example.test",
               "address":"House 4, Road 2, Mirpur","area":"","division":"Dhaka","paymentMethod":"BKASH",
               "paymentReference":"TX123","paymentStatus":"PAID","status":"PENDING",
               "subtotal":30000.5,"delivery":120,"total":30120.5,
               "createdAt":"2026-09-28 10:00:00","updatedAt":"2026-09-28 10:05:00",
               "items":[{"productId":"ZT156","sku":"ZT156","name":"Gaming PC","unitPrice":15000.25,"quantity":2,"lineTotal":30000.5}]},
              {"orderNumber":"ZT-1002","customerName":"Karim","phone":"01812345678","address":"Dhanmondi, Dhaka",
               "division":"Dhaka","paymentMethod":"COD","paymentStatus":"PENDING","status":"CANCELLED",
               "subtotal":100,"delivery":0,"total":100,
               "createdAt":"2026-09-27 09:00:00","updatedAt":"2026-09-29 09:00:00","items":[]}
            ]}
            """;

    private static final class FakeTransport implements WebsiteTransport {
        final List<String> urls = new ArrayList<>();
        final List<String> patches = new ArrayList<>();
        int status = 200;
        String body = BODY;

        @Override
        public Response get(String url, Map<String, String> headers) {
            urls.add(url);
            assertThat(headers).containsKey("X-ERP-Key");
            return new Response(status, body);
        }

        @Override
        public Response patch(String url, String payload, Map<String, String> headers) {
            patches.add(url + " " + payload);
            return new Response(status, body);
        }
    }

    private static WebsiteProperties configured() {
        return new WebsiteProperties("http://127.0.0.1:4000/api/v1", "k".repeat(40));
    }

    @Test
    @DisplayName("maps a storefront order: one name box, full address, subtotal as the price, one row per unit, raw status kept")
    void mapsAnOrder() {
        FakeTransport transport = new FakeTransport();
        WebsiteChannelOrderProvider provider = new WebsiteChannelOrderProvider(configured(), transport);

        ChannelOrderProvider.Page page = provider.listOrdersUpdatedSince(UUID.randomUUID(),
                Instant.parse("2026-09-01T00:00:00Z"), 0, 100);

        assertThat(page.countTotal()).isEqualTo(2);
        ChannelOrderSnapshot order = page.orders().get(0);
        assertThat(order.externalOrderId()).isEqualTo("ZT-1001");
        assertThat(order.customerFirstName()).isEqualTo("Rahim");
        assertThat(order.customerLastName()).isEqualTo("Uddin");
        // The division is appended only when the address does not already name it.
        assertThat(order.shippingAddress().address1()).isEqualTo("House 4, Road 2, Mirpur, Dhaka");
        assertThat(order.shippingAddress().phone()).isEqualTo("01712345678");
        assertThat(order.price()).isEqualByComparingTo("30000.50");
        assertThat(order.shippingFee()).isEqualByComparingTo("120.00");
        assertThat(order.paymentMethod()).isEqualTo("bKash");
        assertThat(order.statuses()).containsExactly("PENDING");
        assertThat(order.providerCreatedAt()).isEqualTo(Instant.parse("2026-09-28T10:00:00Z"));
        assertThat(order.remarks()).contains("paid").contains("TX123");
        // Two units become two rows, each at the unit price, so the lines still add up to the subtotal.
        assertThat(order.items()).hasSize(2);
        assertThat(order.items().get(0).itemPrice()).isEqualByComparingTo(new BigDecimal("15000.25"));
        assertThat(order.items().get(0).externalOrderItemId()).isNotEqualTo(order.items().get(1).externalOrderItemId());
        // An address that already names the division is not given it twice.
        assertThat(page.orders().get(1).shippingAddress().address1()).isEqualTo("Dhanmondi, Dhaka");
        assertThat(transport.urls.get(0)).contains("/erp/orders?updatedAfter=2026-09-01T00:00:00Z");
    }

    @Test
    @DisplayName("translates the six storefront words and declines one it does not publish")
    void translatesStatuses() {
        WebsiteChannelOrderProvider provider = new WebsiteChannelOrderProvider(configured(), new FakeTransport());
        assertThat(provider.canonicalStatuses(List.of("PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "WEIRD")))
                .containsExactly(CanonicalOrderStatus.PENDING_VERIFICATION, CanonicalOrderStatus.CONFIRMED,
                        CanonicalOrderStatus.IN_FULFILLMENT, CanonicalOrderStatus.DISPATCHED,
                        CanonicalOrderStatus.DELIVERED, CanonicalOrderStatus.CANCELLED);
    }

    @Test
    @DisplayName("a creation window keeps only orders created inside it")
    void creationWindow() {
        WebsiteChannelOrderProvider provider = new WebsiteChannelOrderProvider(configured(), new FakeTransport());
        ChannelOrderProvider.Page page = provider.listOrders(UUID.randomUUID(),
                Instant.parse("2026-09-28T00:00:00Z"), Instant.parse("2026-09-30T00:00:00Z"), 0, 100);
        assertThat(page.orders()).extracting(ChannelOrderSnapshot::externalOrderId).containsExactly("ZT-1001");
    }

    @Test
    @DisplayName("says plainly when the site refuses the key or has the integration switched off")
    void explainsRefusals() {
        FakeTransport transport = new FakeTransport();
        WebsiteChannelOrderProvider provider = new WebsiteChannelOrderProvider(configured(), transport);
        transport.status = 401;
        assertThatThrownBy(() -> provider.listOrdersUpdatedSince(UUID.randomUUID(), Instant.parse("2026-01-01T00:00:00Z"), 0, 10))
                .isInstanceOf(WebsiteException.class).hasMessageContaining("refused the ERP key");
        transport.status = 503;
        assertThatThrownBy(() -> provider.listOrdersUpdatedSince(UUID.randomUUID(), Instant.parse("2026-01-02T00:00:00Z"), 0, 10))
                .isInstanceOf(WebsiteException.class).hasMessageContaining("switched off");
    }

    @Test
    @DisplayName("an unconfigured deployment boots, reports not configured, and never prints the key")
    void unconfigured() {
        WebsiteProperties none = new WebsiteProperties("", "");
        assertThat(none.isConfigured()).isFalse();
        assertThat(configured().toString()).doesNotContain("kkkk");
    }

    @Test
    @DisplayName("tells the site cancel, reopen and confirm in its own words, and reports a refusal")
    void writesStatusBack() {
        FakeTransport transport = new FakeTransport();
        WebsiteOrderStatusClient client = new WebsiteOrderStatusClient(configured(), transport);

        client.publish("ZT-1001", CanonicalOrderStatus.CANCELLED);
        client.publish("ZT-1001", CanonicalOrderStatus.PENDING_VERIFICATION);
        client.publish("ZT-1001", CanonicalOrderStatus.READY_TO_SHIP);
        client.publish("ZT-1001", CanonicalOrderStatus.DISPATCHED);
        client.publish("ZT-1001", CanonicalOrderStatus.DELIVERED);
        assertThat(transport.patches).containsExactly(
                "http://127.0.0.1:4000/api/v1/erp/orders/ZT-1001 {\"status\":\"CANCELLED\"}",
                "http://127.0.0.1:4000/api/v1/erp/orders/ZT-1001 {\"status\":\"PENDING\"}",
                "http://127.0.0.1:4000/api/v1/erp/orders/ZT-1001 {\"status\":\"CONFIRMED\"}",
                "http://127.0.0.1:4000/api/v1/erp/orders/ZT-1001 {\"status\":\"SHIPPED\"}",
                "http://127.0.0.1:4000/api/v1/erp/orders/ZT-1001 {\"status\":\"DELIVERED\"}");

        transport.status = 404;
        assertThatThrownBy(() -> client.publish("NOPE", CanonicalOrderStatus.CANCELLED))
                .isInstanceOf(WebsiteException.class).hasMessageContaining("no such order");
        transport.status = 409;
        transport.body = "{\"error\":{\"message\":\"Cannot reopen: only 0 of X left in stock.\"}}";
        assertThatThrownBy(() -> client.publish("ZT-1", CanonicalOrderStatus.PENDING_VERIFICATION))
                .isInstanceOf(WebsiteException.class).hasMessageContaining("only 0 of X left");
        // A state the site has no word for is refused rather than guessed.
        assertThatThrownBy(() -> client.publish("ZT-1", CanonicalOrderStatus.RETURNED))
                .isInstanceOf(WebsiteException.class);
    }
}
