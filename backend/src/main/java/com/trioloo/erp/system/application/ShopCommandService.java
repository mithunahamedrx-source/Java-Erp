package com.trioloo.erp.system.application;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.system.domain.ChannelTypeCode;
import com.trioloo.erp.system.domain.MarketCode;
import com.trioloo.erp.system.infrastructure.persistence.ShopEntity;
import com.trioloo.erp.system.infrastructure.persistence.ShopRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Registers and edits shops — {@code SC-F}'s write side.
 *
 * <p>🔴 THREE OPERATOR INPUTS, AND ONLY THREE ({@code SCS-030.a}): display name, channel type
 * and market. The input record below has nowhere to put an internal code, an account
 * identity, a link, a configuration state, a connection state or a credential, so no client
 * can ask this service to write one.
 *
 * <p>🔴 {@code SCS-030.d} — IT NEITHER CREATES NOR CONTACTS THE REMOTE ACCOUNT. Nothing here
 * connects, authorises or activates, and no code path exists that would.
 *
 * <p>🔴 Authorisation is enforced on every entry point ({@code PRM-004}). {@code PRM-090.a} —
 * {@code manage} is checked here and confers nothing else: it is NOT lifecycle authority and
 * NOT authorisation authority.
 */
@Service
public class ShopCommandService {

    private final ShopRepository shops;
    private final CurrentActor currentActor;
    private final Clock clock;

    public ShopCommandService(ShopRepository shops, CurrentActor currentActor, Clock clock) {
        this.shops = shops;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    private void requireManager() {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(SystemPermissions.CHANNEL_INSTANCE_MANAGE)) {
            throw new ShopAccessDeniedException(SystemPermissions.CHANNEL_INSTANCE_MANAGE);
        }
    }

    /**
     * Registers one shop.
     *
     * <p>🔴 THE INITIAL STATES ARE NOT NEGOTIABLE ({@code SCS-030.c}): {@code DRAFT}
     * configuration, {@code NOT_CONNECTED} connection — expressed as the ABSENCE of a
     * connection record, so nothing fabricated is written — an ERP-assigned internal code, and
     * no bound account until a real authorisation binds one.
     */
    @Transactional
    public UUID create(ShopInput input) {
        requireManager();

        String name = requireName(input.name());
        ChannelTypeCode channelType = requireOfferedChannelType(input.channelType());
        MarketCode market = requireMarket(input.market());
        Instant now = clock.instant();

        ShopEntity shop = ShopEntity.register(name, channelType, market, nextCode(), now);
        return shops.save(shop).getId();
    }

    /**
     * Updates the mutable local facts.
     *
     * <p>🔴 {@code SCS-030} — WHAT IS FIXED IS REFUSED, NOT SILENTLY IGNORED. A request that
     * would change a settled channel type or market fails with the reason the operator reads
     * on the form. Silently discarding it would tell them the save succeeded when their
     * intended change did not happen.
     *
     * <p>⚠ Submitting the SAME value for a fixed field is not a change and is accepted, so a
     * form that round-trips every field still saves the one thing that did move.
     */
    @Transactional
    public void update(UUID id, ShopInput input) {
        requireManager();
        ShopEntity shop = shops.findById(id).orElseThrow(() -> new ShopNotFoundException(id));
        Instant now = clock.instant();

        shop.rename(requireName(input.name()), now);

        ChannelTypeCode channelType = requireOfferedChannelType(input.channelType());
        if (channelType != shop.getChannelType()) {
            if (!shop.channelTypeChangeable()) {
                throw new ShopValidationException("channelType",
                        "This shop is in operational use, so its channel type can no longer change. "
                                + "Register a separate shop for a different channel.");
            }
            shop.changeChannelType(channelType, now);
        }

        MarketCode market = requireMarket(input.market());
        if (market != shop.getMarket()) {
            if (!shop.marketChangeable()) {
                throw new ShopValidationException("market",
                        "An external account is bound to this shop, so the market is settled.");
            }
            shop.changeMarket(market, now);
        }
    }

