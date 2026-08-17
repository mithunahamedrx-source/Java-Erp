package com.trioloo.erp.integration.infrastructure.daraz;

import java.util.List;

/**
 * Daraz answered, but the answer is not one this integration can act on.
 *
 * <p>🔴 IT CARRIES A STRUCTURED, SAFE CLASSIFICATION — AND THAT IS THE WHOLE POINT. The first
 * version carried only a free-text problem and an optional provider code. When a live authorisation
 * failed with no provider code, the log said {@code providerCode=null} and nothing else, and the
 * fault could not be told apart from seven other causes. Every field here is chosen so it can be
 * logged safely and still identify the fault exactly.
 *
 * <p>🔴 NOTHING HERE IS EVER A VALUE FROM THE RESPONSE. {@link #field} is a field NAME,
 * {@link #topLevelFields} are field NAMES; no token, authorisation code, state, secret or body
 * fragment can reach any of them. {@link #providerCode} and {@link #providerType} are the
 * provider's own classification of its own refusal, not its message — a provider message can echo
 * request parameters straight back.
 */
public class DarazProtocolException extends RuntimeException {

    /** Why the response could not be used. Safe to log in full. */
    public enum Reason {
        /** The provider refused with its own non-zero envelope code. */
        ENVELOPE_CODE,
        /** The provider returned nothing at all. */
        EMPTY_RESPONSE,
        /** The body was not JSON. */
        NON_JSON,
        /** A field the Daraz contract requires was absent ({@code DZC-006}). */
        MISSING_FIELD,
        /** A duration was present but unusable — notably {@code refresh_expires_in=0} ({@code DZC-005}). */
        UNUSABLE_DURATION,
        /**
         * No {@code country_user_info} array at all.
         *
         * <p>⚠ NO LONGER PRODUCED since the local-seller branch was approved — its absence now
         * routes to {@code user_info} rather than failing. Retained so log lines written before
         * that change remain interpretable.
         */
        MISSING_COUNTRY_USER_INFO,
        /** {@code country_user_info} present, but with no Bangladesh entry ({@code DZC-010}). */
        MISSING_BD_ACCOUNT,
        /** The Bangladesh entry carried no {@code seller_id}. */
        MISSING_SELLER_ID,
        /** JSON, but not a shape this contract recognises. */
        MALFORMED_RESPONSE,
        /** Unclassified. ⚠ Seeing this in a log means a throw site forgot its reason. */
        UNKNOWN
    }

    private final Reason reason;
    private final String field;
    private final String providerCode;
    private final String providerType;
    private final String requestId;
    private final DarazResponseShape shape;

    public DarazProtocolException(Reason reason, String field, String providerCode,
                                  String providerType, String requestId, DarazResponseShape shape) {
        super(describe(reason, field, providerCode), null, false, false);
        this.reason = reason == null ? Reason.UNKNOWN : reason;
        this.field = field;
        this.providerCode = providerCode;
        this.providerType = providerType;
        this.requestId = requestId;
        this.shape = shape == null ? DarazResponseShape.UNKNOWN : shape;
    }

    /** For failures that happen before a response shape is known. */
    public DarazProtocolException(Reason reason) {
        this(reason, null, null, null, null, DarazResponseShape.UNKNOWN);
    }

    /**
     * ⚠ The message is built ONLY from the safe classification. It deliberately cannot contain the
     * provider's own text, so a message accidentally reaching a log leaks nothing.
     */
    private static String describe(Reason reason, String field, String providerCode) {
        StringBuilder text = new StringBuilder("Daraz rejected the request: reason=")
                .append(reason == null ? Reason.UNKNOWN : reason);
        if (field != null) {
            text.append(" field=").append(field);
        }
        if (providerCode != null) {
            text.append(" providerCode=").append(providerCode);
        }
        return text.toString();
    }

    public Reason reason() {
        return reason;
    }

    /** 🔴 A field NAME, never its value. */
    public String field() {
        return field;
    }

    /** The provider's error code, when it gave one. */
    public String providerCode() {
        return providerCode;
    }

    /** The provider's error type — {@code ISV}, {@code ISP}, {@code SYSTEM} — when it gave one. */
    public String providerType() {
        return providerType;
    }

    /**
     * The provider's own trace id, when present.
     *
     * <p>✅ Opaque and safe: it identifies the call in Daraz's systems and is exactly what their
     * support asks for. It carries no token, code or state.
     */
    public String requestId() {
        return requestId;
    }

    /**
     * The top-level JSON field NAMES of the response, never their values.
     *
     * <p>✅ THIS IS THE DIAGNOSTIC THAT SETTLES SHAPE QUESTIONS. Seeing
     * {@code [code, data, request_id]} rather than {@code [access_token, refresh_token, …]} tells
     * you immediately that the payload is wrapped, without anyone ever printing the body.
     */
    public List<String> topLevelFields() {
        return shape.topLevelFields();
    }

    /**
     * One level of nested shape for the allow-listed container fields.
     *
     * <p>✅ Values are types and NAMES only — {@code OBJECT[seller_id,user_id]}, {@code ABSENT},
     * {@code ARRAY<OBJECT>[country,seller_id]}. 🔴 Never a value from the response.
     */
    public java.util.Map<String, String> containers() {
        return shape.containers();
    }

    /** The containers rendered for a log line. */
    public String describeContainers() {
        return shape.describeContainers();
    }
}
