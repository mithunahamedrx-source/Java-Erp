package com.trioloo.erp.product.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

/** {@code E-063} persistence. */
public interface BundleMemberRepository extends JpaRepository<BundleMemberEntity, UUID> {

    List<BundleMemberEntity> findByBundleIdOrderByPositionAsc(UUID bundleId);

    /** Members of many bundles, in one query. */
    List<BundleMemberEntity> findByBundleIdIn(List<UUID> bundleIds);

    /** 🔴 A member in use — an archival or delete path would have to answer to this. */
    long countByMemberSellableId(UUID memberSellableId);
}
