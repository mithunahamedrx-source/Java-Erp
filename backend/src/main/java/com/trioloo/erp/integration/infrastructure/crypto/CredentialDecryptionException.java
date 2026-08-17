package com.trioloo.erp.integration.infrastructure.crypto;

/**
 * Stored provider material could not be decrypted under the context it was presented with.
 *
 * <p>🔴 ONE EXCEPTION FOR EVERY CAUSE, AND IT CARRIES NOTHING. Wrong shop, wrong token kind,
 * wrong key, retired key version, tampered ciphertext, tampered tag and unreadable framing all
 * arrive here identically. Separating them would turn this class into an oracle: an attacker
 * probing substituted ciphertexts would learn which axis they got wrong and could search each
 * one independently.
 *
 * <p>⚠ It carries no message, no cause and no material — not the blob, not the key version,
 * not the owner — because exception text reaches logs.
 */
public class CredentialDecryptionException extends RuntimeException {

    public CredentialDecryptionException() {
        super("Stored integration credential material could not be decrypted.", null, false, false);
    }
}
