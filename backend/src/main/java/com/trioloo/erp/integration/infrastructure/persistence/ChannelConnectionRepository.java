package com.trioloo.erp.integration.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ChannelConnectionRepository extends JpaRepository<ChannelConnectionEntity, UUID> {

    List<ChannelConnectionEntity> findByChannelInstanceIdIn(Collection<UUID> channelInstanceIds);
}
