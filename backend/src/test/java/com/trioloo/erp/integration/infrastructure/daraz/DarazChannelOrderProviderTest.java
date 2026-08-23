package com.trioloo.erp.integration.infrastructure.daraz;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class DarazChannelOrderProviderTest {

    private static final String TOKEN = "access-token";
    private final List<URI> requestedUris = new ArrayList<>();
    private final AtomicInteger gets = new AtomicInteger();
    private final AtomicInteger posts = new AtomicInteger();

    @Test
    @DisplayName("uses the Daraz order list endpoint with limit, not limt, then fetches items")
    void usesOrdersGetWithLimitThenFetchesItems() {
        DarazChannelOrderProvider provider = provider(orderResponse(), itemResponse());

        provider.listOrders(UUID.randomUUID(), Instant.parse("2026-08-01T00:00:00Z"),
                Instant.parse("2026-08-02T00:00:00Z"), 0, 10);

        assertThat(gets).hasValue(2);
        assertThat(posts).hasValue(0);
        String orderList = requestedUris.get(0).toString();
        assertThat(orderList).contains("https://api.daraz.com.bd/rest/orders/get");
        assertThat(orderList).contains("created_after=2026-08-01T00:00:00Z");
        assertThat(orderList).contains("created_before=2026-08-02T00:00:00Z");
        assertThat(orderList).contains("sort_by=created_at");
        assertThat(orderList).contains("sort_direction=ASC");
        assertThat(orderList).contains("offset=0");
        assertThat(orderList).contains("limit=10");
        assertThat(orderList).doesNotContain("limt=");
        assertThat(orderList).contains("sign=");
        String items = requestedUris.get(1).toString();
        assertThat(items).contains("https://api.daraz.com.bd/rest/orders/items/get");
        assertThat(items).contains("order_ids=%5B57244869716603%5D");
        assertThat(items).contains("sign=");
    }

    @Test
    @DisplayName("maps order headers and their item details")
    void mapsOrderHeadersAndItems() {
        DarazChannelOrderProvider provider = provider(orderResponse(), itemResponse());

        var page = provider.listOrders(UUID.randomUUID(), Instant.parse("2026-08-01T00:00:00Z"),
                Instant.parse("2026-08-02T00:00:00Z"), 0, 10);

        assertThat(page.countTotal()).isEqualTo(1);
        assertThat(page.count()).isEqualTo(1);
        assertThat(page.orders()).hasSize(1);
        var order = page.orders().getFirst();
        assertThat(order.externalOrderId()).isEqualTo("57244869716603");
        assertThat(order.orderNumber()).isEqualTo("881204773");
        assertThat(order.statuses()).containsExactly("pending");
        assertThat(order.price()).isEqualByComparingTo("104500.00");
        assertThat(order.shippingAddress().city()).isEqualTo("Dhaka");
        assertThat(order.items()).hasSize(1);
        assertThat(order.items().getFirst().externalOrderItemId()).isEqualTo("913210");
        assertThat(order.items().getFirst().shopSku()).isEqualTo("ELT002");
        assertThat(order.items().getFirst().paidPrice()).isEqualByComparingTo("104500.00");
    }

    private DarazChannelOrderProvider provider(String orderResponse, String itemResponse) {
        DarazProperties properties = new DarazProperties("000000-key", "test-secret", "https://example.test/cb");
        DarazTransport transport = new DarazTransport() {
            @Override
            public String get(URI uri) {
                gets.incrementAndGet();
                requestedUris.add(uri);
                return uri.getPath().endsWith("/orders/items/get") ? itemResponse : orderResponse;
            }

            @Override
            public String post(URI uri, String body, String contentType) {
                posts.incrementAndGet();
                throw new UnsupportedOperationException("Orders are read with GET.");
            }
        };
        DarazAccessTokenProvider tokens = new DarazAccessTokenProvider(
                properties, new DarazRequestSigner(), transport, null,
                java.time.Clock.systemUTC(), Duration.ofHours(24)) {
            @Override
            public String accessTokenFor(UUID channelInstanceId) {
                return TOKEN;
            }
        };
        return new DarazChannelOrderProvider(properties, new DarazRequestSigner(), transport, tokens);
    }

    private static String orderResponse() {
        return """
                {
                  "code": "0",
                  "request_id": "r-order-1",
                  "_trace_id_": "trace",
                  "data": {
                    "countTotal": 1,
                    "count": 1,
                    "orders": [{
                      "order_id": "57244869716603",
                      "order_number": "881204773",
                      "created_at": "2026-08-01T10:00:00Z",
                      "updated_at": "2026-08-01T11:00:00Z",
                      "price": "104500.00",
                      "shipping_fee": "80.00",
                      "payment_method": "COD",
                      "statuses": ["pending"],
                      "items_count": "1",
                      "address_shipping": {
                        "first_name": "Rashedul",
                        "phone": "01700000000",
                        "address1": "House 42",
                        "city": "Dhaka",
                        "country": "Bangladesh"
                      }
                    }]
                  }
                }
                """;
    }

    private static String itemResponse() {
        return """
                {
                  "code": "0",
                  "request_id": "r-items-1",
                  "data": [{
                    "order_id": "57244869716603",
                    "order_items": [{
                      "order_item_id": "913210",
                      "order_id": "57244869716603",
                      "sku": "ELT002",
                      "shop_sku": "ELT002",
                      "sku_id": "SKU-1",
                      "name": "Intel Core i5 PC",
                      "item_price": "104500.00",
                      "paid_price": "104500.00",
                      "status": "pending",
                      "shipping_provider_type": "STANDARD",
                      "created_at": "2026-08-01T10:00:00Z",
                      "updated_at": "2026-08-01T11:00:00Z"
                    }]
                  }]
                }
                """;
    }
}
