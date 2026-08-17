package com.trioloo.erp.integration.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/**
 * 🔴 LOOKUP IS BY CHANNEL INSTANCE AND BY NOTHING ELSE ({@code API-071.a}).
 *
 * <p>There is deliberately no finder by token, no "find all credentials" and no projection:
 * a query that can return every secret in the system is one convenient caller away from
 * becoming an export, and an ambient "current credentials" lookup is exactly the mechanism
 * {@code API-071.b} forbids.
 */
public interface ChannelCredentialRepository extends JpaRepository<ChannelCredentialEntity, UUID> {
}
