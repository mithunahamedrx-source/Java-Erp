package com.trioloo.erp.system.infrastructure.persistence;

import com.trioloo.erp.system.domain.ChannelTypeCode;
import com.trioloo.erp.system.domain.ConfigurationState;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * {@code TEC-096} / {@code SCS-022.a} — SEARCH AND FILTERING ARE RESOLVED HERE, BY THE
 * SERVER. The browser never filters or counts, and no result is trimmed client-side.
 */
public interface ShopRepository extends JpaRepository<ShopEntity, UUID> {

    Optional<ShopEntity> findByCodeIgnoreCase(String code);

    boolean existsByChannelTypeAndExternalAccountIdentity(ChannelTypeCode channelType, String identity);

    /**
     * {@code SCS-022} — search scope is EXACTLY name, internal code and external link.
     *
     * <p>🔴 NOTHING ELSE. The external ACCOUNT IDENTITY is deliberately not searchable here:
     * the pack's placeholder names three fields and {@code SCS-022} fixes the scope to them,
     * so widening it would be an invented capability.
     *
     * <p>⚠ {@code restrictIds} carries the connection filter, which is resolved through
     * Integration's port before this query runs — the two modules stay separate and the
     * query still resolves in one server round trip.
     */
    @Query("""
            SELECT s FROM ShopEntity s
             WHERE (:search IS NULL
                    OR LOWER(s.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                    OR LOWER(s.code) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                    OR LOWER(COALESCE(s.externalLink, '')) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
               AND (:channelType IS NULL OR s.channelType = :channelType)
               AND (:configuration IS NULL OR s.configuration = :configuration)
               AND (:restricted = FALSE OR s.id IN :restrictIds)
            """)
    Page<ShopEntity> search(@Param("search") String search,
                            @Param("channelType") ChannelTypeCode channelType,
                            @Param("configuration") ConfigurationState configuration,
                            @Param("restricted") boolean restricted,
                            @Param("restrictIds") Collection<UUID> restrictIds,
                            Pageable pageable);

    /** The same predicate, unpaged — the basis for the summary and for the connection filter. */
    @Query("""
            SELECT s FROM ShopEntity s
             WHERE (:search IS NULL
                    OR LOWER(s.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                    OR LOWER(s.code) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                    OR LOWER(COALESCE(s.externalLink, '')) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))
               AND (:channelType IS NULL OR s.channelType = :channelType)
               AND (:configuration IS NULL OR s.configuration = :configuration)
            """)
    List<ShopEntity> searchAll(@Param("search") String search,
                               @Param("channelType") ChannelTypeCode channelType,
                               @Param("configuration") ConfigurationState configuration);

    /** {@code SCS-091} — the next ERP-assigned code. 🔴 Never operator-supplied. */
    @Query(value = "SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0)"
            + " FROM channel_instance WHERE code ~ '^CHN-[0-9]+$'", nativeQuery = true)
    int highestAssignedCodeNumber();
}
