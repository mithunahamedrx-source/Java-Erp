package com.trioloo.erp.integration.infrastructure.daraz;

/**
 * The stored Daraz credential could not be made usable for a call.
 *
 * <p>🔴 IT CARRIES THE ONE DISTINCTION {@code DZC-011} EXISTS TO PROTECT: whether the seller must
 * authorise again, or whether this was our problem. Telling an operator to go and disturb a seller
 * because a signature was wrong or a host was unreachable is the failure that rule was written to
 * prevent, so the classification is a field rather than something a caller infers from a message.
 *
 * <p>🔴 {@link #reauthorisationRequired} IS TRUE ONLY ON EVIDENCE ABOUT THE CREDENTIAL ITSELF.
 * Daraz publishes NO error codes for the auth APIs ({@code DZC-011}), so there is no code list to
 * consult; the only deterministic evidence available is time-based and local — no refresh token
 * stored, a refresh token already past its expiry, or the provider answering
 * {@code refresh_expires_in = 0}, which the documentation states means the access token cannot be
 * refreshed. ⚠ EVERYTHING ELSE IS {@code ERROR}, including any unclassified non-zero envelope code.
 *
 * <p>🔴 THE MESSAGE IS BUILT FROM CLASSIFICATION ONLY. No token, refresh token, signature, request
 * URI, request body or provider response text can reach it, so a message that accidentally lands in
 * a log leaks nothing.
 */
public class DarazCredentialException extends RuntimeException {

    private final boolean reauthorisationRequired;

    private DarazCredentialException(String message, boolean reauthorisationRequired) {
        super(message, null, false, false);
        this.reauthorisationRequired = reauthorisationRequired;
    }

    /**
     * ⚠ The seller must authorise again. {@code DZC-011} — the credential itself is unusable and no
     * refresh can recover it.
     */
    public static DarazCredentialException reauthorisationRequired(String reason) {
        return new DarazCredentialException(reason, true);
    }

    /**
     * ⚠ Something else went wrong. 🔴 The seller is NOT disturbed: `DZC-011` keeps our own defects —
     * bad signature, bad app key, clock skew, an outage — away from a reauthorisation prompt.
     */
    public static DarazCredentialException error(String reason) {
        return new DarazCredentialException(reason, false);
    }

    /** ✅ True only where the CREDENTIAL is the thing that is unusable. */
    public boolean reauthorisationRequired() {
        return reauthorisationRequired;
    }
}
