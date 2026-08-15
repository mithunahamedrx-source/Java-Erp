package com.trioloo.erp.product.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** {@code E-059} intended listing media — the override set ({@code PRD-170}). */
public interface ChannelListingIntendedMediaRepository
        extends JpaRepository<ChannelListingIntendedMediaEntity, UUID> {

    List<ChannelListingIntendedMediaEntity> findByChannelListingIdOrderByPositionAsc(
            UUID channelListingId);

    List<ChannelListingIntendedMediaEntity> findByChannelListingIdInOrderByPositionAsc(
            Collection<UUID> channelListingIds);

    void deleteByChannelListingId(UUID channelListingId);
}
