package com.trioloo.erp.integration.infrastructure.daraz;

import com.trioloo.erp.order.domain.CanonicalOrderStatus;
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

    /**
     * 🔴 THE DEFECT THIS LOCKS. The original fixture used {@code 2026-08-01T10:00:00Z} — the one
     * form {@code Instant.parse} accepts — so the mapper passed every test while, in production,
     * EVERY {@code created_at} and {@code updated_at} threw, was swallowed by a bare
     * {@code catch}, and was stored as NULL across 110 real orders.
     *
     * <p>⚠ This is {@code OSC-070.i} exactly: a surface proven against an imaginary payload
     * proves nothing about the real one. The offset forms below are the ones a marketplace
     * actually emits.
     */
    @Test
    @DisplayName("parses provider timestamps in offset forms, not only the strict instant form")
    void parsesOffsetTimestampForms() {
        for (String stamp : List.of(
                "2026-08-01T10:00:00Z",
                "2026-08-01T16:00:00+06:00",
                "2026-08-01 16:00:00 +0600",
                "2026-08-01T16:00:00+0600")) {
            DarazChannelOrderProvider provider = provider(orderResponseWith(stamp), itemResponse());

            var page = provider.listOrders(UUID.randomUUID(), Instant.parse("2026-08-01T00:00:00Z"),
                    Instant.parse("2026-08-02T00:00:00Z"), 0, 10);

            assertThat(page.orders().getFirst().providerCreatedAt())
                    .as("timestamp %s must parse", stamp)
                    .isEqualTo(Instant.parse("2026-08-01T10:00:00Z"));
        }
    }

    @Test
    @DisplayName("an unparsable timestamp resolves to ABSENT and is never a fabricated date")
    void unparsableTimestampIsAbsent() {
        DarazChannelOrderProvider provider = provider(orderResponseWith("not-a-timestamp"), itemResponse());

        var page = provider.listOrders(UUID.randomUUID(), Instant.parse("2026-08-01T00:00:00Z"),
                Instant.parse("2026-08-02T00:00:00Z"), 0, 10);

        // SYS-034 — absent is not zero, and it is certainly not "now".
        assertThat(page.orders().getFirst().providerCreatedAt()).isNull();
        // 🔴 The order itself still imports. A bad timestamp never costs the order.
        assertThat(page.orders().getFirst().externalOrderId()).isEqualTo("57244869716603");
    }

    @Test
    @DisplayName("shipped_back_success maps to FAILED_DELIVERY, not RETURNED")
    void shippedBackSuccessIsAFailedDelivery() {
        DarazChannelOrderProvider provider = provider(orderResponse(), itemResponse());

        // 🔴 UNDOCUMENTED BY DARAZ, FOUND IN PRODUCTION, MAPPED BY BUSINESS DECISION 2026-08-23.
        // ⚠ `RETURNED` is "Goods came back to Trioloo" (§6.2) — a customer's decision. A parcel
        // shipped back to the seller is the OUTCOME OF A FAILED DELIVERY, the RTO path §10.4
        // describes, and §6.3 draws FAILED_DELIVERY → RETURNED as a later, separate step.
        assertThat(provider.canonicalStatuses(List.of("shipped_back_success")))
                .containsExactly(CanonicalOrderStatus.FAILED_DELIVERY);
        assertThat(provider.canonicalStatuses(List.of("shipped_back_success")))
                .doesNotContain(CanonicalOrderStatus.RETURNED);

        // A customer return still maps to RETURNED — the two stay distinct.
        assertThat(provider.canonicalStatuses(List.of("returned")))
                .containsExactly(CanonicalOrderStatus.RETURNED);
    }

    @Test
    @DisplayName("a still-unknown channel status is carried untranslated, never approximated")
    void unknownStatusIsNotApproximated() {
        DarazChannelOrderProvider provider = provider(orderResponse(), itemResponse());

        // BR-134 / SYS-034 — the raw value survives on the order; the canonical mirror stays
        // empty rather than borrowing the nearest-looking state.
        assertThat(provider.canonicalStatuses(List.of("some_future_daraz_status"))).isEmpty();
    }

    private static String orderResponseWith(String createdAt) {
        return orderResponse().replace("\"created_at\": \"2026-08-01T10:00:00Z\"",
                "\"created_at\": \"" + createdAt + "\"");
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
