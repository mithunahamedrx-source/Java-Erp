package com.trioloo.erp.product.application.channel;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One orderable channel SKU as the adapter observed it, {@code PRD-190}.
 *
 * <p>🔴 {@code variationLabel} is the channel's OWN reported text, e.g. "16GB RAM · 512GB
 * SSD". Product stores it opaquely: the option/axis schema is adapter-owned
 * ({@code PRD-190.g}) and is never decomposed here.
 */
public record ReportedSkuSnapshot(

        String channelSku,

        BigDecimal salePrice,
        boolean salePriceReadable,

        /** 🔴 {@code PRD-197.e} — declared and reported independently of the Sale Price. */
        BigDecimal promotionPrice,
        /**
         * 🔴 {@code SYS-034} — {@code false} means the adapter could not READ the promotion
         * price. ⚠ It NEVER means the channel has no promotion: absence of a report is not a
         * report of absence.
         */
        boolean promotionPriceReadable,
        Instant promotionStartsAt,
        Instant promotionEndsAt,
        boolean promotionWindowReadable,

        BigDecimal stock,
        boolean stockReadable,

        String variationLabel) {
}
