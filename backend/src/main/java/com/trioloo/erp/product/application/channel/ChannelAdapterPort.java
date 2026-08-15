package com.trioloo.erp.product.application.channel;

import java.util.Optional;
import java.util.UUID;

/**
 * The channel-neutral listing port, {@code API-062} / {@code PRD-194.b}.
 *
 * <p>Product defines this contract; an adapter implements it. 🔴 NO CHANNEL NAME, ENDPOINT,
 * FIELD NAME, ERROR CODE, PAGINATION TOKEN OR CREDENTIAL CROSSES THIS BOUNDARY INTO THE CORE
 * ({@code API-062.d}, {@code PRD-194.a}). Nothing below mentions a marketplace.
 *
 * <p>🔴 {@code API-062.c} — an adapter REPORTS observed facts; it never writes Product-owned
 * intent. An implementation that "helpfully" corrected an intended value would destroy the
 * operator's unsent edit and make {@code DIVERGED} undetectable.
 *
 * <p>🔴 {@code API-066.a} — pagination, cursors, page size, rate limiting and chunking are
 * the implementation's concern. {@code API-066.b} — an incomplete run MUST report itself as
 * incomplete, because {@code PRD-177}'s absence-is-not-deletion guarantee depends on it.
 *
 * <p>⚠ No implementation ships in this release. {@link ChannelAdapterRegistry} resolves none
 * and the application says so honestly rather than simulating remote success.
 */
public interface ChannelAdapterPort {

    /** The channel type this adapter serves, matching {@code E-016}'s channel type. */
    String channelType();

    /**
     * Declares field-level capability for one channel instance, {@code API-063} /
     * {@code PRD-125}.
     *
     * <p>⚠ Declared per INSTANCE, never per type: two shops on one marketplace may support
     * different fields.
     */
    ChannelCapabilityDeclaration declareCapability(UUID channelInstanceId);

    /**
     * Enumerates the channel's ACTIVE listings, {@code PRD-175}.
     *
     * <p>🔴 The returned page states whether the enumeration COMPLETED. A truncated run must
     * never be presented as a complete one ({@code API-066.b}).
     */
    DiscoveryPage discoverActive(UUID channelInstanceId, String cursor);

    /** Re-reads one known listing, {@code PRD-189.c}. */
    Optional<ReportedListingSnapshot> readListing(UUID channelInstanceId, String externalListingId);

    /** Sends intended values for an existing listing, {@code PRD-171}. */
    OutboundResult pushUpdate(UUID channelInstanceId, OutboundListingPayload payload);

    /**
     * Creates the listing remotely for the first time, {@code PRD-188}.
     *
     * <p>The channel assigns the external identifier and returns it on success.
     */
    OutboundResult publishCreate(UUID channelInstanceId, OutboundListingPayload payload);

    /** Withdraws the listing from the channel. */
    OutboundResult withdraw(UUID channelInstanceId, String externalListingId);
}
