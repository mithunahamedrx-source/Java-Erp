package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SellableNature;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * {@code E-058} persistence.
 *
 * <p>Filtering and search run in the database. 🔴 Search covers the two canonical searchable
 * identifiers only — market-facing NAME and Sellable SKU ({@code UX-039.a}, {@code PRD-011},
 * {@code PRD-017}). It is an affordance for finding a record and is NEVER identity
 * ({@code PRD-056}, {@code PRD-146}).
 */
public interface SellableProductRepository extends JpaRepository<SellableProductEntity, UUID> {

    Optional<SellableProductEntity> findBySellableSkuIgnoreCase(String sellableSku);

    boolean existsBySellableSkuIgnoreCase(String sellableSku);

    List<SellableProductEntity> findByIdIn(List<UUID> ids);

    /** 🔴 {@code PRD-065} applied to the sellable layer — used to refuse an unsafe archival. */
    long countBySimpleTargetVariantIdAndRecordStatus(UUID variantId, RecordStatus recordStatus);

    @Query("""
            SELECT s FROM SellableProductEntity s
            WHERE (:search IS NULL
                   OR LOWER(s.name)        LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                   OR LOWER(s.sellableSku) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
              AND (:nature IS NULL OR s.nature = :nature)
              AND (:status IS NULL OR s.recordStatus = :status)
              AND (:category IS NULL OR LOWER(s.sellableCategory) = LOWER(CAST(:category AS string)))
            """)
    Page<SellableProductEntity> search(@Param("search") String search,
                                       @Param("nature") SellableNature nature,
                                       @Param("status") RecordStatus status,
                                       @Param("category") String category,
                                       Pageable pageable);

    /**
     * The SAME predicate, unpaged.
     *
     * <p>🔴 The basis for the summary and for CSV export, both PAGINATION-INDEPENDENT
     * ({@code UX-044.b}). Exporting or summarising the visible page would be silent truncation.
     */
    @Query("""
            SELECT s FROM SellableProductEntity s
            WHERE (:search IS NULL
                   OR LOWER(s.name)        LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                   OR LOWER(s.sellableSku) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
              AND (:nature IS NULL OR s.nature = :nature)
              AND (:status IS NULL OR s.recordStatus = :status)
              AND (:category IS NULL OR LOWER(s.sellableCategory) = LOWER(CAST(:category AS string)))
            ORDER BY s.sellableSku ASC
            """)
    List<SellableProductEntity> searchAll(@Param("search") String search,
                                          @Param("nature") SellableNature nature,
                                          @Param("status") RecordStatus status,
                                          @Param("category") String category);
}
