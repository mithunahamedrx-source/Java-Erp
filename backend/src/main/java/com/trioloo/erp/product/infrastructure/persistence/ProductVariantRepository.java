package com.trioloo.erp.product.infrastructure.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * {@code E-020} persistence.
 *
 * <p>Filtering and search run in the database, never in the client ({@code UX-044.b} — page
 * size is presentation and must never define a dataset). Every parameter is optional: a null
 * filter is not applied rather than matching nothing.
 */
public interface ProductVariantRepository extends JpaRepository<ProductVariantEntity, UUID> {

    Optional<ProductVariantEntity> findByInventorySkuIgnoreCase(String inventorySku);

    boolean existsByInventorySkuIgnoreCase(String inventorySku);

    /**
     * The canonical Stock Items query.
     *
     * <p>Search covers the three canonical searchable identifiers only — technical name,
     * Inventory SKU and barcode ({@code PRD-149}, {@code UX-039.a}). 🔴 Search is an
     * affordance for finding a record; it is never identity ({@code PRD-056}).
     */
    @Query("""
            SELECT v FROM ProductVariantEntity v
            WHERE (:search IS NULL
                   OR LOWER(v.technicalName) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                   OR LOWER(v.inventorySku)  LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                   OR LOWER(COALESCE(v.barcode, '')) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
              AND (:status IS NULL OR v.recordStatus = :status)
              AND (:category IS NULL OR LOWER(v.inventoryCategory) = LOWER(CAST(:category AS string)))
              AND (:brand IS NULL OR LOWER(v.brand) = LOWER(CAST(:brand AS string)))
              AND (:serialization IS NULL OR v.serializationPolicy = :serialization)
              AND (:componentClass IS NULL OR LOWER(v.componentClass) = LOWER(CAST(:componentClass AS string)))
            """)
    Page<ProductVariantEntity> search(@Param("search") String search,
                                      @Param("status") com.trioloo.erp.product.domain.RecordStatus status,
                                      @Param("category") String category,
                                      @Param("brand") String brand,
                                      @Param("serialization") com.trioloo.erp.product.domain.SerializationPolicy serialization,
                                      @Param("componentClass") String componentClass,
                                      Pageable pageable);

    /**
     * The SAME predicate, unpaged.
     *
     * <p>🔴 Used by the summary and by CSV export, both of which are
     * PAGINATION-INDEPENDENT ({@code UX-044.b}). Exporting or summarising only the visible
     * page would be silent truncation.
     */
    @Query("""
            SELECT v FROM ProductVariantEntity v
            WHERE (:search IS NULL
                   OR LOWER(v.technicalName) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                   OR LOWER(v.inventorySku)  LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                   OR LOWER(COALESCE(v.barcode, '')) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
              AND (:status IS NULL OR v.recordStatus = :status)
              AND (:category IS NULL OR LOWER(v.inventoryCategory) = LOWER(CAST(:category AS string)))
              AND (:brand IS NULL OR LOWER(v.brand) = LOWER(CAST(:brand AS string)))
              AND (:serialization IS NULL OR v.serializationPolicy = :serialization)
              AND (:componentClass IS NULL OR LOWER(v.componentClass) = LOWER(CAST(:componentClass AS string)))
            ORDER BY v.inventorySku ASC
            """)
    List<ProductVariantEntity> searchAll(@Param("search") String search,
                                         @Param("status") com.trioloo.erp.product.domain.RecordStatus status,
                                         @Param("category") String category,
                                         @Param("brand") String brand,
                                         @Param("serialization") com.trioloo.erp.product.domain.SerializationPolicy serialization,
                                         @Param("componentClass") String componentClass);
}
