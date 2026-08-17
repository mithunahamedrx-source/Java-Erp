package com.trioloo.erp.integration.infrastructure.daraz;

import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Signs a Daraz Open Platform request, exactly as the official contract specifies.
 *
 * <p><strong>The algorithm</strong> ({@code DZC-007}): sort every request parameter by name in
 * ASCII order excluding {@code sign}; concatenate each name immediately followed by its value
 * with no separators; <strong>prepend the API path</strong>; append the request body where there
 * is one; HMAC-SHA256 the UTF-8 bytes keyed with the App Secret; emit UPPERCASE hex.
 *
 * <p>🔴 PREPENDING THE API PATH IS THE STEP THAT IS EASIEST TO MISS AND HARDEST TO DIAGNOSE. A
 * signer that omits it produces a perfectly well-formed 64-character signature that the gateway
 * rejects every single time, with an error that says nothing about the path. The test that signs
 * identical parameters for two different paths exists for that reason.
 *
 * <p>🔴 {@code sign_method} IS A WIRE VALUE, NOT AN ALGORITHM NAME. Daraz expects the literal
 * {@code sha256}; the JCA algorithm is {@code HmacSHA256}. They are different strings for
 * different audiences and are deliberately kept apart — sending {@code HmacSHA256}, or the
 * legacy {@code hmac}, selects the wrong contract on the server.
 *
 * <p>🔴 NO SECRET AND NO CANONICAL STRING IS EVER LOGGED. The canonical string contains every
 * parameter value, which for seller-scoped calls includes the access token, so it is not
 * returned, not logged, and not placed in an exception.
 */
@Component
public class DarazRequestSigner {

    /** The value transmitted as the {@code sign_method} parameter. 🔴 Not the JCA name. */
    public static final String SIGN_METHOD = "sha256";

    /** The JCA algorithm. 🔴 Not the wire value. */
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    /** The parameter that carries the result, and therefore can never be part of the input. */
    public static final String SIGNATURE_PARAMETER = "sign";

    private static final char[] HEX = "0123456789ABCDEF".toCharArray();

    /**
     * Signs a request.
     *
     * @param apiPath    the official API path, e.g. {@code /auth/token/create}. Signed verbatim:
     *                   🔴 it is NOT normalised, because the provider signs the exact string.
     * @param parameters every request parameter. ⚠ Any {@code sign} entry is IGNORED rather than
     *                   rejected, so a caller re-signing a previously signed map cannot
     *                   accidentally fold a stale signature into the input.
     * @param body       the exact body bytes as they will be sent, or {@code null} when the
     *                   request has none. 🔴 The signer does not serialise, re-encode or
     *                   normalise it — whatever is signed here must be what the client sends.
     * @param appSecret  the HMAC key.
     * @return the uppercase hexadecimal HMAC-SHA256 digest, 64 characters.
     */
    public String sign(String apiPath, Map<String, String> parameters, String body, String appSecret) {
        if (apiPath == null || apiPath.isBlank()) {
            throw new IllegalArgumentException("A Daraz API path is required to sign a request.");
        }
        if (parameters == null) {
            throw new IllegalArgumentException("A Daraz parameter map is required, even when empty.");
        }
        if (appSecret == null || appSecret.isBlank()) {
            /* 🔴 Names the fault, never the value. */
            throw new DarazConfigurationException("DARAZ_APP_SECRET");
        }

        String canonical = canonicalString(apiPath, parameters, body);

        byte[] digest;
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            digest = mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            /* 🔴 Not chained: the cause can quote the input, which is the secret's keying material. */
            throw new IllegalStateException("Daraz request signing failed.");
        }

        return upperHex(digest);
    }

    /**
     * Builds the canonical string that gets signed.
     *
     * <p>Package-private so the construction itself can be asserted, rather than only its digest —
     * a wrong canonical string and a wrong key are indistinguishable by output alone.
     *
     * <p>⚠ Sorting is by {@link String#compareTo}, which is UTF-16 code-unit order and matches the
     * required ASCII ordering for the ASCII parameter names Daraz uses. 🔴 A locale-sensitive
     * collator must never be substituted: it would reorder names differently on some hosts and
     * produce a signer that works in one region and fails in another.
     */
    String canonicalString(String apiPath, Map<String, String> parameters, String body) {
        List<String> names = new ArrayList<>(parameters.size());
        for (Map.Entry<String, String> entry : parameters.entrySet()) {
            if (entry.getKey() == null || SIGNATURE_PARAMETER.equals(entry.getKey())) {
                continue;
            }
            if (entry.getValue() == null) {
                continue;   // An absent value is not sent, so it is not signed.
            }
            names.add(entry.getKey());
        }
        names.sort(String::compareTo);

        StringBuilder canonical = new StringBuilder();
        canonical.append(apiPath);
        for (String name : names) {
            canonical.append(name).append(parameters.get(name));
        }
        if (body != null) {
            canonical.append(body);
        }
        return canonical.toString();
    }

    private static String upperHex(byte[] bytes) {
        char[] out = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            int v = bytes[i] & 0xFF;
            out[i * 2] = HEX[v >>> 4];
            out[i * 2 + 1] = HEX[v & 0x0F];
        }
        return new String(out);
    }
}
