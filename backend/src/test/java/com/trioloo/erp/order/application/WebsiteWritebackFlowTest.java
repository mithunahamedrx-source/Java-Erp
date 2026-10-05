package com.trioloo.erp.order.application;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
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
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.TestPropertySource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The storefront follows the ERP (BR-202): cancel, reopen and ready-to-ship are written back, a marketplace never is,
 * and a refused write never undoes the ERP's own act.
 */
@SpringBootTest
@TestPropertySource(properties = "integration.website.erp-key=test-website-erp-key-0000000000000000")
@DisplayName("Website order write-back")
class WebsiteWritebackFlowTest {

    private static final List<String> PATCHES = new ArrayList<>();
    private static int patchStatus = 200;

    @TestConfiguration
    static class StubTransport {
        @Bean
        @Primary
        WebsiteTransport websiteTransport() {
            return new WebsiteTransport() {
                @Override
                public Response get(String url, Map<String, String> headers) {
                    return new Response(200, "{\"data\":[],\"meta\":{\"count\":0}}");
                }

                @Override
                public Response patch(String url, String body, Map<String, String> headers) {
                    PATCHES.add(url.substring(url.indexOf("/erp/")) + " " + body);
                    return new Response(patchStatus, "{}");
                }
            };
        }
    }

    @Autowired
    private OrderLifecycleService lifecycle;
    @Autowired
    private JdbcTemplate jdbc;

    private UUID actorId;

    @BeforeEach
    void setUp() {
        PATCHES.clear();
        patchStatus = 200;
        clean();
        actorId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO operational_user_profile (id, username, full_name, lifecycle_state, created_at, activated_at)
                VALUES (?, ?, ?, 'ACTIVE', now(), now())
                """, actorId, "wbf-tester-" + actorId, "Writeback Tester");
        var principal = new AccessUserDetails(actorId, "wbf-tester", "Writeback Tester", "unused",
                AccountLifecycleState.ACTIVE, Set.of(),
                Set.of(OrderPermissions.ORDER_CANCEL, OrderPermissions.ORDER_RESTORE));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null,
                Arrays.stream(new String[] {OrderPermissions.ORDER_CANCEL, OrderPermissions.ORDER_RESTORE})
                        .map(SimpleGrantedAuthority::new).toList()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clean();
    }

    @Test
    @DisplayName("cancel and restore of a website order tell the site, and the ERP cancels it directly")
    void tellsTheSite() {
        UUID id = order("WBF-SHOP-W", "WEBSITE", "ZT-WBF-1");

        OrderLifecycleService.Outcome cancelled = lifecycle.cancel(id, "CHANGED_MIND", null);
        assertThat(cancelled.canonicalStatus()).isEqualTo("CANCELLED");
        assertThat(cancelled.marketplaceNote()).contains("website order was cancelled");
        assertThat(PATCHES).containsExactly("/erp/orders/ZT-WBF-1 {\"status\":\"CANCELLED\"}");

        OrderLifecycleService.Outcome restored = lifecycle.restore(id);
        assertThat(restored.marketplaceNote()).contains("reopened");
        assertThat(PATCHES).containsExactly(
                "/erp/orders/ZT-WBF-1 {\"status\":\"CANCELLED\"}",
                "/erp/orders/ZT-WBF-1 {\"status\":\"PENDING\"}");
    }

    @Test
    @DisplayName("a refused write is reported, and the ERP's cancellation stands")
    void refusedWriteDoesNotUndo() {
        UUID id = order("WBF-SHOP-W2", "WEBSITE", "ZT-WBF-2");
        patchStatus = 404;

        OrderLifecycleService.Outcome cancelled = lifecycle.cancel(id, "CHANGED_MIND", null);

        assertThat(cancelled.canonicalStatus()).isEqualTo("CANCELLED");
        assertThat(cancelled.marketplaceNote()).contains("NOT updated").contains("no such order");
        assertThat(jdbc.queryForObject("SELECT cancelled_at IS NOT NULL FROM channel_order WHERE id = ?",
                Boolean.class, id)).isTrue();
    }

    @Test
    @DisplayName("a Daraz order is never written to")
    void marketplaceIsNeverWrittenTo() {
        UUID id = order("WBF-SHOP-D", "DARAZ", "WBF-DZ-1");

        OrderLifecycleService.Outcome cancelled = lifecycle.cancel(id, "CHANGED_MIND", null);

        assertThat(PATCHES).isEmpty();
        assertThat(cancelled.marketplaceNote()).contains("marketplace is not told");
    }

    private UUID order(String shopCode, String channelType, String externalId) {
        UUID shop = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type, record_status, market)
                VALUES (?, ?, ?, ?, 'ACTIVE', 'BANGLADESH')
                """, shop, shopCode + "-" + shop, "WBF Shop", channelType);
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_order (id, channel_instance_id, external_order_id, order_number,
                    trioloo_invoice_number, ownership, statuses_json, canonical_statuses_json,
                    price, shipping_first_name, shipping_phone, shipping_address1,
                    provider_created_at, imported_at, last_seen_at)
                VALUES (?, ?, ?, ?, ?, 'API_MANAGED', '["PENDING"]'::jsonb, '["PENDING_VERIFICATION"]'::jsonb,
                        100.00, 'Rahim', '01700000000', 'Dhaka', now(), now(), now())
                """, id, shop, externalId, externalId, "TR" + Math.abs(id.hashCode()));
        return id;
    }

    private void clean() {
        String shops = "(SELECT id FROM channel_instance WHERE code LIKE 'WBF-SHOP-%')";
        jdbc.update("DELETE FROM channel_order_item WHERE channel_order_id IN "
                + "(SELECT id FROM channel_order WHERE channel_instance_id IN " + shops + ")");
        jdbc.update("DELETE FROM channel_order WHERE channel_instance_id IN " + shops);
        jdbc.update("DELETE FROM channel_connection WHERE channel_instance_id IN " + shops);
        jdbc.update("DELETE FROM channel_instance WHERE code LIKE 'WBF-SHOP-%'");
        jdbc.update("DELETE FROM operational_user_profile WHERE username LIKE 'wbf-tester-%'");
    }
}
