package com.trioloo.erp.product.application;

import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SellableNature;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * A Sellable Product as the workspace needs it — {@code E-058} identity composed with its
 * nature-specific resolution target and its DERIVED availability.
 *
 * <p>🔴 A READ MODEL. Never persisted. Composing it transfers no ownership: Product owns
 * {@code E-058}, {@code E-060} and {@code E-063}; Inventory owns the component positions the
 * availability derives from ({@code DOC-005}).
 *
 * <p>🔴 THE RESOLUTION FIELDS ARE NATURE-SPECIFIC AND ARE NOT INTERCHANGEABLE
 * ({@code UX-035.a}, {@code PRD-021}). A {@code SIMPLE} product carries a Stock Item link; an
 * {@code ASSEMBLED} one carries a Build Template version; a {@code BUNDLE} carries members.
 * Exactly one group is populated, and forcing all three into common fields for visual symmetry
 * would reintroduce the conflation the three-layer model forbids.
 *
 * <p>🔴 ABSENT BY CANON, not by omission: any price ({@code E-059} owns channel price —
 * {@code PRD-029}), any cost, margin or profit ({@code PRD-123}, {@code GAP-112}), any listing
 * COUNT ({@code UX-037.f} — no canonical counting basis) and any image URL
 * ({@code UX-037.g}).
 *
 * @param availableSaleUnits {@code null} means NOT RESOLVABLE, never zero ({@code SYS-034}).
 */
public record SellableProductView(UUID id,
                                  String sellableSku,
                                  String name,
                                  SellableNature nature,
                                  String description,
                                  String sellableCategory,
                                  String warrantyPackage,
                                  RecordStatus recordStatus,

                                  // SIMPLE resolution (PRD-021) — a reference, never a copy.
                                  UUID simpleTargetVariantId,
                                  String simpleTargetInventorySku,
                                  String simpleTargetTechnicalName,
                                  BigDecimal simpleQuantityPerSaleUnit,

                                  // ASSEMBLED finished-unit identity (PRD-156) and build definition.
                                  UUID assembledFinishedVariantId,
                                  String assembledFinishedInventorySku,
                                  String assembledFinishedTechnicalName,

                                  // ASSEMBLED build definition (PRD-021, PRD-067).
                                  UUID activeBuildTemplateId,
                                  Integer activeBuildTemplateVersion,
                                  Integer buildTemplateRequiredLineCount,

                                  // BUNDLE resolution (PRD-021, PRD-047). The member count's
                                  // basis IS canonical — an ordered member list — unlike the
                                  // prohibited "used in N builds" (UX-037.f).
                                  Integer bundleMemberCount,

                                  // PRD-023 derived availability. Never stored.
                                  BigDecimal availableSaleUnits,
                                  String availabilityConstrainedBy,
                                  String availabilityUnresolvedReason,

                                  Instant updatedAt,
                                  long version) {
}
