package com.trioloo.erp.system.infrastructure.persistence;

import com.trioloo.erp.system.domain.ChannelTypeCode;
import com.trioloo.erp.system.domain.ConfigurationState;
import com.trioloo.erp.system.domain.MarketCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * {@code E-016} Channel Instance — the System-owned, WRITABLE record ({@code DM-084.b}).
 *
 * <p>⚠ Product maps the same table as a deliberately read-only registered reference
 * ({@code ChannelInstanceEntity}). Two mappings, one table, one owner: Product consumes the
 * record and never writes it, and this class is the only place it is created or changed.
 * Moving Product's reference is unrelated scope and was not done.
 *
 * <p>🔴 NO CREDENTIAL FIELD EXISTS HERE, and none may be added ({@code API-070},
 * {@code SCS-052}). The remote account IDENTITY is a business fact; the secrets that prove
 * authority over it are Integration's and never enter this aggregate.
 *
 * <p>🔴 {@code INV-16.5} — {@link #externalAccountIdentity} and {@link #externalLink} are
 * REMOTE-DERIVED. The only mutators for them are the authorisation-completion methods below,
 * which no operator-facing command path can reach.
 */
@Entity
@Table(name = "channel_instance")
public class ShopEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** {@code INV-16.4} — ERP-assigned, unique, stable, never typed ({@code SCS-091}). */
    @Column(name = "code", nullable = false, length = 80, updatable = false)
    private String code;

    /** {@code SCS-024.a} — the shop's own name is its primary identity, not its channel. */
    @Column(name = "name", nullable = false, length = 160)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "channel_type", nullable = false, length = 80)
    private ChannelTypeCode channelType;

    @Enumerated(EnumType.STRING)
    @Column(name = "record_status", nullable = false, length = 16)
    private ConfigurationState configuration;

    /**
     * {@code INV-16.7} — from the CLOSED ERP-supplied set, never free text.
     *
     * <p>⚠ Nullable because two rows predate the feature and genuinely have no recorded
     * market ({@code SYS-034}); nothing backfills them. Registration requires one.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "market", length = 80)
    private MarketCode market;

    @Column(name = "external_account_identity", length = 160)
    private String externalAccountIdentity;

    @Column(name = "external_link", length = 500)
    private String externalLink;

    @Column(name = "bound_at")
    private Instant boundAt;

    @Column(name = "authorised_at")
    private Instant authorisedAt;

    @Column(name = "activated_at")
    private Instant activatedAt;

    @Column(name = "activated_by")
    private UUID activatedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ShopEntity() {
    }

    /**
     * Registers a shop.
     *
     * <p>🔴 {@code SCS-030} — the initial states are fixed and are NOT parameters:
     * {@code DRAFT} configuration, no bound account, no link, no authorisation and no
     * activation. Nothing here auto-connects or auto-activates, and there is no overload
     * that would let a caller ask it to.
     */
    public static ShopEntity register(String name, ChannelTypeCode channelType, MarketCode market,
                                      String code, Instant now) {
        ShopEntity shop = new ShopEntity();
        shop.id = UUID.randomUUID();
        shop.code = code;
        shop.name = name;
        shop.channelType = channelType;
        shop.market = market;
        shop.configuration = ConfigurationState.DRAFT;
        shop.createdAt = now;
        shop.updatedAt = now;
        return shop;
    }

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public ChannelTypeCode getChannelType() { return channelType; }
    public ConfigurationState getConfiguration() { return configuration; }
    public MarketCode getMarket() { return market; }
    public String getExternalAccountIdentity() { return externalAccountIdentity; }
    public String getExternalLink() { return externalLink; }
    public Instant getBoundAt() { return boundAt; }
    public Instant getAuthorisedAt() { return authorisedAt; }
    public Instant getActivatedAt() { return activatedAt; }
    public UUID getActivatedBy() { return activatedBy; }

    /** {@code INV-16.5} — a bound shop has an authoritative remote account. */
    public boolean isBound() {
        return externalAccountIdentity != null;
    }

    /**
     * Renames the shop.
     *
     * <p>⚠ The ONLY freely mutable operator fact ({@code SCS-030}). Channel type and market
     * have no setter at all once fixed — see {@link #changeMarket}.
     */
    public void rename(String newName, Instant now) {
        this.name = newName;
        this.updatedAt = now;
    }

    /**
     * 🔴 {@code SCS-030} — permitted ONLY while no account is bound. The caller checks and
     * reports; this refuses regardless, because an invariant that only the caller enforces
     * is not an invariant.
     */
    public void changeMarket(MarketCode newMarket, Instant now) {
        if (isBound()) {
            throw new IllegalStateException(
                    "An account is bound to this shop, so the market is settled (SCS-030)");
        }
        this.market = newMarket;
        this.updatedAt = now;
    }

    /**
     * 🔴 {@code SCS-030} — permitted ONLY while the shop is not in operational use. A shop
     * that has ever been bound or activated keeps the channel type it was registered with.
     */
    public void changeChannelType(ChannelTypeCode newType, Instant now) {
        if (!channelTypeChangeable()) {
            throw new IllegalStateException(
                    "This shop is in operational use, so its channel type can no longer change (SCS-030)");
        }
        this.channelType = newType;
        this.updatedAt = now;
    }

    /** {@code SCS-030} — in operational use means bound, or ever activated. */
    public boolean channelTypeChangeable() {
        return !isBound() && configuration == ConfigurationState.DRAFT && activatedAt == null;
    }

    /** {@code SCS-030} — the market settles when an account binds. */
    public boolean marketChangeable() {
        return !isBound();
    }

    /**
     * FIRST BINDING — {@code INV-16.5}, {@code SCS-044}.
     *
     * <p>🔴 Refuses if an account is already bound. Rebinding is not a capability this
     * aggregate offers: {@code SCS-044} rejects a different account outright, and the same
     * account is a RENEWAL, which is {@link #renewAuthorisation}.
     */
    public void bindAccount(String accountIdentity, String link, Instant observedAt) {
        if (isBound()) {
            throw new IllegalStateException(
                    "This shop is already bound to " + externalAccountIdentity
                            + "; a different account is never rebound (INV-16.6, SCS-044)");
        }
        this.externalAccountIdentity = accountIdentity;
        this.externalLink = link;
        this.boundAt = observedAt;
        this.authorisedAt = observedAt;
        this.updatedAt = observedAt;
    }

    /**
     * RENEWAL of the SAME account — {@code INV-16.6}, {@code SCS-042.b}.
     *
     * <p>🔴 {@link #boundAt} IS DELIBERATELY NOT TOUCHED. Re-authorising renews the
     * authorisation; it does not re-bind, so the binding date is stable across renewals.
     *
     * <p>⚠ The link is refreshed because it is remote-derived and the channel may have moved
     * it. It is still never identity ({@code INV-16.14}).
     */
    public void renewAuthorisation(String link, Instant observedAt) {
        if (!isBound()) {
            throw new IllegalStateException("Nothing is bound to renew (INV-16.6)");
        }
        this.externalLink = link;
        this.authorisedAt = observedAt;
        this.updatedAt = observedAt;
    }

    /**
     * {@code SCS-051} — {@code DRAFT → ACTIVE}, with attribution captured HERE, at the moment
     * of the transition ({@code AGV-001}, {@code INV-16.15}).
     *
     * <p>🔴 Refuses unless an account is bound: {@code SCS-051.c} — an active shop must have a
     * verified account. 🔴 Leaves the connection untouched ({@code SCS-051.d}).
     */
    public void activate(UUID actorId, Instant now) {
        if (configuration != ConfigurationState.DRAFT) {
            throw new IllegalStateException("Only a DRAFT shop can be activated (SCS-051.a)");
        }
        if (!isBound()) {
            throw new IllegalStateException(
                    "Connect the account first — an active shop must have a verified account (SCS-051.c)");
        }
        this.configuration = ConfigurationState.ACTIVE;
        this.activatedAt = now;
        this.activatedBy = actorId;
        this.updatedAt = now;
    }
}
