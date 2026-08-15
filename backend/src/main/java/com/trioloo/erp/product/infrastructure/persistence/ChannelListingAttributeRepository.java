package com.trioloo.erp.product.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Neutral channel attributes carried by a listing, {@code PRD-192}. */
public interface ChannelListingAttributeRepository
        extends JpaRepository<ChannelListingAttributeEntity, UUID> {

    List<ChannelListingAttributeEntity> findByChannelListingIdOrderByPositionAsc(
            UUID channelListingId);

    List<ChannelListingAttributeEntity> findByChannelListingIdInOrderByPositionAsc(
            Collection<UUID> channelListingIds);

    Optional<ChannelListingAttributeEntity> findByChannelListingIdAndAttributeKey(
            UUID channelListingId, String attributeKey);
}
