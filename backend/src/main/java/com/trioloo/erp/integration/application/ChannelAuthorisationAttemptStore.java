package com.trioloo.erp.integration.application;

import com.trioloo.erp.integration.infrastructure.persistence.ChannelAuthorisationAttemptEntity;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelAuthorisationAttemptRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

/**
 * Issues and consumes the one-time state that ties an authorisation callback to the shop that
 * started it.
 *
 * <p>🔴 THE CALLBACK NEVER CHOOSES THE SHOP. {@link #issue} records the Channel Instance
 * before the operator leaves for the provider; {@link #consume} returns THAT instance and
 * ignores anything the callback claims. A caller cannot pass a shop id in and have it
 * honoured, because there is no parameter for one.
 *
 * <p>🔴 ONLY THE HASH IS PERSISTED. The nonce is returned once, to the flow that is about to
 * put it in a redirect URL, and never written down. A stolen database backup therefore yields
 * no forgeable state.
 */
@Service
public class ChannelAuthorisationAttemptStore {

    /** 32 bytes of entropy. Guessing is not a threat model at this width. */
    private static final int NONCE_BYTES = 32;

    private final ChannelAuthorisationAttemptRepository attempts;
    private final SecureRandom random = new SecureRandom();

    public ChannelAuthorisationAttemptStore(ChannelAuthorisationAttemptRepository attempts) {
        this.attempts = attempts;
    }

    /**
     * The state value, returned exactly once.
     *
     * <p>⚠ URL-safe and unpadded so it survives a redirect query string untouched.
     * 🔴 NEVER LOG THIS. Holding it is sufficient to consume the attempt.
     */
    public record IssuedState(UUID attemptId, String state) {
        @Override
        public String toString() {
            return "IssuedState[" + attemptId + ", state=REDACTED]";
        }
    }

    /** The facts a consumed attempt proves. These are TRUSTED; the callback's own data is not. */
    public record ConsumedAttempt(UUID attemptId, UUID channelInstanceId, UUID initiatedBy) {
    }

    /**
     * Starts an authorisation attempt for one shop.
     *
     * @param expiresAt when the attempt stops being usable — short, because a redirect that
     *                  has not returned promptly has been abandoned, not paused.
     */
    @Transactional
    public IssuedState issue(UUID channelInstanceId, UUID initiatedBy, Instant now, Instant expiresAt) {
        byte[] nonce = new byte[NONCE_BYTES];
        random.nextBytes(nonce);
        String state = Base64.getUrlEncoder().withoutPadding().encodeToString(nonce);

        UUID attemptId = UUID.randomUUID();
        attempts.save(ChannelAuthorisationAttemptEntity.issued(
                attemptId, sha256(state), channelInstanceId, initiatedBy, now, expiresAt));

        return new IssuedState(attemptId, state);
    }

    /**
     * Consumes a returning state, exactly once.
     *
     * <p>🔴 UNKNOWN, EXPIRED AND ALREADY-CONSUMED ALL RETURN EMPTY, INDISTINGUISHABLY. Telling
     * them apart would let a caller probe which states exist. Of two concurrent callbacks
     * presenting the same state, the conditional {@code UPDATE} lets exactly one through.
     *
     * <p>🔴 IT COMMITS IN ITS OWN TRANSACTION, AND THAT IS THE POINT. Completion continues into a
     * provider call that can fail. If consumption shared the caller's transaction, that failure
     * would ROLL THE CONSUMPTION BACK — and the state, already presented to the provider, would
     * become usable again. That is not a one-time state.
     *
     * <p>⚠ THIS WAS A REAL PRODUCTION FAULT, NOT A THEORETICAL ONE. A failing token exchange rolled
     * back {@code consumed_at}, so the database showed five untouched attempts while the callback
     * had in fact reached the provider every time — the evidence erased itself and the incident
     * looked like a state-matching bug it never was.
     *
     * <p>✅ BURNING THE STATE ON FAILURE IS THE CORRECT OUTCOME. The authorisation code behind it is
     * already spent at the provider, so a retry could not have succeeded anyway; the operator starts
     * a fresh attempt, which is exactly what {@code SCS-044}'s not-completed outcome invites.
     *
     * @return the trusted correlation facts, or empty if the state may not be used.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<ConsumedAttempt> consume(String state, Instant now) {
        if (state == null || state.isBlank()) {
            return Optional.empty();
        }
        byte[] hash = sha256(state);

        if (attempts.consume(hash, now) != 1) {
            return Optional.empty();
        }

        /* We won the race, so this row is ours to read. */
        return attempts.findByStateTokenHash(hash)
                .map(a -> new ConsumedAttempt(a.getId(), a.getChannelInstanceId(), a.getInitiatedBy()));
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable in this JVM.");
        }
    }
}
