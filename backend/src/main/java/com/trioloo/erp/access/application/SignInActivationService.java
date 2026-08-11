package com.trioloo.erp.access.application;

import com.trioloo.erp.access.infrastructure.persistence.UserProfileRepository;
import com.trioloo.erp.access.infrastructure.persistence.UserProfileEntity;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Applies the canonical {@code INVITED → ACTIVE} transition on first successful sign-in.
 *
 * <p>This transition is load-bearing: it is the one place the account lifecycle
 * ({@code PERMISSION_ARCHITECTURE.md} 7.1) advances as a side effect of authentication.
 *
 * <p>Guarantees:
 * <ul>
 *   <li><strong>Only after successful authentication.</strong> The caller invokes this
 *       after the {@code AuthenticationManager} has verified credentials, so a failed
 *       sign-in never activates anything.</li>
 *   <li><strong>Transactionally safe.</strong> The state change commits or does not happen.</li>
 *   <li><strong>Never twice.</strong> The entity guards the transition on its own state, so
 *       a second sign-in finds {@code ACTIVE} and does nothing.</li>
 *   <li><strong>Attribution at write time</strong> ({@code AGV-001}) — {@code activated_at}
 *       is stamped when the transition happens, not reconstructed later from a log.</li>
 * </ul>
 *
 * <p>Nothing immutable is rewritten: this advances current lifecycle state, which the
 * architecture models as mutable, and leaves history untouched ({@code PRM-021} keeps the
 * profile itself forever).
 */
@Service
public class SignInActivationService {

    private final UserProfileRepository profiles;
    private final Clock clock;

    public SignInActivationService(UserProfileRepository profiles, Clock clock) {
        this.profiles = profiles;
        this.clock = clock;
    }

    /**
     * Advances the profile if, and only if, it is {@code INVITED}.
     *
     * @return {@code true} when this call performed the activation
     */
    @Transactional
    public boolean activateIfFirstSignIn(UUID profileId) {
        UserProfileEntity profile = profiles.findById(profileId).orElseThrow(
                () -> new IllegalStateException("Authenticated profile not found: " + profileId));

        if (!profile.getLifecycleState().activatesOnSuccessfulSignIn()) {
            return false;
        }

        profile.activateOnFirstSuccessfulSignIn(Instant.now(clock));
        profiles.save(profile);
        return true;
    }
}
