package com.trioloo.erp.product.application.channel;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The ERP intent an adapter is asked to send, {@code PRD-171} / {@code API-062.b}.
 *
 * <p>🔴 Carries only the fields the adapter DECLARED writable ({@code API-063.a}). A field
 * the channel cannot accept is excluded here and reported to the operator as excluded, never
 * silently dropped at transport time.
 *
 * <p>🔴 The media list is the EFFECTIVE intended media resolved by {@code PRD-170} — the
 * listing's own override where it has one, otherwise the mapped Sellable Product's master
 * media. {@code PRD-171.a} makes that resolution the outbound intent, not merely a display
 * convenience.
 */
public record OutboundListingPayload(UUID listingId,
                                     String externalListingId,
                                     String title,
                                     String description,
                                     BigDecimal salePrice,
                                     BigDecimal promotionPrice,
                                     Instant promotionStartsAt,
                                     Instant promotionEndsAt,
                                     BigDecimal listingStock,
                                     String channelCategoryRef,
                                     Map<String, String> attributes,
                                     List<String> mediaReferences,
                                     List<OutboundSku> skus,
                                     String publicationIntent) {

    /** One orderable channel SKU's outbound figures, {@code PRD-190.b}. */
    /**
     * One orderable channel SKU's outbound figures, {@code PRD-190.b}.
     *
     * <p>🔴 {@code PRD-199.h} — the base price and the promotion travel SEPARATELY. Where the adapter
     * declared only one of them writable, the other is omitted and reported to the operator
     * as omitted. 🔴 One is NEVER substituted for the other.
     */
    public record OutboundSku(String channelSku,
                              BigDecimal salePrice,
                              BigDecimal promotionPrice,
                              Instant promotionStartsAt,
                              Instant promotionEndsAt,
                              BigDecimal listingStock) {
    }
}
