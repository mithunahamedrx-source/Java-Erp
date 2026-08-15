package com.trioloo.erp.product.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Field-level adapter capability, {@code PRD-125} / {@code API-063}. */
public interface ChannelAdapterCapabilityRepository
        extends JpaRepository<ChannelAdapterCapabilityEntity, UUID> {

    List<ChannelAdapterCapabilityEntity> findByChannelInstanceId(UUID channelInstanceId);

    List<ChannelAdapterCapabilityEntity> findByChannelInstanceIdIn(
            Collection<UUID> channelInstanceIds);
}
