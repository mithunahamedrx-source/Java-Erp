package com.trioloo.erp.product.infrastructure.persistence;

import com.trioloo.erp.product.domain.ActivityKind;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** Listing activity history, {@code PRD-129} as extended by {@code PRD-186.e}. */
public interface ChannelListingActivityRepository
        extends JpaRepository<ChannelListingActivityEntity, UUID> {

    Page<ChannelListingActivityEntity> findByChannelListingIdOrderByOccurredAtDesc(
            UUID channelListingId, Pageable pageable);

    Page<ChannelListingActivityEntity> findByChannelListingIdAndEntryKindOrderByOccurredAtDesc(
            UUID channelListingId, ActivityKind entryKind, Pageable pageable);
}
