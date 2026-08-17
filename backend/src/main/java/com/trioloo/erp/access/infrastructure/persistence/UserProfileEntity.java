package com.trioloo.erp.access.infrastructure.persistence;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.domain.OwnerDesignationOrigin;
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

    /**
     * {@code AGV-037} — the Owner authority DESIGNATION, carried here on the profile.
     *
     * <p>🔴 NOT A ROLE, NOT AN OVERRIDE, NOT A SCOPE GRANT ({@code AGV-039}). {@code null}
     * means this profile is not an Owner, and nothing else in the model can make it one.
     */
    @Column(name = "owner_designated_at")
    private Instant ownerDesignatedAt;

    /**
     * {@code AGV-038} — the existing Owner who granted the designation.
     *
     * <p>🔴 {@code null} FOR THE FIRST OWNER, because none existed. See
     * {@link #ownerDesignationOrigin}; the database refuses any other combination.
     */
    @Column(name = "owner_designated_by")
    private UUID ownerDesignatedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "owner_designation_origin", length = 24)
    private OwnerDesignationOrigin ownerDesignationOrigin;

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

    /**
     * {@code AGV-037} — whether this profile currently carries the Owner designation.
     *
     * <p>🔴 THE ONLY ANSWER TO "IS THIS AN OWNER". It is not derived from a username, a role,
     * an override, a scope or row order ({@code AGV-039}).
     */
    public boolean isOwner() {
        return ownerDesignatedAt != null;
    }

    public Instant getOwnerDesignatedAt() {
        return ownerDesignatedAt;
    }

    public UUID getOwnerDesignatedBy() {
        return ownerDesignatedBy;
    }

    public OwnerDesignationOrigin getOwnerDesignationOrigin() {
        return ownerDesignationOrigin;
    }

    /**
     * Designates this profile as the ONE-TIME FIRST Owner ({@code GAP-120}).
     *
     * <p>🔴 RECORDS NO DESIGNATING OWNER, AND THAT IS DELIBERATE: at initial bootstrap none
     * existed, and naming one — least of all this same profile — would put a grant in the
     * audit record that never occurred ({@code AGV-041}).
     *
     * <p>⚠ Refuses if this profile is already an Owner. The system-wide one-time guard is
     * the caller's transaction plus the database's partial unique index ({@code V13}); this
     * is the aggregate refusing to contradict itself.
     */
    public void designateAsInitialOwner(Instant at) {
        if (isOwner()) {
            throw new IllegalStateException("This profile already carries the Owner designation (AGV-037)");
        }
        this.ownerDesignatedAt = at;
        this.ownerDesignatedBy = null;
        this.ownerDesignationOrigin = OwnerDesignationOrigin.INITIAL_BOOTSTRAP;
    }

    public Instant getActivatedAt() {
        return activatedAt;
    }
}
