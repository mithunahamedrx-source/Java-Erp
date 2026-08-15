package com.trioloo.erp.product.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** {@code E-059} channel-reported media — mirrored external references ({@code PRD-182}). */
public interface ChannelListingReportedMediaRepository
        extends JpaRepository<ChannelListingReportedMediaEntity, UUID> {

    List<ChannelListingReportedMediaEntity> findByChannelListingIdOrderByPositionAsc(
            UUID channelListingId);

    List<ChannelListingReportedMediaEntity> findByChannelListingIdInOrderByPositionAsc(
            Collection<UUID> channelListingIds);

    void deleteByChannelListingId(UUID channelListingId);
}
