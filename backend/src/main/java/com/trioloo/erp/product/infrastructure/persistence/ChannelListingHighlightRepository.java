package com.trioloo.erp.product.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * A Channel Listing's own ordered highlights, {@code PRD-198}.
 *
 * <p>🔴 Every read is ordered by {@code position} — the AUTHORED sequence. Nothing here ever
 * relies on insertion or identifier order ({@code PRD-164.b}).
 */
public interface ChannelListingHighlightRepository
        extends JpaRepository<ChannelListingHighlightEntity, UUID> {

    List<ChannelListingHighlightEntity> findByChannelListingIdOrderByPositionAsc(UUID channelListingId);

    /**
     * One language's ordered set, {@code PRD-202.f}.
     *
     * <p>🔴 The sets are read SEPARATELY because they fall back ALL-OR-NOTHING. Reading them
     * together and filtering afterwards would invite a per-line merge, which is exactly what
     * the rule forbids.
     */
    List<ChannelListingHighlightEntity> findByChannelListingIdAndLanguageOrderByPositionAsc(
            UUID channelListingId, String language);

    List<ChannelListingHighlightEntity> findByChannelListingIdInOrderByPositionAsc(
            Collection<UUID> channelListingIds);

    void deleteByChannelListingId(UUID channelListingId);
}
