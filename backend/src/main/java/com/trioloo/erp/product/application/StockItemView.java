package com.trioloo.erp.product.application;

import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SerializationPolicy;
import com.trioloo.erp.platform.money.MonetaryAmount;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * A Stock Item as the workspace needs it — Product identity composed with derived Inventory
 * position and, where authorised, Inventory Costing valuation.
 *
 * <p>🔴 A READ MODEL. It is never persisted, and composing it transfers no ownership: Product
 * still owns {@code E-020}, Inventory still owns the position, Costing still owns the
 * valuation ({@code DOC-005}).
 *
 * <p>🔴 {@code stockValue} is {@code null} when the actor lacks
 * {@code inventory-costing.valuation.view}. Null means WITHHELD and is serialised as an absent
 * field — never as {@code 0}, because permission denied is not a measured zero
 * ({@code ICO-038.a}, {@code SYS-034}).
 */
public record StockItemView(UUID id,
                            String inventorySku,
                            String technicalName,
                            String brand,
                            String inventoryCategory,
                            String unitOfMeasure,
                            String barcode,
                            SerializationPolicy serializationPolicy,
                            String componentClass,
                            RecordStatus recordStatus,
                            BigDecimal physicalStock,
                            BigDecimal availableQuantity,
                            boolean outOfStock,
                            @MonetaryAmount BigDecimal weightedAverageCost,
                            @MonetaryAmount BigDecimal stockValue,
                            Instant updatedAt,
                            long version) {
}
