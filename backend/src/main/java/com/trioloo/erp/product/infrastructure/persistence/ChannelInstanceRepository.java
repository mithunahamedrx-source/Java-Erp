package com.trioloo.erp.product.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ChannelInstanceRepository extends JpaRepository<ChannelInstanceEntity, UUID> {
    Optional<ChannelInstanceEntity> findByCodeIgnoreCase(String code);
}
