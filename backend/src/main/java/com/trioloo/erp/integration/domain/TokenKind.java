package com.trioloo.erp.integration.domain;

/**
 * Which piece of provider authorisation material a ciphertext holds.
 *
 * <p>🔴 THE CODE IS EXPLICIT AND PERMANENT. It is bound into the additional authenticated
 * data of every encrypted token, so it is part of the on-disk format. Reordering these
 * constants must never change a code — which is exactly why {@code ordinal()} is not used:
 * an innocent alphabetical tidy-up of the enum would otherwise invalidate every stored
 * credential in production at once, and the failure would look like key corruption.
 */
public enum TokenKind {

    ACCESS_TOKEN((byte) 1),
    REFRESH_TOKEN((byte) 2);

    private final byte code;

    TokenKind(byte code) {
        this.code = code;
    }

    /** The stable wire code. 🔴 Never derived from declaration order. */
    public byte code() {
        return code;
    }
}
