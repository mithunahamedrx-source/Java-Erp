package com.trioloo.erp.integration.infrastructure.website;

import com.trioloo.erp.order.application.ChannelOrderItemSnapshot;
import com.trioloo.erp.order.application.ChannelOrderProvider;
import com.trioloo.erp.order.application.ChannelOrderSnapshot;
import com.trioloo.erp.order.domain.CanonicalOrderStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * The Zeon Tech storefront's orders, read from its ERP endpoint {@code GET /erp/orders?updatedAfter=}.
 *
 * <p>🔴 READ-ONLY. This class writes nothing to the storefront; the one write path is
 * {@link WebsiteOrderStatusClient}, and it is a separate, explicit class.
 *
 * <p>The endpoint serves at most 500 orders per call, ordered by update time, and has no creation-window
 * filter. A creation window is therefore read as "updated since the window opened" and trimmed here, since an
 * order cannot be created after it was last updated. An overlap is always safe: the import is an idempotent
 * upsert on the order number.
 *
 * <p>⚠ TRANSLATION LIVES HERE (BR-005): the storefront's six order words become canonical states, and the raw word
 * is kept untouched as the order's channel status (BR-173).
 */
@Component
public class WebsiteChannelOrderProvider implements ChannelOrderProvider {

    static final String CHANNEL_TYPE = "WEBSITE";
    private static final DateTimeFormatter SITE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int SITE_PAGE = 500;
    private static final int MAX_ROUNDS = 20;
    private static final Duration MEMO = Duration.ofSeconds(45);

    private final WebsiteProperties properties;
    private final WebsiteTransport transport;
    private final ObjectMapper json = new ObjectMapper();

    private Memo memo;

    public WebsiteChannelOrderProvider(WebsiteProperties properties, WebsiteTransport transport) {
        this.properties = properties;
        this.transport = transport;
    }

    @Override
    public String channelType() {
        return CHANNEL_TYPE;
    }

    @Override
    public Page listOrders(UUID channelInstanceId, Instant createdAfter, Instant createdBefore,
                           int offset, int limit) {
        List<ChannelOrderSnapshot> inWindow = fetchUpdatedAfter(createdAfter).stream()
                .filter(o -> o.providerCreatedAt() != null
                        && !o.providerCreatedAt().isBefore(createdAfter)
                        && o.providerCreatedAt().isBefore(createdBefore))
                .toList();
        return slice(inWindow, offset, limit);
    }

    @Override
    public Page listOrdersUpdatedSince(UUID channelInstanceId, Instant updatedAfter, int offset, int limit) {
        return slice(fetchUpdatedAfter(updatedAfter), offset, limit);
    }

    @Override
    public List<CanonicalOrderStatus> canonicalStatuses(List<String> channelStatuses) {
        List<CanonicalOrderStatus> out = new ArrayList<>();
        for (String raw : channelStatuses == null ? List.<String>of() : channelStatuses) {
            CanonicalOrderStatus mapped = canonical(raw);
            if (mapped != null) {
                out.add(mapped);
            }
        }
        return out;
    }

    /** The storefront's word, as a canonical state; {@code null} for a word it does not publish (BR-134). */
    static CanonicalOrderStatus canonical(String raw) {
        if (raw == null) {
            return null;
        }
        return switch (raw.trim().toUpperCase(Locale.ROOT)) {
            case "PENDING" -> CanonicalOrderStatus.PENDING_VERIFICATION;
            case "CONFIRMED" -> CanonicalOrderStatus.CONFIRMED;
            case "PROCESSING" -> CanonicalOrderStatus.IN_FULFILLMENT;
            case "SHIPPED" -> CanonicalOrderStatus.DISPATCHED;
            case "DELIVERED" -> CanonicalOrderStatus.DELIVERED;
            case "CANCELLED" -> CanonicalOrderStatus.CANCELLED;
            default -> null;
        };
    }

    /* ------------------------------------------------------------------ reading */

    private synchronized List<ChannelOrderSnapshot> fetchUpdatedAfter(Instant after) {
        Instant now = Instant.now();
        if (memo != null && memo.after.equals(after) && Duration.between(memo.at, now).compareTo(MEMO) < 0) {
            return memo.orders;
        }
        List<ChannelOrderSnapshot> all = new ArrayList<>();
        Instant cursor = after;
        for (int round = 0; round < MAX_ROUNDS; round++) {
            JsonNode body = read("/erp/orders?updatedAfter=" + cursor.toString());
            JsonNode data = body.path("data");
            int count = 0;
            Instant lastUpdated = null;
            for (JsonNode node : data) {
                all.add(snapshot(node));
                count++;
                Instant updated = site(node.path("updatedAt").asString(""));
                if (updated != null) {
                    lastUpdated = updated;
                }
            }
            if (count < SITE_PAGE || lastUpdated == null) {
                break;
            }
            // A full page: continue from one second before the last update so a tie at the boundary is re-read.
            cursor = lastUpdated.minusSeconds(1);
        }
        memo = new Memo(after, now, List.copyOf(all));
        return memo.orders;
    }

