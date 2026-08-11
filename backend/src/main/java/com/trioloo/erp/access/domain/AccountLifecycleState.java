package com.trioloo.erp.access.domain;

/**
 * The canonical account lifecycle from {@code PERMISSION_ARCHITECTURE.md} 7.1.
 *
 * <p>{@code INVITED → ACTIVE} (first successful sign-in) · {@code INVITED → EXPIRED} ·
 * {@code ACTIVE ↔ SUSPENDED} · {@code ACTIVE/SUSPENDED → DISABLED} ·
 * {@code DISABLED → ACTIVE} (rejoined).
 *
 * <p>🔴 This is deliberately NOT a boolean. {@code SUSPENDED}, {@code DISABLED} and
 * {@code EXPIRED} are canonically distinct and carry different business meaning:
 * {@code PRM-021} keeps a user record forever, and {@code DISABLED} removes access without
 * removing the person from history.
 *
 * <p>Domain layer: no Spring, no Jakarta Persistence, no Jackson ({@code PRJ-021}).
 */
public enum AccountLifecycleState {

    /** Account created, never signed in. Authenticating for the first time activates it. */
    INVITED,

    /** The only steady state that may authenticate. */
    ACTIVE,

    /** Temporarily blocked. May be reinstated to {@code ACTIVE}. */
    SUSPENDED,

    /** Left the organisation. Access removed; history retained ({@code PRM-021}). */
    DISABLED,

    /** The invitation lapsed before first sign-in. Terminal. */
    EXPIRED;

    /**
     * Whether an account in this state may complete authentication.
     *
     * <p>{@code INVITED} may: its first successful sign-in is precisely what activates it.
     * Everything except {@code INVITED} and {@code ACTIVE} is refused — deny by default
     * ({@code PRM} P3).
     */
    public boolean mayAuthenticate() {
        return this == ACTIVE || this == INVITED;
    }

    /**
     * Whether a successful authentication in this state triggers the canonical
     * {@code INVITED → ACTIVE} activation.
     *
     * <p>Only ever true for {@code INVITED}, so the transition cannot happen twice.
     */
    public boolean activatesOnSuccessfulSignIn() {
        return this == INVITED;
    }
}