    /**
     * {@code SCS-051} — {@code Activate}, the ONLY lifecycle action in this release.
     *
     * <p>🔴 A DIFFERENT CAPABILITY FROM {@code manage} ({@code PRM-090.a}). Editing a shop's
     * display name and approving it for operational use are different acts.
     *
     * <p>🔴 {@code SCS-051.b} — AUTHORISATION NEVER ACTIVATES, AND CONNECTION IS NOT THE TEST.
     * The test is {@code DRAFT} plus a BOUND ACCOUNT ({@code SCS-051.c}); this service never
     * reads the connection condition, and could not activate on it if it wanted to.
     *
     * <p>🔴 {@code AGV-001} — the actor is captured BY THE TRANSITION, at the moment it
     * happens, never reconstructed afterwards.
     */
    @Transactional
    public void activate(UUID id) {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(SystemPermissions.CHANNEL_INSTANCE_LIFECYCLE)) {
            throw new ShopAccessDeniedException(SystemPermissions.CHANNEL_INSTANCE_LIFECYCLE);
        }
        ShopEntity shop = shops.findById(id).orElseThrow(() -> new ShopNotFoundException(id));

        if (shop.getConfiguration() != com.trioloo.erp.system.domain.ConfigurationState.DRAFT) {
            throw new ShopValidationException("configuration", "This shop has already been activated.");
        }
        if (!shop.isBound()) {
            throw new ShopValidationException("configuration",
                    "Connect the account first — an active shop must have a verified account.");
        }
        shop.activate(actor.id(), clock.instant());
    }

    // ------------------------------------------------------------------ validation

    /** {@code SCS-030.e} — the message is the one that appears UNDER the field. */
    private static String requireName(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ShopValidationException("name", "A shop needs a name operators can recognise.");
        }
        return raw.trim();
    }

    /**
     * 🔴 {@code INV-15.4} / {@code SCS-030.b} — SELECTION FROM THE OFFERED SET, NEVER FREE
     * TEXT. An unrecognised value is REJECTED rather than stored, because adapter resolution
     * reads this column and an unknown value produces a shop that can never resolve one.
     *
     * <p>⚠ Validated against what the registry OFFERS, not merely against the recognised set
     * ({@code SCS-092.b}) — otherwise the API would accept a manual channel the form never
     * shows, and the surface and the server would disagree about what a shop can be.
     */
    private static ChannelTypeCode requireOfferedChannelType(String raw) {
        Optional<ChannelTypeCode> resolved = ChannelTypeCode.resolve(raw);
        if (resolved.isEmpty() || !OFFERED.contains(resolved.get())) {
            throw new ShopValidationException("channelType", "Choose the channel this shop operates on.");
        }
        return resolved.get();
    }

    /**
     * {@code INV-16.7} — one instance, one market, SELECTED FROM THE CLOSED ERP-SUPPLIED SET.
     *
     * <p>🔴 FREE TEXT IS FORBIDDEN, and an unrecognised value is REJECTED rather than
     * normalised. Quietly mapping arbitrary text onto the single current member would turn an
     * operator's mistake into a business fact, and would hide the day a second market is
     * genuinely needed.
     *
     * <p>⚠ The set is ratified canon ({@link MarketCode}); adding a member is a canonical
     * amendment, never a change here.
     */
    private static MarketCode requireMarket(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new ShopValidationException("market", "Choose the market this shop operates in.");
        }
        return MarketCode.resolve(raw).orElseThrow(() -> new ShopValidationException(
                "market", "Choose the market this shop operates in."));
    }

    /**
     * {@code SCS-092.a} — what the registry offers, transcribed from the approved selector.
     *
     * <p>⚠ Shared with {@code ShopController} through this one list so the form and the
     * validator can never disagree.
     */
    public static final List<ChannelTypeCode> OFFERED = List.of(
            ChannelTypeCode.DARAZ, ChannelTypeCode.WEBSITE,
            ChannelTypeCode.SHOPIFY, ChannelTypeCode.WOOCOMMERCE);

    /**
     * {@code SCS-091} — the ERP assigns the code. 🔴 Never operator-supplied, and no
     * code-edit workflow exists anywhere.
     *
     * <p>⚠ The database's unique constraint remains the authority; this only chooses the next
     * unused number. A concurrent registration loses the race at the constraint, not here.
     */
    private String nextCode() {
        return String.format("CHN-%06d", shops.highestAssignedCodeNumber() + 1);
    }

    /**
     * The three operator inputs.
     *
     * <p>🔴 Deliberately carries no code, account identity, link, configuration, connection,
     * key, secret or token. A client cannot ask this API to write any of them, because the
     * request has nowhere to put them ({@code SCS-030}, {@code SCS-052}).
     */
    public record ShopInput(String name, String channelType, String market) {
    }
}