    private JsonNode read(String path) {
        WebsiteTransport.Response response = transport.get(properties.baseUrl() + path,
                Map.of("X-ERP-Key", properties.erpKey(), "Accept", "application/json"));
        if (response.status() == 503) {
            throw new WebsiteException("The website's ERP integration is switched off (no ERP key is set there).");
        }
        if (response.status() == 401) {
            throw new WebsiteException("The website refused the ERP key.");
        }
        if (response.status() != 200) {
            throw new WebsiteException("The website answered HTTP " + response.status() + ".");
        }
        try {
            return json.readTree(response.body() == null ? "" : response.body());
        } catch (RuntimeException e) {
            throw new WebsiteException("The website's answer was not readable.");
        }
    }

    private static Page slice(List<ChannelOrderSnapshot> all, int offset, int limit) {
        int from = Math.min(Math.max(offset, 0), all.size());
        int to = Math.min(from + Math.max(limit, 1), all.size());
        List<ChannelOrderSnapshot> part = all.subList(from, to);
        return new Page(all.size(), part.size(), part);
    }

    /* ------------------------------------------------------------------ mapping */

    ChannelOrderSnapshot snapshot(JsonNode node) {
        String number = node.path("orderNumber").asString("");
        String status = node.path("status").asString(null);
        Instant created = site(node.path("createdAt").asString(""));
        Instant updated = site(node.path("updatedAt").asString(""));

        // One name box on the site: split once on the first space, as the ERP's own capture form does.
        String full = node.path("customerName").asString("").trim().replaceAll("\\s+", " ");
        int cut = full.indexOf(' ');
        String first = cut < 0 ? full : full.substring(0, cut);
        String last = cut < 0 ? null : full.substring(cut + 1);

        String division = node.path("division").asString("").trim();
        String address = node.path("address").asString("").trim();
        String fullAddress = !division.isEmpty() && !address.toLowerCase(Locale.ROOT).contains(division.toLowerCase(Locale.ROOT))
                ? address + ", " + division : address;
        String phone = node.path("phone").asString("");
        ChannelOrderSnapshot.AddressSnapshot shipping = new ChannelOrderSnapshot.AddressSnapshot(
                first, last, phone, null, fullAddress, null, null, null, null, null, null, "BD");

        List<ChannelOrderItemSnapshot> items = new ArrayList<>();
        for (JsonNode item : node.path("items")) {
            int quantity = Math.max(item.path("quantity").asInt(1), 1);
            BigDecimal unit = money(item.path("unitPrice"));
            // A line of N units becomes N rows, like a marketplace order (one unit per row); the totals still agree.
            for (int unitNo = 1; unitNo <= quantity; unitNo++) {
                items.add(new ChannelOrderItemSnapshot(
                        number + "-" + item.path("productId").asString("") + "-" + unitNo, number,
                        item.path("sku").asString(null), null, null, item.path("name").asString(null), null,
                        unit, unit, status == null ? null : status.toLowerCase(Locale.ROOT), null, null, null, null,
                        null, null, null, created, updated));
            }
        }

        String payment = paymentName(node.path("paymentMethod").asString(null));
        String paymentStatus = node.path("paymentStatus").asString(null);
        String reference = node.path("paymentReference").asString(null);
        String email = node.path("email").asString(null);
        List<String> remarks = new ArrayList<>();
        if (paymentStatus != null) {
            remarks.add("Website payment " + paymentStatus.toLowerCase(Locale.ROOT));
        }
        if (reference != null && !reference.isBlank()) {
            remarks.add("ref " + reference.trim());
        }
        if (email != null && !email.isBlank()) {
            remarks.add(email.trim());
        }

        // The price is what the customer pays in all: the site's total (subtotal + delivery). The courier is asked to
        // collect that less what was already paid, so a paid order reaches Steadfast with nothing to collect (BR-203).
        BigDecimal total = money(node.path("total"));
        boolean paidOnline = paymentStatus != null && paymentStatus.trim().equalsIgnoreCase("PAID");
        return new ChannelOrderSnapshot(
                number, number, created, updated,
                total, money(node.path("delivery")),
                null, null, null, null, null, null, null,
                payment, null, items.size(),
                status == null ? List.of() : List.of(status),
                null, null, null, null,
                remarks.isEmpty() ? null : String.join(" · ", remarks),
                null, null, null, null, null, null,
                first, last, shipping, shipping, items,
                paidOnline ? total : null);
    }

    private static String paymentName(String code) {
        if (code == null) {
            return null;
        }
        return switch (code.trim().toUpperCase(Locale.ROOT)) {
            case "COD" -> "Cash on Delivery";
            case "BKASH" -> "bKash";
            case "NAGAD" -> "Nagad";
            case "BANK_TRANSFER" -> "Bank transfer";
            case "NPSB" -> "NPSB";
            default -> code.trim();
        };
    }

    private static BigDecimal money(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return null;
        }
        return new BigDecimal(node.asString()).setScale(2, RoundingMode.HALF_UP);
    }

    /** The storefront stores {@code YYYY-MM-DD HH:MM:SS} in UTC. */
    static Instant site(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(text.trim(), SITE_TIME).toInstant(ZoneOffset.UTC);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private record Memo(Instant after, Instant at, List<ChannelOrderSnapshot> orders) {
    }
}
