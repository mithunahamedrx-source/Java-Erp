package com.trioloo.erp.integration.application;

import com.trioloo.erp.system.domain.ChannelTypeCode;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Which channel types Trioloo can currently AUTHORISE against.
 *
 * <p>🔴 {@code SCS-092.d} — MEMBERSHIP OF THE RECOGNISED SET IMPLIES NO ADAPTER. Offering a
 * channel type in the registry asserts that Trioloo recognises the KIND, not that an
 * integration exists for it. This class is where that second, separate fact lives, so a
 * surface can state it honestly instead of the system pretending an action will work.
 *
 * <p>⚠ {@code INV-15.3} — resolving an adapter FROM a Channel Type is Integration routing and
 * is permitted. This class routes; it derives no business behaviour from the value.
 *
 * <p>🔴 THE SET IS EMPTY TODAY, AND THAT IS THE TRUTHFUL ANSWER. No provider adapter, OAuth
 * client or credential store has been built ({@code GAP-133}). Adding a channel type here
 * without an adapter behind it would make {@code Connect} advertise an authority the system
 * does not have.
 */
@Component
public class ChannelAuthorisationRegistry {

    private final Set<ChannelTypeCode> supported;

    public ChannelAuthorisationRegistry() {
        /*
          ✅ DARAZ IS SUPPORTED FROM HERE ON. Both halves of the workflow exist: initiate builds the
          official authorisation URL against a tracked one-time state, and complete exchanges the
          code and applies SCS-044's binding outcomes.
          🔴 NO OTHER CHANNEL TYPE IS REGISTERED. Website, Shopify, WooCommerce, Facebook, WhatsApp,
          Phone and Walk-in remain honestly unsupported (SCS-092.d) — being recognised implies no
          adapter, and claiming otherwise would send an operator to a flow that cannot finish.
        */
        this(Set.of(ChannelTypeCode.DARAZ));
    }

    /** For tests, which supply a channel type whose authorisation flow they then exercise. */
    public ChannelAuthorisationRegistry(Set<ChannelTypeCode> supported) {
        this.supported = Set.copyOf(supported);
    }

    public boolean supports(ChannelTypeCode channelType) {
        return supported.contains(channelType);
    }

    /**
     * The business-facing reason authorisation cannot start, or null when it can.
     *
     * <p>🔴 {@code API-070} — a business sentence, never a provider message.
     */
    public String unsupportedReason(ChannelTypeCode channelType) {
        return supports(channelType) ? null
                : "Trioloo cannot yet sign in to " + channelType.label()
                        + " accounts. This channel type is recognised, but its integration is not built.";
    }
}
