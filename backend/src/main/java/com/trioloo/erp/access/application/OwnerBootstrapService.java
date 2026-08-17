package com.trioloo.erp.access.application;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.infrastructure.persistence.UserCredentialEntity;
import com.trioloo.erp.access.infrastructure.persistence.UserCredentialRepository;
import com.trioloo.erp.access.infrastructure.persistence.UserProfileEntity;
import com.trioloo.erp.access.infrastructure.persistence.UserProfileRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * Creates the FIRST Owner — the one act {@code AGV-038} cannot perform ({@code GAP-120}).
 *
 * <p>🔴 {@code AGV-038} grants Owner status only through an existing Owner, and
 * {@code AGV-011} creates accounts only through an authorised Owner or Administrator.
 * Neither can produce the first one. This service is the single, explicit, one-time
 * exception — and it is reachable ONLY from the server-side bootstrap command.
 *
 * <p>🔴 NO HTTP SURFACE EXISTS FOR THIS, AND NONE MAY BE ADDED. A public route that creates
 * a privileged account is the defect this whole design avoids.
 *
 * <p>🔴 IT INVENTS NO AUTHORITY MODEL. It writes the canonical designation ({@code AGV-037})
 * onto {@code E-077}; it creates no Owner role, no override bundle and no scope grant
 * ({@code AGV-039}).
 */
@Service
public class OwnerBootstrapService {

    private final UserProfileRepository profiles;
    private final UserCredentialRepository credentials;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public OwnerBootstrapService(UserProfileRepository profiles,
                                 UserCredentialRepository credentials,
                                 PasswordEncoder passwordEncoder,
                                 Clock clock) {
        this.profiles = profiles;
        this.credentials = credentials;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    /** Why a bootstrap attempt did not create an Owner. */
    public static class BootstrapRefusedException extends RuntimeException {
        public BootstrapRefusedException(String message) {
            super(message);
        }
    }

    /**
     * Creates the first Owner, atomically.
     *
     * <p>🔴 ALL OR NOTHING ({@code @Transactional}): profile, credential and designation
     * commit together or not at all. A half-created privileged account — a profile with no
     * credential, or a credential with no designation — is never left behind.
     *
     * <p>🔴 THE ONE-TIME GUARD IS CHECKED INSIDE THE TRANSACTION, and the database's partial
     * unique index on the bootstrap origin ({@code V13}) is what makes it safe when two
     * processes run at once: one commits, the other fails to. No external lock service is
     * introduced ({@code TEC-065}).
     *
     * <p>🔴 THE PLAINTEXT PASSWORD IS USED ONCE, TO HASH, AND IS NEVER STORED OR LOGGED. It
     * goes through the application's own {@link PasswordEncoder}; no hashing is written here.
     *
     * <p>⚠ The profile is created {@code INVITED}, not {@code ACTIVE}. That is the canonical
     * lifecycle: {@code SignInActivationService} performs {@code INVITED → ACTIVE} on the
     * first successful sign-in, and stamping an {@code activated_at} for a sign-in that has
     * not happened would fabricate an attribution ({@code AGV-001}).
     *
     * @param password consumed for hashing only; the caller must not retain or print it
     * @return the identifier of the created Owner profile
     */
    @Transactional
    public UUID bootstrapFirstOwner(String username, String fullName, char[] password) {
        String cleanUsername = require(username, "username");
        String cleanFullName = require(fullName, "full name");
        requirePassword(password);

        if (profiles.countOwners() > 0) {
            throw new BootstrapRefusedException(
                    "Bootstrap refused: an Owner already exists. Further Owners are designated "
                            + "by an existing Owner (AGV-038), never by this command.");
        }
        if (profiles.findByUsername(cleanUsername).isPresent()) {
            throw new BootstrapRefusedException(
                    "Bootstrap refused: the username '" + cleanUsername + "' is already taken.");
        }

        Instant now = Instant.now(clock);
        UUID id = UUID.randomUUID();

        UserProfileEntity profile = new UserProfileEntity(
                id, cleanUsername, cleanFullName, AccountLifecycleState.INVITED, now);
        /* 🔴 AGV-037 — the designation, carried on the profile. Not a role (AGV-039). */
        profile.designateAsInitialOwner(now);
        profiles.save(profile);

        credentials.save(new UserCredentialEntity(id, passwordEncoder.encode(
                java.nio.CharBuffer.wrap(password)), now));

        return id;
    }

    private static String require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new BootstrapRefusedException("Bootstrap refused: " + field + " is required.");
        }
        return value.trim();
    }

    /**
     * ⚠ NON-EMPTY IS THE ONLY RULE, AND THAT IS DELIBERATE. No canonical password policy
     * exists — {@code UserCredentialEntity} records that no expiry, history, reset, MFA or
     * lockout policy is specified — so inventing complexity requirements here would be
     * exactly the business invention {@code CLAUDE.md} §5 forbids. Reported, not decided.
     */
    private static void requirePassword(char[] password) {
        if (password == null || password.length == 0) {
            throw new BootstrapRefusedException("Bootstrap refused: a password is required.");
        }
        for (char c : password) {
            if (!Character.isWhitespace(c)) {
                return;
            }
        }
        throw new BootstrapRefusedException("Bootstrap refused: a password is required.");
    }
}
