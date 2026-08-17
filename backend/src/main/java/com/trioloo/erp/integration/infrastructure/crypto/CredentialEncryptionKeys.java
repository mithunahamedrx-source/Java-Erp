package com.trioloo.erp.integration.infrastructure.crypto;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The versioned AES-256 key set used to protect provider authorisation material at rest.
 *
 * <p>🔴 THE KEYS NEVER ENTER THE DATABASE. They arrive only from environment configuration
 * — {@code INTEGRATION_CREDENTIAL_ENCRYPTION_KEYS} and
 * {@code INTEGRATION_CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION} — so a database dump, on its
 * own, contains nothing usable. That separation is the point of encrypting at rest at all.
 *
 * <p><strong>Grammar.</strong> {@code keys := entry ("," entry)*}, {@code entry := version ":" base64}.
 * Several versions coexist so that a key can be rotated without decrypting every row at once:
 * new writes use the active version, and old rows stay readable under the version recorded
 * against them.
 *
 * <p>⚠ THE VALUE IS PARSED HERE RATHER THAN BOUND AS A MAP. It is read as one scalar string,
 * exactly like every other setting in this application, and taken apart by code that can be
 * tested directly. Relying on relaxed binding to assemble a map of secrets from environment
 * variables would put the most security-sensitive configuration in the system at the mercy of
 * framework naming rules.
 *
 * <p>🔴 CONFIGURED-BUT-BROKEN FAILS AT STARTUP. Malformed configuration is refused
 * immediately, because the alternative is discovering it at the moment an operator is trying
 * to connect a shop.
 *
 * <p>⚠ ABSENT IS NOT AN ERROR, AND THAT IS DELIBERATE. No provider adapter exists yet, so an
 * environment that has not configured a key has nothing to protect. Making the key mandatory
 * would stop an application that does not yet use it from starting at all. Absence is instead
 * carried as a reason and thrown loudly at first USE — see {@link #keyFor} — so the feature can
 * never quietly operate unprotected.
 *
 * <p>🔴 NO MESSAGE IN THIS CLASS EVER CONTAINS KEY MATERIAL, a fragment of it, or its decoded
 * length. A validation failure names the structural fault and, at most, the offending version
 * number.
 */
@Component
public class CredentialEncryptionKeys {

    /** AES-256. A key of any other size is refused rather than silently weakening the cipher. */
    private static final int REQUIRED_KEY_BYTES = 32;

    private static final int MIN_VERSION = 1;

    /** Bound by {@code smallint} in the schema and by the {@code u16} AAD field. */
    private static final int MAX_VERSION = 32767;

    private final Map<Short, SecretKey> keys;
    private final Short activeVersion;

    /** Null when a usable key set is configured; otherwise why it is unusable. */
    private final String unavailableReason;

    public CredentialEncryptionKeys(
            @Value("${integration.credential.encryption.keys:}") String rawKeys,
            @Value("${integration.credential.encryption.active-key-version:}") String rawActiveVersion) {

        String keysValue = rawKeys == null ? "" : rawKeys.trim();
        String activeValue = rawActiveVersion == null ? "" : rawActiveVersion.trim();

        if (keysValue.isEmpty() && activeValue.isEmpty()) {
            this.keys = Map.of();
            this.activeVersion = null;
            this.unavailableReason = "No integration credential encryption key is configured. "
                    + "Set INTEGRATION_CREDENTIAL_ENCRYPTION_KEYS and "
                    + "INTEGRATION_CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION.";
            return;
        }

        /*
          🔴 HALF-CONFIGURED IS A FAULT, NOT AN ABSENCE. One variable set without the other is
          always a mistake, and treating it as "not configured" would hide it.
        */
        if (keysValue.isEmpty()) {
            throw new IllegalStateException(configFault(
                    "INTEGRATION_CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION is set but "
                            + "INTEGRATION_CREDENTIAL_ENCRYPTION_KEYS is empty"));
        }
        if (activeValue.isEmpty()) {
            throw new IllegalStateException(configFault(
                    "INTEGRATION_CREDENTIAL_ENCRYPTION_KEYS is set but "
                            + "INTEGRATION_CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION is empty"));
        }

        this.keys = parseKeys(keysValue);
        this.activeVersion = parseActiveVersion(activeValue, this.keys);
        this.unavailableReason = null;
    }

    private static Map<Short, SecretKey> parseKeys(String value) {
        Map<Short, SecretKey> parsed = new LinkedHashMap<>();

        for (String rawEntry : value.split(",", -1)) {
            String entry = rawEntry.trim();
            if (entry.isEmpty()) {
                throw new IllegalStateException(configFault(
                        "INTEGRATION_CREDENTIAL_ENCRYPTION_KEYS contains an empty entry"));
            }

            int separator = entry.indexOf(':');
            if (separator < 0) {
                throw new IllegalStateException(configFault(
                        "an entry is not in the required 'version:base64key' form"));
            }

            short version = parseVersion(entry.substring(0, separator).trim());

            byte[] keyBytes = decodeKey(entry.substring(separator + 1).trim(), version);
            if (keyBytes.length != REQUIRED_KEY_BYTES) {
                /* ⚠ The FAULT names the version only. The decoded length is not reported: it
                   narrows the search space for anyone reading a log. */
                java.util.Arrays.fill(keyBytes, (byte) 0);
                throw new IllegalStateException(configFault(
                        "key version " + version + " does not decode to a 256-bit key"));
            }

            if (parsed.putIfAbsent(version, new SecretKeySpec(keyBytes, "AES")) != null) {
                throw new IllegalStateException(configFault(
                        "key version " + version + " is declared more than once"));
            }
        }

        if (parsed.isEmpty()) {
            throw new IllegalStateException(configFault(
                    "INTEGRATION_CREDENTIAL_ENCRYPTION_KEYS declares no key"));
        }
        return Map.copyOf(parsed);
    }

    private static short parseVersion(String raw) {
        int version;
        try {
            version = Integer.parseInt(raw);
        } catch (NumberFormatException e) {
            throw new IllegalStateException(configFault("a key version is not a number"));
        }
        if (version < MIN_VERSION || version > MAX_VERSION) {
            throw new IllegalStateException(configFault(
                    "key version " + version + " is outside the permitted range "
                            + MIN_VERSION + ".." + MAX_VERSION));
        }
        return (short) version;
    }

    private static byte[] decodeKey(String encoded, short version) {
        try {
            return Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException e) {
            /* 🔴 The cause is deliberately NOT chained: its message can quote the offending
               input, which is the key itself. */
            throw new IllegalStateException(configFault(
                    "key version " + version + " is not valid Base64"));
        }
    }

    private static Short parseActiveVersion(String raw, Map<Short, SecretKey> keys) {
        short active = parseVersion(raw);
        if (!keys.containsKey(active)) {
            throw new IllegalStateException(configFault(
                    "the active key version " + active + " is not present in the configured key set"));
        }
        return active;
    }

    private static String configFault(String detail) {
        return "Integration credential encryption configuration is invalid: " + detail + ".";
    }

    /** Whether a usable key set is configured. */
    public boolean isConfigured() {
        return unavailableReason == null;
    }

    /** The version new material is encrypted under. */
    public short activeVersion() {
        requireConfigured();
        return activeVersion;
    }

    /**
     * The key for one version.
     *
     * @throws IllegalStateException if no key set is configured — 🔴 the loud failure that
     *                               makes an unconfigured environment unable to store a secret
     *                               rather than able to store it unprotected.
     * @throws IllegalArgumentException if that version is not configured, which is what a row
     *                                  encrypted under a retired key looks like.
     */
    public SecretKey keyFor(short version) {
        requireConfigured();
        SecretKey key = keys.get(version);
        if (key == null) {
            throw new IllegalArgumentException(
                    "No integration credential encryption key is configured for version " + version + ".");
        }
        return key;
    }

    private void requireConfigured() {
        if (unavailableReason != null) {
            throw new IllegalStateException(unavailableReason);
        }
    }
}
