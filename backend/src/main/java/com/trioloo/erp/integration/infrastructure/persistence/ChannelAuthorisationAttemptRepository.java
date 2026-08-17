package com.trioloo.erp.integration.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface ChannelAuthorisationAttemptRepository
        extends JpaRepository<ChannelAuthorisationAttemptEntity, UUID> {

    Optional<ChannelAuthorisationAttemptEntity> findByStateTokenHash(byte[] stateTokenHash);

    /**
     * Consumes an attempt exactly once.
     *
     * <p>🔴 THE GUARD IS IN THE STATEMENT, NOT IN JAVA. Unconsumed-ness and expiry are tested
     * in the same {@code UPDATE} that sets {@code consumed_at}, so the database — not
     * application sequencing — decides the winner. Read-then-write would let two concurrent
     * callbacks both observe {@code consumed_at IS NULL} and both proceed.
     *
     * @return 1 when this caller consumed the attempt, 0 when it was unknown, already
     *         consumed or expired. ⚠ Those are deliberately indistinguishable to the caller.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update ChannelAuthorisationAttemptEntity a
               set a.consumedAt = :now
             where a.stateTokenHash = :stateTokenHash
               and a.consumedAt is null
               and a.expiresAt > :now
            """)
    int consume(@Param("stateTokenHash") byte[] stateTokenHash, @Param("now") Instant now);
}
