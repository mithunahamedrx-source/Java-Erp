package com.trioloo.erp.product.application;

/**
 * A business refusal on a Channel Listing.
 *
 * <p>⚠ {@code SYS-032} / {@code TEC-083} — refusal is a NORMAL outcome, not an error. The
 * message states the rule in the operator's language and, where one applies, names the
 * offending field so the client never has to invent its own wording ({@code PRJ-200}).
 */
public class ChannelListingValidationException extends RuntimeException {
    private final String field;

    public ChannelListingValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    /** A refusal that belongs to the listing as a whole rather than to one field. */
    public ChannelListingValidationException(String message) {
        super(message);
        this.field = null;
    }

    public String field() {
        return field;
    }
}
