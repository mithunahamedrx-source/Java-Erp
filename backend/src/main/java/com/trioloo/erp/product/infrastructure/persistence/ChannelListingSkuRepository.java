package com.trioloo.erp.product.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** {@code E-106} Channel Listing SKU — the orderable and mapping unit ({@code PRD-190}). */
public interface ChannelListingSkuRepository
        extends JpaRepository<ChannelListingSkuEntity, UUID> {

    List<ChannelListingSkuEntity> findByChannelListingIdOrderByPositionAsc(UUID channelListingId);

    List<ChannelListingSkuEntity> findByChannelListingIdInOrderByPositionAsc(
            Collection<UUID> channelListingIds);

    long countByChannelListingId(UUID channelListingId);
}
