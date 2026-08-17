package com.trioloo.erp.integration.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionEntity;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionRepository;
import com.trioloo.erp.system.application.ShopAccessDeniedException;
import com.trioloo.erp.system.application.ShopBindingService;
import com.trioloo.erp.system.application.ShopNotFoundException;
import com.trioloo.erp.system.domain.ChannelTypeCode;
import com.trioloo.erp.system.infrastructure.persistence.ShopEntity;
import com.trioloo.erp.system.infrastructure.persistence.ShopRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Seller authorisation as the two-step workflow {@code API-069.a} ratifies.
 *
 * <p><strong>Initiate</strong> proves the operator may authorise, records who is authorising WHICH
 * shop, and hands back the provider's own sign-in destination. <strong>Complete</strong> receives
 * the provider's callback, recovers the shop from the stored correlation record, exchanges the
 * code, and only then applies {@code SCS-044}'s binding outcomes.
 *
 * <p>🔴 THE CALLBACK NEVER NAMES THE SHOP. {@link #complete} takes a code and a state and nothing
 * else. There is no shop parameter to forge, because the shop was written down before the operator
 * ever left for the provider. This is what makes several Daraz shops safe: each has its own
 * attempt, its own state and its own credential row, and no callback can be steered onto a
 * sibling.
 */
@Service
public class ChannelAuthorisationService {

    /**
     * How long an authorisation attempt stays usable.
     *
     * <p>⚠ TEN MINUTES IS AN INTERACTIVE-REDIRECT WINDOW, NOT THE CODE'S LIFETIME. Daraz's
     * authorisation CODE lives 30 minutes ({@code DZC-004}); this is the shorter window in which a
     * human is expected to finish signing in. 🔴 Bounding it well under the provider's own limit
     * means an abandoned redirect expires here first, rather than lingering as a usable
     * correlation.
     */
    static final Duration ATTEMPT_TTL = Duration.ofMinutes(10);

    private final ShopRepository shops;
    private final ShopBindingService binding;
    private final ChannelConnectionRepository connections;
    private final ChannelAuthorisationRegistry registry;
    private final ChannelAuthorisationAttemptStore attempts;
    private final ChannelCredentialStore credentials;
    private final List<ChannelAuthorisationPort> adapters;
    private final CurrentActor currentActor;
    private final Clock clock;

    public ChannelAuthorisationService(ShopRepository shops,
                                       ShopBindingService binding,
                                       ChannelConnectionRepository connections,
                                       ChannelAuthorisationRegistry registry,
                                       ChannelAuthorisationAttemptStore attempts,
                                       ChannelCredentialStore credentials,
                                       List<ChannelAuthorisationPort> adapters,
                                       CurrentActor currentActor,
                                       Clock clock) {
        this.shops = shops;
        this.binding = binding;
        this.connections = connections;
        this.registry = registry;
        this.attempts = attempts;
        this.credentials = credentials;
        this.adapters = adapters;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    // ================================================================= initiate

    /**
     * Starts authorisation for one shop.
     *
     * <p>🔴 IT MUTATES NO BUSINESS FACT. No credential, no binding, no connection condition and no
     * configuration lifecycle moves here — the operator has not authorised anything yet, they have
     * merely been pointed at the provider. The only row written is the correlation attempt.
     */
    @Transactional
    public InitiationResult initiate(UUID shopId) {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(IntegrationPermissions.CHANNEL_CONNECTION_AUTHORIZE)) {
            throw new ShopAccessDeniedException(IntegrationPermissions.CHANNEL_CONNECTION_AUTHORIZE);
        }

        ShopEntity shop = shops.findById(shopId).orElseThrow(() -> new ShopNotFoundException(shopId));
        ChannelTypeCode channelType = shop.getChannelType();

        /*
          🔴 SCS-092.d — MEMBERSHIP OF THE RECOGNISED SET IMPLIES NO ADAPTER. Refusing here, in
          words the operator can act on, is the honest answer; sending them to a provider we cannot
          finish with would be worse than saying so.
        */
        if (!registry.supports(channelType)) {
            throw new AuthorisationUnsupportedException(registry.unsupportedReason(channelType));
        }
        ChannelAuthorisationPort adapter = adapterFor(channelType);

        Instant now = clock.instant();
        ChannelAuthorisationAttemptStore.IssuedState issued =
                attempts.issue(shopId, actor.id(), now, now.plus(ATTEMPT_TTL));

        URI destination = adapter.authorizationUri(shopId, issued.state());
        return new InitiationResult(destination.toString());
    }

    /** What the caller needs to send the browser onward, and nothing more. */
    public record InitiationResult(String authorizationUrl) {
    }

    // ================================================================= complete

    /**
     * Completes authorisation from the provider's callback.
     *
     * <p>🔴 DELIBERATELY NOT PERMISSION-CHECKED, AND THE REASON MATTERS. This runs on a redirect
     * from the provider's site, not on an ERP screen. The one-time state IS the authorisation: it
     * was issued to an actor who held {@code integration.channel-connection.authorize}, it is
     * bound to one shop, it expires, and it can be consumed exactly once. Requiring a session here
     * would add no security — anyone without the state gets nothing — while making the flow fail
     * for reasons unrelated to authorisation.
     *
     * <p>⚠ AN UNUSABLE STATE IS NOT AN ERROR TO EXPLAIN. Unknown, expired and already-consumed all
     * return {@code NOT_COMPLETED} indistinguishably, so a caller cannot probe which states exist.
     */
    @Transactional
    public AuthorisationResult complete(String code, String state) {
        Instant observedAt = clock.instant();

        Optional<ChannelAuthorisationAttemptStore.ConsumedAttempt> consumed =
                attempts.consume(state, observedAt);
        if (consumed.isEmpty()) {
            return AuthorisationResult.notCompleted(null);
        }
        UUID shopId = consumed.get().channelInstanceId();

        /*
          ⚠ A missing code is the seller declining or the provider erroring. The state is already
          spent — correctly: an abandoned attempt must not be replayable.
        */
        if (code == null || code.isBlank()) {
            return AuthorisationResult.notCompleted(shopId);
        }

        ShopEntity shop = shops.findById(shopId).orElseThrow(() -> new ShopNotFoundException(shopId));
        ChannelAuthorisationPort adapter = adapterFor(shop.getChannelType());

        Optional<ChannelAuthorisationPort.AuthorisedAccount> reported = adapter.exchange(shopId, code);
        if (reported.isEmpty()) {
            /*
              🔴 SCS-044 — NOT COMPLETED. Nothing was bound and the shop is unchanged, so nothing is
              written: not the binding, and not the connection condition.
            */
            return AuthorisationResult.notCompleted(shopId);
        }
        ChannelAuthorisationPort.AuthorisedAccount account = reported.get();

        ShopBindingService.BindingOutcome outcome = binding.applyAuthorisation(
                shopId, account.accountIdentity(), account.link(), observedAt);

        return switch (outcome.kind()) {
            case BOUND, RENEWED -> {
                /*
                  🔴 THE CREDENTIAL IS PERSISTED ONLY HERE — after the remote identity has been
                  checked against the binding. Storing it on a successful token exchange alone would
                  leave a shop holding live credentials for an account it is not bound to.
                */
                if (account.credential() != null) {
                    credentials.put(shopId, account.credential(), observedAt);
                }
                observe(shopId, ConnectionState.CONNECTED, observedAt);
                yield AuthorisationResult.authorised(shopId, outcome.boundAccount(),
                        outcome.kind() == ShopBindingService.BindingOutcome.Kind.BOUND);
            }
            /*
              🔴 SCS-044 — REJECTED, AND NOTHING CHANGED. The provisional credential is DISCARDED,
              the existing one is untouched, and the connection condition is NOT written either:
              the shop's existing condition is still the true one, and overwriting it would punish
              the record for someone signing in as the wrong account.
            */
            case DIFFERENT_ACCOUNT -> AuthorisationResult.differentAccount(
                    shopId, outcome.boundAccount(), outcome.attemptedAccount());
            case CLAIMED_BY_ANOTHER_SHOP -> AuthorisationResult.claimedByAnotherShop(
                    shopId, outcome.attemptedAccount());
        };
    }

    @Transactional(readOnly = true)
    public void requireReadable(UUID shopId) {
        if (!shops.existsById(shopId)) {
            throw new ShopNotFoundException(shopId);
        }
    }

    private ChannelAuthorisationPort adapterFor(ChannelTypeCode channelType) {
        return adapters.stream()
                .filter(adapter -> adapter.channelType() == channelType)
                .findFirst()
                /*
                  ⚠ The registry said this type is supported but no adapter answered — a
                  configuration fault, not a business outcome, and it is not dressed up as one.
                */
                .orElseThrow(() -> new IllegalStateException(
                        "No authorisation adapter is registered for " + channelType.name()));
    }

    private void observe(UUID shopId, ConnectionState state, Instant observedAt) {
        connections.findById(shopId)
                .map(existing -> {
                    existing.observe(state, observedAt);
                    return existing;
                })
                .orElseGet(() -> connections.save(
                        ChannelConnectionEntity.observed(shopId, state, observedAt)));
    }

    public record AuthorisationResult(Outcome outcome,
                                      UUID channelInstanceId,
                                      String boundAccount,
                                      String attemptedAccount,
                                      boolean firstBinding) {
        public enum Outcome {
            AUTHORISED,
            DIFFERENT_ACCOUNT,
            CLAIMED_BY_ANOTHER_SHOP,
            NOT_COMPLETED
        }

        static AuthorisationResult authorised(UUID shopId, String account, boolean firstBinding) {
            return new AuthorisationResult(Outcome.AUTHORISED, shopId, account, account, firstBinding);
        }

        static AuthorisationResult differentAccount(UUID shopId, String bound, String attempted) {
            return new AuthorisationResult(Outcome.DIFFERENT_ACCOUNT, shopId, bound, attempted, false);
        }

        static AuthorisationResult claimedByAnotherShop(UUID shopId, String attempted) {
            return new AuthorisationResult(Outcome.CLAIMED_BY_ANOTHER_SHOP, shopId, null, attempted, false);
        }

        /**
         * ⚠ The shop may be UNKNOWN here. An unusable state resolves to no shop at all, which is
         * exactly why the callback cannot be told where to go in that case.
         */
        static AuthorisationResult notCompleted(UUID shopId) {
            return new AuthorisationResult(Outcome.NOT_COMPLETED, shopId, null, null, false);
        }
    }
}
