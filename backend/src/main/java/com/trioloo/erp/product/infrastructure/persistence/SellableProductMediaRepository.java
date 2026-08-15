package com.trioloo.erp.product.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** {@code E-058} master media references, {@code PRD-168}. */
public interface SellableProductMediaRepository
        extends JpaRepository<SellableProductMediaEntity, UUID> {

    List<SellableProductMediaEntity> findBySellableProductIdOrderByPositionAsc(UUID sellableProductId);

    List<SellableProductMediaEntity> findBySellableProductIdInOrderByPositionAsc(
            Collection<UUID> sellableProductIds);
}
