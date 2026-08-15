package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.BuildTemplateStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** {@code E-060} persistence. */
public interface BuildTemplateRepository extends JpaRepository<BuildTemplateEntity, UUID> {

    /**
     * {@code INV-60.1} / {@code PRD-067} — the ONE {@code ACTIVE} version for a Sellable
     * Product. A partial unique index guarantees at most one, so {@link Optional} is exact
     * rather than a first-of-many.
     */
    Optional<BuildTemplateEntity> findBySellableProductIdAndTemplateStatus(
            UUID sellableProductId, BuildTemplateStatus templateStatus);

    /** 🔴 Every version, including {@code SUPERSEDED} ones — they are retained permanently. */
    List<BuildTemplateEntity> findBySellableProductIdOrderByVersionNumberDesc(UUID sellableProductId);

    /** The {@code ACTIVE} version of each of many Sellable Products, in one query — no N+1. */
    @Query("""
            SELECT t FROM BuildTemplateEntity t
            WHERE t.templateStatus = com.trioloo.erp.product.domain.BuildTemplateStatus.ACTIVE
              AND t.sellableProductId IN :ids
            """)
    List<BuildTemplateEntity> findActiveFor(@Param("ids") List<UUID> sellableProductIds);

    @Query("SELECT COALESCE(MAX(t.versionNumber), 0) FROM BuildTemplateEntity t "
            + "WHERE t.sellableProductId = :id")
    int highestVersionNumber(@Param("id") UUID sellableProductId);

    /** {@code PRD-065} — an Inventory Product may not be archived while an ACTIVE template uses it. */
    @Query("""
            SELECT COUNT(l) FROM BomLineEntity l, BuildTemplateEntity t
            WHERE l.buildTemplateId = t.id
              AND l.productVariantId = :variantId
              AND t.templateStatus = com.trioloo.erp.product.domain.BuildTemplateStatus.ACTIVE
            """)
    long countActiveUsesOfVariant(@Param("variantId") UUID variantId);
}
