package com.trioloo.erp.integration.infrastructure.crypto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The key set is the one piece of configuration whose failure mode is silent.
 *
 * <p>⚠ A wrong database password stops the application immediately. A quietly wrong key set
 * does not: material gets written under a key nobody intended, or the feature runs
 * unprotected, and nothing complains until a shop cannot be reconnected. So the validation is
 * strict and it runs at construction.
 *
 * <p>🔴 AND IT MUST NOT TALK. Config errors reach logs and issue trackers; a message that
 * quotes the offending value would publish the key.
 */
class CredentialEncryptionKeysTest {

    private static final String VALID_A = base64Of("trioloo-test-key-not-a-secret!!!");
    private static final String VALID_B = base64Of("trioloo-test-key-TWO-not-secret!");

    private static String base64Of(String raw) {
        byte[] bytes = raw.getBytes(StandardCharsets.UTF_8);
        if (bytes.length != 32) {
            throw new IllegalStateException("Test fixture must be 32 bytes, was " + bytes.length);
        }
        return Base64.getEncoder().encodeToString(bytes);
    }

    // ------------------------------------------------------------------ accepted

    @Test
    @DisplayName("a single valid key is accepted and becomes active")
    void singleValidKey() {
        CredentialEncryptionKeys keys = new CredentialEncryptionKeys("1:" + VALID_A, "1");

        assertThat(keys.isConfigured()).isTrue();
        assertThat(keys.activeVersion()).isEqualTo((short) 1);
        assertThat(keys.keyFor((short) 1)).isNotNull();
    }

    @Test
    @DisplayName("several versions coexist so a key can be rotated without a mass re-encrypt")
    void multipleVersions() {
        CredentialEncryptionKeys keys = new CredentialEncryptionKeys(
                "1:" + VALID_A + ",2:" + VALID_B, "2");

        assertThat(keys.activeVersion()).isEqualTo((short) 2);
        assertThat(keys.keyFor((short) 1)).isNotNull();   // old rows stay readable
        assertThat(keys.keyFor((short) 2)).isNotNull();
    }

    @Test
    @DisplayName("surrounding whitespace is tolerated")
    void entriesAreTrimmed() {
        assertThatCode(() -> new CredentialEncryptionKeys(
                "  1: " + VALID_A + " , 2 : " + VALID_B + "  ", " 2 "))
                .doesNotThrowAnyException();
    }

    // ------------------------------------------------------------------ refused

    @Test
    @DisplayName("a duplicate key version is refused")
    void duplicateVersionRefused() {
        assertThatThrownBy(() -> new CredentialEncryptionKeys("1:" + VALID_A + ",1:" + VALID_B, "1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("declared more than once");
    }

    @Test
    @DisplayName("invalid Base64 is refused")
    void invalidBase64Refused() {
        assertThatThrownBy(() -> new CredentialEncryptionKeys("1:not-valid-base64!!!", "1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not valid Base64");
    }

    @Test
    @DisplayName("a key that is not 256 bits is refused")
    void wrongKeyLengthRefused() {
        String tooShort = Base64.getEncoder().encodeToString("short".getBytes(StandardCharsets.UTF_8));

        assertThatThrownBy(() -> new CredentialEncryptionKeys("1:" + tooShort, "1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("256-bit");
    }

    @Test
    @DisplayName("an active version that is not in the key set is refused")
    void activeVersionMissingRefused() {
        assertThatThrownBy(() -> new CredentialEncryptionKeys("1:" + VALID_A, "7"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not present in the configured key set");
    }

    @Test
    @DisplayName("a malformed entry is refused")
    void malformedEntryRefused() {
        assertThatThrownBy(() -> new CredentialEncryptionKeys(VALID_A, "1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("version:base64key");

        assertThatThrownBy(() -> new CredentialEncryptionKeys("1:" + VALID_A + ",", "1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("empty entry");

        assertThatThrownBy(() -> new CredentialEncryptionKeys("x:" + VALID_A, "1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not a number");
    }

    @Test
    @DisplayName("a version outside 1..32767 is refused")
    void versionRangeEnforced() {
        assertThatThrownBy(() -> new CredentialEncryptionKeys("0:" + VALID_A, "0"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("outside the permitted range");

        assertThatThrownBy(() -> new CredentialEncryptionKeys("40000:" + VALID_A, "40000"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("outside the permitted range");
    }

    /** 🔴 Half-configured is always a mistake; treating it as "absent" would hide it. */
    @Test
    @DisplayName("configuring one variable without the other is a fault, not an absence")
    void halfConfiguredRefused() {
        assertThatThrownBy(() -> new CredentialEncryptionKeys("1:" + VALID_A, ""))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ACTIVE_KEY_VERSION is empty");

        assertThatThrownBy(() -> new CredentialEncryptionKeys("", "1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("ENCRYPTION_KEYS is empty");
    }

    // ------------------------------------------------------------------ absence

    /**
     * ⚠ Absence is not an error at STARTUP — no adapter exists yet, so there is nothing to
     * protect and an unconfigured environment must still boot. It is an error at USE, which is
     * what stops the feature ever running unprotected.
     */
    @Test
    @DisplayName("an unconfigured key set starts, but refuses loudly at first use")
    void unconfiguredStartsButRefusesUse() {
        CredentialEncryptionKeys keys = new CredentialEncryptionKeys("", "");

        assertThat(keys.isConfigured()).isFalse();
        assertThatThrownBy(keys::activeVersion)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("INTEGRATION_CREDENTIAL_ENCRYPTION_KEYS");
        assertThatThrownBy(() -> keys.keyFor((short) 1))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("an unconfigured version is refused")
    void unknownVersionRefused() {
        CredentialEncryptionKeys keys = new CredentialEncryptionKeys("1:" + VALID_A, "1");

        assertThatThrownBy(() -> keys.keyFor((short) 9))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("version 9");
    }

    // ------------------------------------------------------------------ leakage

    /** 🔴 The whole point of the careful message construction. */
    @Test
    @DisplayName("no validation failure ever quotes key material")
    void validationErrorsLeakNothing() {
        String[][] badConfigs = {
                {"1:" + VALID_A + ",1:" + VALID_B, "1"},
                {"1:" + VALID_A, "7"},
                {"1:" + VALID_A + "!!!", "1"},
        };

        for (String[] config : badConfigs) {
            assertThatThrownBy(() -> new CredentialEncryptionKeys(config[0], config[1]))
                    .isInstanceOf(IllegalStateException.class)
                    .satisfies(e -> {
                        assertThat(e.getMessage()).doesNotContain(VALID_A);
                        assertThat(e.getMessage()).doesNotContain(VALID_B);
                        /* Not even a recognisable prefix of the encoded key. */
                        assertThat(e.getMessage()).doesNotContain(VALID_A.substring(0, 12));
                        assertThat(e.getMessage()).doesNotContain("trioloo-test-key");
                        /* And no chained cause that might quote it either. */
                        assertThat(e.getCause()).isNull();
                    });
        }
    }
}
