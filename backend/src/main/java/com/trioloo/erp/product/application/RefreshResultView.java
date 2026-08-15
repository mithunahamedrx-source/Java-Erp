package com.trioloo.erp.product.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * What ONE inbound refresh of ONE listing actually achieved, {@code PRD-181} / {@code API-062}.
 *
 * <p>🔴 REFRESH READS THE MARKETPLACE AND NEVER WRITES TO IT. Everything reported here concerns
 * the REPORTED side and the comparison derived from it. No intended value, mapping, publication
 * intent or unsent condition is touched by the act this result describes ({@code PRD-181.a}).
 *
 * <p>🔴 {@code API-062.d} — provider-neutral. No channel field name, endpoint, status code or
 * payload key appears here; an adapter normalises its response into these business facts.
 *
 * <p>🔴 A SUCCESSFUL READ IS NOT AGREEMENT. {@code outcome} says whether the marketplace could
 * be read; {@code divergedFieldCount} says whether what it returned matches ERP intent. Those
 * are different questions and a refresh that succeeds may well discover divergence.
 */
public record RefreshResultView(UUID listingId,
                                /** Null when the attempt was refused before it was made. */
                                UUID operationId,
                                String listingTitle,
                                String channelName,
                                /** {@code SUCCEEDED}, {@code FAILED} or {@code MANUAL_REQUIRED}. */
                                String outcome,
                                /** One of the {@code STATE_*} constants below. */
                                String state,
                                String detail,
                                Instant startedAt,
                                Instant completedAt,
                                /**
                                 * 🔴 The reported facts whose READABLE value actually moved,
                                 * named in business terms. Empty is a real answer: the channel
                                 * was read and reports what it reported last time.
                                 */
                                List<String> changedDomains,
                                /**
                                 * ⚠ {@code SYS-025} — a NORMAL outcome, not a failure. The fact
                                 * came back but no deterministic basis exists to conclude
                                 * anything from it, so a person must look ({@code PRD-183.d}).
                                 */
                                List<String> manualRequiredDomains,
                                /**
                                 * 🔴 {@code API-063.c} — facts the channel did not return.
                                 * Counted, never rendered as empty, zero or agreement.
                                 */
                                int notReadableFieldCount,
                                int divergedFieldCount,
                                /**
                                 * 🔴 {@code PRD-185.c} — carried so the surface can show that
                                 * refreshing did NOT clear it. An inbound read never satisfies
                                 * an outbound obligation.
                                 */
                                boolean unsentLocalChanges,
                                String syncState) {

    /** The channel was read and nothing readable had moved since the previous read. */
    public static final String STATE_COMPLETED_NO_CHANGE = "COMPLETED_NO_CHANGE";
    /** The channel was read and at least one readable reported fact changed. */
    public static final String STATE_COMPLETED_CHANGED = "COMPLETED_CHANGED";
    /**
     * 🔴 The attempt itself did not succeed. ⚠ This is an OPERATION concern and is never
     * translated into {@code DIVERGED}, {@code NOT_READABLE} or a lifecycle change.
     */
    public static final String STATE_FAILED = "FAILED";
    /** The channel accepted the read but the outcome is not readable; a person must look. */
    public static final String STATE_MANUAL_REQUIRED = "MANUAL_REQUIRED";
}
