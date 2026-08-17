package com.trioloo.erp.integration.application;

import com.trioloo.erp.system.domain.ChannelTypeCode;

import java.net.URI;
import java.util.Optional;
import java.util.UUID;

/**
 * A provider's side of seller authorisation, in the two steps a redirect flow actually has.
 *
 * <p>🔴 THIS REPLACES A SHAPE THAT COULD NOT BE IMPLEMENTED. The previous contract was a single
 * synchronous {@code authorise(UUID)} returning a bound account. No redirect-based OAuth provider
 * can satisfy that: the seller leaves for the provider's own site, signs in there, and the result
 * arrives later on a separate callback request. {@code API-069.a} already ratifies the real shape
 * — authorisation workflow → external authorisation → callback → verify the remote account
 * identity → update the connection — so the CODE was the defect, not the architecture
 * ({@code CLAUDE.md} §6).
 *
 * <p>⚠ THERE IS DELIBERATELY NO SYNCHRONOUS CONVENIENCE METHOD. One would be a lie for every real
 * provider, and the first caller to use it would reintroduce exactly the defect this removes.
 */
public interface ChannelAuthorisationPort {

    /** The channel type this adapter authorises. */
    ChannelTypeCode channelType();

    /**
     * The provider destination the operator's browser must be sent to.
     *
     * <p>⚠ PURE BY DESIGN — it builds a URI and nothing else. The correlation record that makes
     * {@code state} meaningful is written by {@link ChannelAuthorisationService} against the
     * ratified {@code channel_authorisation_attempt} store ({@code TEC-120}), so an adapter
     * cannot mint a state that nothing is tracking.
     *
     * @param channelInstanceId the shop being authorised — explicit, never ambient ({@code API-071.a}).
     * @param state             the opaque one-time value the provider will echo back.
     */
    URI authorizationUri(UUID channelInstanceId, String state);

    /**
     * Exchanges the provider's authorisation code for the account it identifies.
     *
     * <p>🔴 THE SHOP IS AN INPUT, NOT A RESULT. It has already been resolved from the stored
     * correlation record; the callback never names it. An adapter receives it so that
     * {@code API-071.a} holds — every seller-account-specific operation carries an explicit
     * channel instance.
     *
     * <p>🔴 NOTHING IS PERSISTED HERE. Whatever comes back is PROVISIONAL until the identity has
     * been checked against the existing binding: a mismatch must leave the shop and its stored
     * credential completely untouched ({@code SCS-044}, {@code INV-16.6}).
     *
     * @return the account the provider reported, or empty when the seller did not complete
     *         authorisation.
     */
    Optional<AuthorisedAccount> exchange(UUID channelInstanceId, String code);

    /**
     * What the provider reported.
     *
     * @param accountIdentity the AUTHORITATIVE remote account identity ({@code INV-16.5}).
     * @param link            an operator-facing address, a second fact and never the identity
     *                        ({@code INV-16.14}).
     * @param credential      the provisional secret material, or {@code null} for an adapter that
     *                        has none. 🔴 It is persisted only once binding succeeds.
     */
    record AuthorisedAccount(String accountIdentity, String link,
                             ChannelCredentialStore.ProviderCredential credential) {

        /** For adapters that report an account without credential material. */
        public AuthorisedAccount(String accountIdentity, String link) {
            this(accountIdentity, link, null);
        }
    }
}
