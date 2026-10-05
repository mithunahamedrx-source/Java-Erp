package com.trioloo.erp.integration.infrastructure.website;

import com.trioloo.erp.order.application.ChannelOrderWriteback;
import com.trioloo.erp.order.domain.CanonicalOrderStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

/**
 * Changes an order's status on the storefront, so its admin panel follows the ERP (cancel, reopen, confirm).
 *
 * <p>🔴 THE ONLY WRITE THIS APPLICATION MAKES TO THE STOREFRONT, and only to {@code PATCH /erp/orders/{number}}.
 * The storefront adjusts its own stock on cancel and reopen; the ERP does not.
 */
@Component
public class WebsiteOrderStatusClient implements ChannelOrderWriteback {

    private final WebsiteProperties properties;
    private final WebsiteTransport transport;
    private final ObjectMapper json = new ObjectMapper();

    public WebsiteOrderStatusClient(WebsiteProperties properties, WebsiteTransport transport) {
        this.properties = properties;
        this.transport = transport;
    }

    @Override
    public String channelType() {
        return WebsiteChannelOrderProvider.CHANNEL_TYPE;
    }

    @Override
    public void publish(String externalOrderId, CanonicalOrderStatus status) {
        String word = websiteWord(status);
        if (word == null) {
            throw new WebsiteException("The website has no word for " + status + ".");
        }
        if (!properties.isConfigured()) {
            throw new WebsiteException("the website is not connected");
        }
        WebsiteTransport.Response response = transport.patch(
                properties.baseUrl() + "/erp/orders/" + externalOrderId.replaceAll("[^A-Za-z0-9_-]", ""),
                "{\"status\":\"" + word + "\"}",
                Map.of("X-ERP-Key", properties.erpKey(), "Accept", "application/json"));
        if (response.status() == 200) {
            return;
        }
        String reason = switch (response.status()) {
            case 401 -> "the website refused the ERP key";
            case 404 -> "the website has no such order";
            case 503 -> "the website's ERP integration is switched off";
            default -> "the website answered HTTP " + response.status();
        };
        if (response.status() == 409) {
            try {
                reason = json.readTree(response.body()).path("error").path("message").asString(reason);
            } catch (RuntimeException ignored) {
                // keep the generic reason
            }
        }
        throw new WebsiteException(reason);
    }

    /** The storefront's own order words: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED. */
    static String websiteWord(CanonicalOrderStatus status) {
        return switch (status) {
            case CANCELLED -> "CANCELLED";
            case PENDING_VERIFICATION -> "PENDING";
            case CONFIRMED, READY_TO_SHIP, COURIER_BOOKED -> "CONFIRMED";
            case DISPATCHED -> "SHIPPED";
            case DELIVERED -> "DELIVERED";
            default -> null;
        };
    }
}
