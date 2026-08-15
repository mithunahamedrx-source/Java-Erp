package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.ListingStatus;
import com.trioloo.erp.product.domain.LocalLifecycle;
import com.trioloo.erp.product.domain.SyncState;
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
 * {@code E-059} Channel Listing.
 *
 * <p>🔴 Every query below reaches the Sellable Product through a LEFT JOIN on
 * {@code E-106}. V5 used an inner join, which structurally forbade {@code UNMAPPED}
 * listings — the exact condition {@code PRD-178} makes valid and expects to describe most
 * listings immediately after a first discovery.
 *
 * <p>🔴 Search, filter, sort and pagination are SERVER-SIDE ({@code TEC-096},
 * {@code PRD-174.b}). The corpus is 3000+ listings and the browser never loads it.
 */
public interface ChannelListingRepository extends JpaRepository<ChannelListingEntity, UUID> {

    Optional<ChannelListingEntity> findByChannelInstanceIdAndExternalListingIdIgnoreCase(
            UUID channelInstanceId, String externalListingId);

    boolean existsByChannelInstanceIdAndExternalListingIdIgnoreCase(
            UUID channelInstanceId, String externalListingId);

    List<ChannelListingEntity> findByChannelInstanceId(UUID channelInstanceId);

    List<ChannelListingEntity> findByIdIn(Collection<UUID> ids);

    /**
     * The one predicate every listing query shares.
     *
     * <p>Each clause is a canonical dimension: channel instance ({@code PRD-028}), mapping
     * state ({@code PRD-178}), listing status ({@code PRD-128}), sync state
     * ({@code SYS §7.1}), divergence ({@code PRD-030}), unsent local changes
     * ({@code PRD-185.c}), publication intent and the ERP lifecycle ({@code PRD-188}).
     *
     * <p>🔴 {@code mapped} and {@code unsentOnly} are DERIVED here rather than read from a
     * stored column ({@code DB-001}). Unsent changes are intended content edited after the
     * last successful push — deliberately NOT the sync state, because {@code PENDING} means
     * an attempt is owed to the counterparty, which a purely local edit is not
     * ({@code PRD-185.d}).
     */
    String PREDICATE = """
            WHERE (:search IS NULL
                   OR LOWER(COALESCE(l.externalListingId, '')) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                   OR LOWER(COALESCE(l.intendedTitle, '')) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                   OR EXISTS (SELECT 1 FROM ChannelListingSkuEntity k
                              LEFT JOIN SellableProductEntity sp ON sp.id = k.sellableProductId
                              WHERE k.channelListingId = l.id
                                AND (LOWER(COALESCE(k.channelSku, '')) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))
                                     OR LOWER(COALESCE(sp.sellableSku, '')) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')))))
              AND (:channelCode IS NULL OR LOWER(c.code) = LOWER(CAST(:channelCode AS string)))
              AND (:listingStatus IS NULL OR l.listingStatus = :listingStatus)
              AND (:syncState IS NULL OR l.syncState = :syncState)
              AND (:lifecycle IS NULL OR l.localLifecycle = :lifecycle)
              AND (:publicationIntent IS NULL
                   OR LOWER(COALESCE(l.publicationIntent, '')) = LOWER(CAST(:publicationIntent AS string)))
              AND (:sellableProductId IS NULL
                   OR EXISTS (SELECT 1 FROM ChannelListingSkuEntity k2
                              WHERE k2.channelListingId = l.id
                                AND k2.sellableProductId = :sellableProductId))
              AND (:mapped IS NULL
                   OR (:mapped = TRUE  AND NOT EXISTS (SELECT 1 FROM ChannelListingSkuEntity k3
                                                       WHERE k3.channelListingId = l.id
                                                         AND k3.sellableProductId IS NULL))
                   OR (:mapped = FALSE AND EXISTS (SELECT 1 FROM ChannelListingSkuEntity k4
                                                   WHERE k4.channelListingId = l.id
                                                     AND k4.sellableProductId IS NULL)))
              AND (:divergedOnly = FALSE OR l.syncState = com.trioloo.erp.product.domain.SyncState.DIVERGED)
              AND (:unsentOnly = FALSE
                   OR (l.intendedContentUpdatedAt IS NOT NULL
                       AND (l.lastSuccessfulPushAt IS NULL
                            OR l.intendedContentUpdatedAt > l.lastSuccessfulPushAt)))
            """;

    @Query("SELECT l FROM ChannelListingEntity l "
            + "JOIN ChannelInstanceEntity c ON c.id = l.channelInstanceId "
            + PREDICATE)
    Page<ChannelListingEntity> search(@Param("search") String search,
                                      @Param("channelCode") String channelCode,
                                      @Param("listingStatus") ListingStatus listingStatus,
                                      @Param("syncState") SyncState syncState,
                                      @Param("lifecycle") LocalLifecycle lifecycle,
                                      @Param("publicationIntent") String publicationIntent,
                                      @Param("sellableProductId") UUID sellableProductId,
                                      @Param("mapped") Boolean mapped,
                                      @Param("divergedOnly") boolean divergedOnly,
                                      @Param("unsentOnly") boolean unsentOnly,
                                      Pageable pageable);

