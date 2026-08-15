package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.OperationKind;
import com.trioloo.erp.product.domain.OperationOutcome;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * {@code E-107} Channel Listing Operation.
 *
 * <p>🔴 {@code INV-107.1} — per-listing outcomes are read individually. The counts below
 * are computed by GROUPING members, never by reading a stored aggregate
 * ({@code INV-108.2}, {@code DB-001}).
 */
public interface ChannelListingOperationRepository
        extends JpaRepository<ChannelListingOperationEntity, UUID> {

    /** {@code PRD-186.b} — members of one batch, server-paginated ({@code PRD-174.c}). */
    Page<ChannelListingOperationEntity> findByBatchIdOrderByRequestedAtAsc(UUID batchId,
                                                                          Pageable pageable);

    Page<ChannelListingOperationEntity> findByBatchIdAndOutcomeOrderByRequestedAtAsc(
            UUID batchId, OperationOutcome outcome, Pageable pageable);

    List<ChannelListingOperationEntity> findByBatchIdAndOutcome(UUID batchId,
                                                                OperationOutcome outcome);

    List<ChannelListingOperationEntity> findTop50ByChannelListingIdOrderByRequestedAtDesc(
            UUID channelListingId);

    /**
     * Operations of one kind still in flight for ONE listing.
     *
     * <p>🔴 Used to refuse a duplicate concurrent refresh of the SAME listing. ⚠ Scoped to the
     * listing deliberately: two different listings refreshing at once is ordinary.
     */
    List<ChannelListingOperationEntity> findByChannelListingIdAndOperationKindAndOutcomeIn(
            UUID channelListingId, OperationKind operationKind,
            Collection<OperationOutcome> outcomes);

    /**
     * {@code INV-108.2} — the batch aggregate, DERIVED by grouping its members.
     *
     * <p>Returns one row per distinct outcome as {@code [OperationOutcome, Long]}.
     */
    @Query("""
            SELECT o.outcome, COUNT(o)
            FROM ChannelListingOperationEntity o
            WHERE o.batchId = :batchId
            GROUP BY o.outcome
            """)
    List<Object[]> tallyByBatch(@Param("batchId") UUID batchId);
}
