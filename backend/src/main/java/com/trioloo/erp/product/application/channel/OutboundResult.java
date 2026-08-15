package com.trioloo.erp.product.application.channel;

import com.trioloo.erp.product.domain.OperationOutcome;

/**
 * What one outbound act actually achieved against the channel, {@code PRD-186.b}.
 *
 * <p>🔴 The outcome belongs to ONE listing ({@code INV-107.1}). A failure here never affects
 * a sibling's result ({@code INV-107.2}).
 *
 * <p>⚠ {@code MANUAL_REQUIRED} is a NORMAL outcome, not a failure ({@code SYS-025}): the
 * channel accepted the request but the result is not readable, so a person must look.
 */
public record OutboundResult(OperationOutcome outcome,
                             String detail,
                             String provenance,
                             String assignedExternalListingId) {

    public static OutboundResult succeeded(String detail, String provenance) {
        return new OutboundResult(OperationOutcome.SUCCEEDED, detail, provenance, null);
    }

    /** {@code PRD-188.c} — the channel issued the identifier; it is mirrored as received. */
    public static OutboundResult created(String externalListingId, String detail,
                                         String provenance) {
        return new OutboundResult(OperationOutcome.SUCCEEDED, detail, provenance,
                externalListingId);
    }

    public static OutboundResult failed(String detail, String provenance) {
        return new OutboundResult(OperationOutcome.FAILED, detail, provenance, null);
    }

    public static OutboundResult manualRequired(String detail, String provenance) {
        return new OutboundResult(OperationOutcome.MANUAL_REQUIRED, detail, provenance, null);
    }
}