    /**
     * Identifiers only, for the filter-scoped selection ({@code PRD-187.c}).
     *
     * <p>🔴 Returns IDS, never entities. A filter-scoped selection of 1,842 listings is held
     * as a filter definition and is never materialised as rows in the browser
     * ({@code PRD-174.b}).
     */
    @Query("SELECT l.id FROM ChannelListingEntity l "
            + "JOIN ChannelInstanceEntity c ON c.id = l.channelInstanceId "
            + PREDICATE)
    List<UUID> searchIds(@Param("search") String search,
                         @Param("channelCode") String channelCode,
                         @Param("listingStatus") ListingStatus listingStatus,
                         @Param("syncState") SyncState syncState,
                         @Param("lifecycle") LocalLifecycle lifecycle,
                         @Param("publicationIntent") String publicationIntent,
                         @Param("sellableProductId") UUID sellableProductId,
                         @Param("mapped") Boolean mapped,
                         @Param("divergedOnly") boolean divergedOnly,
                         @Param("unsentOnly") boolean unsentOnly);

    /**
     * The five ratified summary facts, {@code UX-037} as applied to Listings.
     *
     * <p>🔴 Counted by the DATABASE over the authorised filtered result set, independent of
     * visible-page pagination ({@code UX-044}). The browser never counts 3000+ rows.
     *
     * <p>Returns one row: {@code [total, unmapped, diverged, unsent, manualRequired]}.
     */
    @Query("""
            SELECT COUNT(l),
                   SUM(CASE WHEN EXISTS (SELECT 1 FROM ChannelListingSkuEntity k5
                                         WHERE k5.channelListingId = l.id
                                           AND k5.sellableProductId IS NULL)
                            THEN 1 ELSE 0 END),
                   SUM(CASE WHEN l.syncState = com.trioloo.erp.product.domain.SyncState.DIVERGED
                            THEN 1 ELSE 0 END),
                   SUM(CASE WHEN l.intendedContentUpdatedAt IS NOT NULL
                                 AND (l.lastSuccessfulPushAt IS NULL
                                      OR l.intendedContentUpdatedAt > l.lastSuccessfulPushAt)
                            THEN 1 ELSE 0 END),
                   SUM(CASE WHEN l.syncState = com.trioloo.erp.product.domain.SyncState.MANUAL_REQUIRED
                            THEN 1 ELSE 0 END)
            FROM ChannelListingEntity l
            JOIN ChannelInstanceEntity c ON c.id = l.channelInstanceId
            """ + PREDICATE)
    List<Object[]> summarise(@Param("search") String search,
                             @Param("channelCode") String channelCode,
                             @Param("listingStatus") ListingStatus listingStatus,
                             @Param("syncState") SyncState syncState,
                             @Param("lifecycle") LocalLifecycle lifecycle,
                             @Param("publicationIntent") String publicationIntent,
                             @Param("sellableProductId") UUID sellableProductId,
                             @Param("mapped") Boolean mapped,
                             @Param("divergedOnly") boolean divergedOnly,
                             @Param("unsentOnly") boolean unsentOnly);

    /**
     * How many Listings inside a filtered scope belong to each channel instance.
     *
     * <p>🔴 AGGREGATED BY THE DATABASE over the SAME predicate the selection itself uses, so
     * the breakdown can never disagree with the count beside it ({@code UX-044}). The browser
     * never counts rows, and no identifier is loaded merely to produce a figure
     * ({@code PRD-174.b}).
     *
     * <p>Returns one row per channel as {@code [String name, Long count]}, ordered by name so
     * the breakdown is stable between reads.
     */
    @Query("SELECT c.name, COUNT(l) FROM ChannelListingEntity l "
            + "JOIN ChannelInstanceEntity c ON c.id = l.channelInstanceId "
            + PREDICATE
            + " GROUP BY c.name ORDER BY c.name")
    List<Object[]> countByChannel(@Param("search") String search,
                                  @Param("channelCode") String channelCode,
                                  @Param("listingStatus") ListingStatus listingStatus,
                                  @Param("syncState") SyncState syncState,
                                  @Param("lifecycle") LocalLifecycle lifecycle,
                                  @Param("publicationIntent") String publicationIntent,
                                  @Param("sellableProductId") UUID sellableProductId,
                                  @Param("mapped") Boolean mapped,
                                  @Param("divergedOnly") boolean divergedOnly,
                                  @Param("unsentOnly") boolean unsentOnly);

    /** Distinct channel instances inside a filtered scope, for selection reporting. */
    @Query("SELECT DISTINCT c.name FROM ChannelListingEntity l "
            + "JOIN ChannelInstanceEntity c ON c.id = l.channelInstanceId "
            + PREDICATE)
    List<String> distinctChannelNames(@Param("search") String search,
                                      @Param("channelCode") String channelCode,
                                      @Param("listingStatus") ListingStatus listingStatus,
                                      @Param("syncState") SyncState syncState,
                                      @Param("lifecycle") LocalLifecycle lifecycle,
                                      @Param("publicationIntent") String publicationIntent,
                                      @Param("sellableProductId") UUID sellableProductId,
                                      @Param("mapped") Boolean mapped,
                                      @Param("divergedOnly") boolean divergedOnly,
                                      @Param("unsentOnly") boolean unsentOnly);
}
