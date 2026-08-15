package com.trioloo.erp.product.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** {@code E-061} persistence. */
public interface BomLineRepository extends JpaRepository<BomLineEntity, UUID> {

    List<BomLineEntity> findByBuildTemplateIdOrderByPositionAsc(UUID buildTemplateId);

    /** Every line of many templates, in one query — the availability derivation has no N+1. */
    List<BomLineEntity> findByBuildTemplateIdIn(List<UUID> buildTemplateIds);

    long countByBuildTemplateIdAndOptionalFalse(UUID buildTemplateId);

    void deleteByBuildTemplateId(UUID buildTemplateId);
}
