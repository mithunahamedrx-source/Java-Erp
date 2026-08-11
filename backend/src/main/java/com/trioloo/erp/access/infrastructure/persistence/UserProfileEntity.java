package com.trioloo.erp.access.infrastructure.persistence;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Persistence mapping for {@code E-077} Operational User Profile.
 *
 * <p>Infrastructure layer. The domain never sees this type ({@code PRJ-021}, {@code PRJ-030}).
 *
 * <p>It carries no credential: the password hash lives in {@code user_credential} so that
 * reading an identity can never leak it.
 */
@Entity
@Table(name = "operational_user_profile")
public class UserProfileEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "username", nullable = false)
    private String username;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    /**
     * The canonical five-state lifecycle, stored as its name.
     *
     * <p>{@code EnumType.STRING} is deliberate: an ordinal would silently re-map every
     * existing row if a state were ever inserted into the enum.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "lifecycle_state", nullable = false)
    private AccountLifecycleState lifecycleState;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "activated_at")
    private Instant activatedAt;

    protected UserProfileEntity() {
        // JPA
    }

    public UserProfileEntity(UUID id, String username, String fullName,
                             AccountLifecycleState lifecycleState, Instant createdAt) {
        this.id = id;
        this.username = username;
        this.fullName = fullName;
        this.lifecycleState = lifecycleState;
        this.createdAt = createdAt;
    }

    /**
     * Applies the canonical {@code INVITED → ACTIVE} transition.
     *
     * <p>Called only after credentials have been successfully verified. Guarded by the
     * state itself, so it cannot run twice and cannot run from any other state.
     */
    public void activateOnFirstSuccessfulSignIn(Instant at) {
        if (!lifecycleState.activatesOnSuccessfulSignIn()) {
            throw new IllegalStateException(
                    "INVITED -> ACTIVE is only valid from INVITED, not " + lifecycleState);
        }
        this.lifecycleState = AccountLifecycleState.ACTIVE;
        this.activatedAt = at;
    }

    public UUID getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getFullName() {
        return fullName;
    }

    public AccountLifecycleState getLifecycleState() {
        return lifecycleState;
    }

    public Instant getActivatedAt() {
        return activatedAt;
    }
}
