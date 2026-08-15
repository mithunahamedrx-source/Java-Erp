package com.trioloo.erp.product.application.ai;

/**
 * No assistant could produce a candidate, {@code PRD-200.r}.
 *
 * <p>🔴 THROWING THIS CHANGES NOTHING. The Listing, the form and every authored value are
 * untouched: a failed generation is a non-event, not a partial edit.
 *
 * <p>⚠ It carries an operator-readable reason. "AI authoring is not configured" is a
 * different fact from "the provider could not be reached", and collapsing them would send an
 * operator hunting for a network problem that does not exist.
 */
public class AiAuthoringUnavailableException extends RuntimeException {

    public AiAuthoringUnavailableException(String message) {
        super(message);
    }
}
