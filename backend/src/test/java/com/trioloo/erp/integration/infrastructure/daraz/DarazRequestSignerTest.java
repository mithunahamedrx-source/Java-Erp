package com.trioloo.erp.integration.infrastructure.daraz;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The signer against the official contract.
 *
 * <p>⚠ A signature test that only checks "64 hex characters" passes for a completely wrong
 * canonical string. These assert the CONSTRUCTION as well as the digest, because a wrong
 * canonical string and a wrong key are indistinguishable from the output alone — and the
 * provider's rejection message names neither.
 */
class DarazRequestSignerTest {

    private final DarazRequestSigner signer = new DarazRequestSigner();

    private static final String SECRET = "test-app-secret-not-a-real-value";

    /** An independent HMAC-SHA256, so the signer is checked against JCA rather than itself. */
    private static String referenceHmac(String data, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] d = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : d) {
            sb.append(String.format("%02X", b));
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------ canonical string

    /** The documented worked example: sorted names, key immediately followed by value. */
    @Test
    @DisplayName("the canonical string is the API path followed by ASCII-sorted name+value pairs")
    void canonicalStringMatchesTheDocumentedExample() {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("foo", "1");
        params.put("bar", "2");
        params.put("foo_bar", "3");
        params.put("foobar", "4");

        assertThat(signer.canonicalString("/test/api", params, null))
                .isEqualTo("/test/apibar2foo1foo_bar3foobar4");
    }

    @Test
    @DisplayName("insertion order cannot change the signature")
    void insertionOrderIsIrrelevant() {
        Map<String, String> forward = new LinkedHashMap<>();
        forward.put("a", "1");
        forward.put("b", "2");
        forward.put("c", "3");

        Map<String, String> reversed = new LinkedHashMap<>();
        reversed.put("c", "3");
        reversed.put("b", "2");
        reversed.put("a", "1");

        assertThat(signer.sign("/seller/get", forward, null, SECRET))
                .isEqualTo(signer.sign("/seller/get", reversed, null, SECRET));
        /* And a TreeMap, which is already sorted, agrees too. */
        assertThat(signer.sign("/seller/get", new TreeMap<>(forward), null, SECRET))
                .isEqualTo(signer.sign("/seller/get", forward, null, SECRET));
    }

    /** 🔴 `sign` carries the RESULT, so it can never be part of the INPUT. */
    @Test
    @DisplayName("an existing sign parameter is excluded from the canonical string")
    void signParameterIsExcluded() {
        Map<String, String> withoutSign = new LinkedHashMap<>();
        withoutSign.put("app_key", "12345");
        withoutSign.put("timestamp", "1520045034634");

        Map<String, String> withStaleSign = new LinkedHashMap<>(withoutSign);
        withStaleSign.put("sign", "AABBCCDDEEFF00112233445566778899AABBCCDDEEFF001122334455667788AA");

        assertThat(signer.canonicalString("/auth/token/create", withStaleSign, null))
                .isEqualTo(signer.canonicalString("/auth/token/create", withoutSign, null));
        assertThat(signer.sign("/auth/token/create", withStaleSign, null, SECRET))
                .isEqualTo(signer.sign("/auth/token/create", withoutSign, null, SECRET));
    }

    @Test
    @DisplayName("a null-valued parameter is not signed, because it is not sent")
    void nullValuesAreOmitted() {
        Map<String, String> withNull = new LinkedHashMap<>();
        withNull.put("app_key", "12345");
        withNull.put("optional", null);

        assertThat(signer.canonicalString("/seller/get", withNull, null))
                .isEqualTo("/seller/getapp_key12345");
    }

    // ------------------------------------------------------------------ path binding

    /**
     * 🔴 THE FAILURE THIS PREVENTS IS INVISIBLE. Omitting the API path still yields a valid-looking
     * 64-character signature; the gateway simply rejects every request, and says nothing about why.
     */
    @Test
    @DisplayName("identical parameters signed for different API paths produce different signatures")
    void apiPathIsPartOfTheSignature() {
        Map<String, String> params = Map.of("app_key", "12345", "timestamp", "1520045034634");

        String create = signer.sign("/auth/token/create", params, null, SECRET);
        String seller = signer.sign("/seller/get", params, null, SECRET);

        assertThat(create).isNotEqualTo(seller);
    }

    @Test
    @DisplayName("the API path is signed verbatim, not normalised")
    void apiPathIsNotNormalised() {
        Map<String, String> params = Map.of("a", "1");

        assertThat(signer.canonicalString("/auth/token/create", params, null))
                .startsWith("/auth/token/create");
        /* A trailing slash is a different string to the provider, so it must stay different here. */
        assertThat(signer.sign("/auth/token/create", params, null, SECRET))
                .isNotEqualTo(signer.sign("/auth/token/create/", params, null, SECRET));
    }

    // ------------------------------------------------------------------ body

    @Test
    @DisplayName("a request body is appended after the parameters and changes the signature")
    void bodyParticipates() {
        Map<String, String> params = Map.of("app_key", "12345");

        assertThat(signer.canonicalString("/product/create", params, "<Request/>"))
                .isEqualTo("/product/createapp_key12345<Request/>");
        assertThat(signer.sign("/product/create", params, "<Request/>", SECRET))
                .isNotEqualTo(signer.sign("/product/create", params, "<Request2/>", SECRET));
    }

    @Test
    @DisplayName("no body and an empty body are distinct, and neither is invented")
    void emptyBodySemantics() {
        Map<String, String> params = Map.of("app_key", "12345");

        /* A null body appends nothing at all. */
        assertThat(signer.canonicalString("/seller/get", params, null))
                .isEqualTo("/seller/getapp_key12345");
        /* An empty string appends an empty string — the same canonical result, not an error. */
        assertThat(signer.canonicalString("/seller/get", params, ""))
                .isEqualTo("/seller/getapp_key12345");
    }

    // ------------------------------------------------------------------ digest

    @Test
    @DisplayName("the digest is HMAC-SHA256 of the canonical string, in uppercase hex")
    void digestIsHmacSha256OfCanonicalString() throws Exception {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("app_key", "100126");
        params.put("timestamp", "1520045034634");
        params.put("sign_method", DarazRequestSigner.SIGN_METHOD);

        String canonical = signer.canonicalString("/brands/get", params, null);
        assertThat(signer.sign("/brands/get", params, null, SECRET))
                .isEqualTo(referenceHmac(canonical, SECRET));
    }

    @Test
    @DisplayName("the signature is exactly 64 uppercase hex characters")
    void signatureShape() {
        String sign = signer.sign("/seller/get", Map.of("app_key", "12345"), null, SECRET);

        assertThat(sign).hasSize(64).matches("[0-9A-F]{64}");
        assertThat(sign).isEqualTo(sign.toUpperCase());
        /* 🔴 Not Base64 — a Base64 digest would be 44 chars and contain non-hex characters. */
        assertThat(sign).doesNotContain("=").doesNotContain("+").doesNotContain("/");
    }

    /**
     * ⚠ The legacy `sign_method=hmac` branch produces a 32-character digest. Accepting that shape
     * would mean we had silently selected the wrong contract.
     */
    @Test
    @DisplayName("the output is never the legacy 32-character digest")
    void notTheLegacyDigestLength() {
        assertThat(signer.sign("/seller/get", Map.of("a", "1"), null, SECRET)).hasSize(64);
        assertThat(signer.sign("/seller/get", Map.of("a", "1"), null, SECRET)).hasSizeGreaterThan(32);
    }

    @Test
    @DisplayName("a different App Secret produces a different signature")
    void secretMatters() {
        Map<String, String> params = Map.of("app_key", "12345");

        assertThat(signer.sign("/seller/get", params, null, SECRET))
                .isNotEqualTo(signer.sign("/seller/get", params, null, "another-secret-value-entirely"));
    }

    @Test
    @DisplayName("a changed parameter value produces a different signature")
    void valuesMatter() {
        assertThat(signer.sign("/seller/get", Map.of("app_key", "12345"), null, SECRET))
                .isNotEqualTo(signer.sign("/seller/get", Map.of("app_key", "12346"), null, SECRET));
    }

    @Test
    @DisplayName("signing is deterministic")
    void deterministic() {
        Map<String, String> params = Map.of("app_key", "12345", "timestamp", "1520045034634");

        assertThat(signer.sign("/seller/get", params, null, SECRET))
                .isEqualTo(signer.sign("/seller/get", params, null, SECRET));
    }

    // ------------------------------------------------------------------ protocol constants

    /** 🔴 The wire value and the JCA algorithm name are different strings for different readers. */
    @Test
    @DisplayName("sign_method is the literal 'sha256', never a JCA algorithm name")
    void signMethodConstant() {
        assertThat(DarazRequestSigner.SIGN_METHOD).isEqualTo("sha256");
        assertThat(DarazRequestSigner.SIGN_METHOD).isNotEqualTo("hmac");
        assertThat(DarazRequestSigner.SIGN_METHOD).isNotEqualTo("HmacSHA256");
        assertThat(DarazRequestSigner.SIGN_METHOD).isNotEqualTo("sha-256");
        assertThat(DarazRequestSigner.SIGNATURE_PARAMETER).isEqualTo("sign");
    }

    // ------------------------------------------------------------------ secret hygiene

    @Test
    @DisplayName("a missing App Secret is refused by name, without quoting anything")
    void missingSecretIsRefusedByName() {
        assertThatThrownBy(() -> signer.sign("/seller/get", Map.of("a", "1"), null, null))
                .isInstanceOf(DarazConfigurationException.class)
                .hasMessageContaining("DARAZ_APP_SECRET");

        assertThatThrownBy(() -> signer.sign("/seller/get", Map.of("a", "1"), null, "  "))
                .isInstanceOf(DarazConfigurationException.class);
    }

    @Test
    @DisplayName("no exception from the signer contains the App Secret")
    void exceptionsCarryNoSecret() {
        assertThatThrownBy(() -> signer.sign(null, Map.of("a", "1"), null, SECRET))
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain(SECRET));
        assertThatThrownBy(() -> signer.sign("/seller/get", null, null, SECRET))
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain(SECRET));
    }

    @Test
    @DisplayName("the signature itself never reveals the secret or the canonical string")
    void outputRevealsNothing() {
        Map<String, String> params = Map.of("access_token", "a-token-value", "app_key", "12345");
        String sign = signer.sign("/seller/get", params, null, SECRET);

        assertThat(sign).doesNotContain(SECRET);
        assertThat(sign).doesNotContain("a-token-value");
        assertThat(sign).doesNotContain("/seller/get");
    }
}
