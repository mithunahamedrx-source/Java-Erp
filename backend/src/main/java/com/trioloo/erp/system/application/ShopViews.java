package com.trioloo.erp.system.application;

import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.system.domain.ChannelTypeCode;
import com.trioloo.erp.system.domain.ConfigurationState;
import com.trioloo.erp.system.domain.MarketCode;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The Shops & Channels read model.
 *
 * <p>🔴 EVERY FIELD IS A NON-SECRET BUSINESS FACT ({@code API-070}, {@code SCS-052}). There
 * is no token, app secret, password, provider payload, endpoint or error code anywhere in
 * these shapes, so no response can carry one even by mistake.
 *
 * <p>🔴 {@code SCS-041} — {@code externalAccountIdentity} and {@code externalLink} are two
 * DIFFERENT facts and are never collapsed. The identity binds; the link only opens a page.
 *
 * <p>🔴 {@code SYS-034} — an unknown fact is null and is omitted by the surface. Nothing here
 * is defaulted to zero, to "unknown" or to the current time.
 */
public final class ShopViews {

    private ShopViews() {
    }

    /**
     * One workspace row — {@code SCS-024}'s five columns.
     *
     * <p>🔴 {@code connection} is NULLABLE, and null means Integration could not be read
     * ({@code SCS-043.a}). It is not a fifth state and never a substitute guess.
     */
    public record ShopRow(UUID id,
                          String code,
                          String name,
                          ChannelTypeCode channelType,
                          String channelTypeLabel,
                          ConfigurationState configuration,
                          ConnectionState connection,
                          String externalLink,
                          boolean bound) {
    }

    /**
     * The detail page — {@code SCS-040}'s facts.
     *
     * <p>⚠ {@code connectionKnown} distinguishes "the condition is X" from "Trioloo does not
     * know the condition". Collapsing those two into one nullable field would let a surface
     * read absence as {@code NOT_CONNECTED}, which is a different and false claim.
     */
    public record ShopDetail(UUID id,
                             String code,
                             String name,
                             ChannelTypeCode channelType,
                             String channelTypeLabel,
                             MarketCode market,
                             /* ⚠ The label the surface renders. 🔴 Never the parsed value. */
                             String marketLabel,
                             ConfigurationState configuration,
                             boolean connectionKnown,
                             ConnectionState connection,
                             Instant connectionLastCheckedAt,
                             String externalAccountIdentity,
                             String externalLink,
                             Instant boundAt,
                             Instant authorisedAt,
                             Instant activatedAt,
                             String activatedByName,
                             boolean channelTypeChangeable,
                             boolean marketChangeable,
                             /*
                               ⚠ A STATE fact, not a permission fact. SCS-050.b keeps the two
                               apart: permission decides whether a control EXISTS, state
                               decides whether it can RUN, and the reason belongs to the
                               second. The surface never infers one from the other.
                              */
                             boolean activatable,
                             String activationBlockedReason,
                             /*
                               🔴 SCS-092.d — membership of the recognised set implies no
                               adapter. Whether an integration exists for this channel type is
                               a separate, honestly reported fact.
                              */
                             boolean authorisationSupported,
                             String authorisationUnsupportedReason) {
    }

    /**
     * {@code SCS-020} — the summary strip. 🔴 {@code SCS-020.a} — EVERY FIGURE IS DERIVED
     * from the shop records themselves. No counter column exists, and none was created.
     *
     * <p>🔴 {@code SCS-020.c} — no order, return, message, settlement or listing figure
     * appears, and never a zero for an unbuilt domain ({@code SCS-061}).
     */
    public record ShopSummary(AllShopsCard allShops,
                              List<ChannelTypeCard> channelTypes,
                              /*
                                ⚠ When Integration cannot be read, the strip states the
                                configuration split it genuinely knows and claims NO
                                connection figure at all — rather than counting every shop as
                                not connected, which would be a fabricated business claim.
                               */
                              boolean connectionKnown) {
    }

    /** {@code SCS-020} — total shops, how many channel types are present, and the split. */
    public record AllShopsCard(int channelTypeCount, int shopCount, List<Figure> configurationSplit) {
    }

    /**
     * One card per channel type PRESENT ({@code SCS-020}).
     *
     * <p>🔴 {@code SCS-021} — {@code attentionCount} is the number of shops whose connection
     * is NOT {@code CONNECTED}. Configuration contributes nothing to it: a {@code DRAFT} shop
     * is not "attention", and {@code SUSPENDED} never enters this figure.
     */
    public record ChannelTypeCard(ChannelTypeCode channelType,
                                  String label,
                                  int shopCount,
                                  Integer attentionCount,
                                  List<Figure> connectionSplit) {
    }

    /**
     * One line in a card.
     *
     * <p>🔴 {@code SCS-020.b} — ONLY CONDITIONS THAT ACTUALLY OCCUR ARE LISTED. A figure of
     * zero is not rendered as a zero; the line simply does not exist, exactly as the approved
     * pack shows Daraz without a connection-error line.
     */
    public record Figure(String key, String label, int count) {
    }
}
