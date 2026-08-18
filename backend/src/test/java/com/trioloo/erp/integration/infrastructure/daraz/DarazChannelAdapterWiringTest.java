package com.trioloo.erp.integration.infrastructure.daraz;

import com.trioloo.erp.product.application.channel.ChannelAdapterPort;
import com.trioloo.erp.product.application.channel.ChannelAdapterRegistry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Whether the Daraz adapter is registered at all — and it is a decision, not an accident.
 *
 * <p>🔴 AN UNCONFIGURED ADAPTER WOULD BE WORSE THAN NO ADAPTER. It would resolve in the registry,
 * declare capability, and then fail every call for want of an App Key — which an operator reads as
 * a broken integration. {@link ChannelAdapterRegistry#noAdapterDetail} is the honest message while
 * no bean exists, so the bean is conditional on the credentials it needs.
 *
 * <p>⚠ THIS ALSO KEEPS EVERY OTHER TEST HONEST. Suites that assert "no marketplace adapter is
 * configured" for a `DARAZ` channel are asserting the real behaviour of an unconfigured
 * deployment, and they keep passing because the condition is genuinely unmet there.
 */
class DarazChannelAdapterWiringTest {

    @Nested
    @SpringBootTest
    @DisplayName("with no Daraz credentials configured")
    class Unconfigured {

        @Autowired ChannelAdapterRegistry registry;

        @Test
        @DisplayName("🔴 no Daraz adapter is registered, and the registry says so honestly")
        void noAdapterRegistered() {
            assertThat(registry.forChannelType("DARAZ")).isEmpty();
            assertThat(registry.hasAdapterFor("DARAZ")).isFalse();
        }
    }

    @Nested
    @SpringBootTest
    @TestPropertySource(properties = {
            "integration.daraz.app-key=000000-test-app-key",
            "integration.daraz.app-secret=test-app-secret-not-a-real-value",
            "integration.daraz.oauth-redirect-uri=https://example.test/api/integration/daraz/callback",
    })
    @DisplayName("with Daraz credentials configured")
    class Configured {

        @Autowired ChannelAdapterRegistry registry;
        @Autowired(required = false) DarazChannelAdapter adapter;

        @Test
        @DisplayName("✅ the adapter is a Spring bean and the registry resolves DARAZ to it")
        void registryResolvesDaraz() {
            assertThat(adapter).isNotNull();

            Optional<ChannelAdapterPort> resolved = registry.forChannelType("DARAZ");
            assertThat(resolved).isPresent();
            assertThat(resolved.get()).isSameAs(adapter);
            assertThat(registry.hasAdapterFor("DARAZ")).isTrue();
        }

        /** ⚠ Channel type matching is case-insensitive in the registry; the stored value is upper. */
        @Test
        @DisplayName("the registry matches the channel type however it is cased")
        void resolutionIsCaseInsensitive() {
            assertThat(registry.forChannelType("daraz")).isPresent();
        }

        @Test
        @DisplayName("✅ the adapter declares readable Listing facts, so refresh is not refused for nothing")
        void declaresReadableFacts() {
            /* `ChannelListingOperationService` gates refresh on this; declaring nothing readable
               would refuse every read with "no readable Listing facts". */
            assertThat(registry.declaresReadableListingFacts(
                    "DARAZ", java.util.UUID.randomUUID())).isTrue();
        }
    }
}
