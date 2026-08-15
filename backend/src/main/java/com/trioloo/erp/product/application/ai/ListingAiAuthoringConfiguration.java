package com.trioloo.erp.product.application.ai;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires the authoring port, {@code PRD-200.q}.
 *
 * <p>🔴 THE PORT ALWAYS RESOLVES. Product depends on the interface and never on whether a
 * provider exists: an absent assistant is answered by {@link UnconfiguredListingAiAuthoring}
 * saying so, not by a missing bean that would take the whole module down.
 *
 * <p>⚠ {@code ConditionalOnMissingBean} belongs on a {@code @Bean} METHOD — on a
 * component-scanned {@code @Component} it is never evaluated, and the fallback silently fails
 * to register.
 */
@Configuration
public class ListingAiAuthoringConfiguration {

    /** ⚠ Yields to a real AI Integration implementation the moment one is published. */
    @Bean
    @ConditionalOnMissingBean(ListingAiAuthoringPort.class)
    public ListingAiAuthoringPort unconfiguredListingAiAuthoring() {
        return new UnconfiguredListingAiAuthoring();
    }
}
