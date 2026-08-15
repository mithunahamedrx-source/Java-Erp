package com.trioloo.erp.product.infrastructure.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/** {@code E-108} Channel Listing Operation Batch. */
public interface ChannelListingOperationBatchRepository
        extends JpaRepository<ChannelListingOperationBatchEntity, UUID> {

    Page<ChannelListingOperationBatchEntity> findAllByOrderByRequestedAtDesc(Pageable pageable);
}
