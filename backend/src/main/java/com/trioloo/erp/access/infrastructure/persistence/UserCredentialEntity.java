package com.trioloo.erp.access.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Credential storage, deliberately separate from {@code E-077} identity.
 *
 * <p>Authentication mechanism and credential storage are engineering deliverables
 * ({@code API-044}, {@code AGV 2.2}, {@code PRM 2.2}). The separation is an engineering
 * choice: no identity read can leak a hash it does not join to.
 *
 * <p>🔴 The stored value is always a Spring Security {@code DelegatingPasswordEncoder}
 * string such as {@code {bcrypt}$2a$…}. Plaintext is never stored, and no password
 * expiry, history, reset, MFA or lockout policy is implied — none of those is canonically
 * specified and none is invented here.
 */
@Entity
@Table(name = "user_credential")
public class UserCredentialEntity {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserCredentialEntity() {
        // JPA
    }

    public UserCredentialEntity(UUID userId, String passwordHash, Instant updatedAt) {
        this.userId = userId;
        this.passwordHash = passwordHash;
        this.updatedAt = updatedAt;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getPasswordHash() {
        return passwordHash;
    }
}
