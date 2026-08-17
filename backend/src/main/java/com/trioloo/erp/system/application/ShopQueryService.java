package com.trioloo.erp.system.application;

import com.trioloo.erp.access.application.ActorDirectory;
import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.integration.application.ChannelAuthorisationRegistry;
import com.trioloo.erp.integration.application.ChannelConnectionPort;
import com.trioloo.erp.integration.application.ConnectionUnavailableException;
import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.system.domain.ChannelTypeCode;
import com.trioloo.erp.system.domain.ConfigurationState;
import com.trioloo.erp.system.infrastructure.persistence.ShopEntity;
import com.trioloo.erp.system.infrastructure.persistence.ShopRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Composes the Shops & Channels read model.
 *
 * <p>🔴 AUTHORISATION IS ENFORCED HERE, ON EVERY ENTRY POINT ({@code PRM-004},
 * {@code PRM-090.c}). The frontend omitting a control is an affordance, never a control
 * ({@code PRJ-120}, {@code SCS-050.c}): an actor arriving by URL or by API is refused
 * identically.
 *
 * <p>🔴 TWO OWNERS, READ SEPARATELY ({@code SCS-040}). The shop record is System's; the
 * connection condition is Integration's and is reached only through
 * {@link ChannelConnectionPort}. When that read fails the shop is still returned in full and
 * the connection is reported as UNKNOWN ({@code SCS-043.a}) — a remote failure never blanks
 * out local canonical data.
 */
@Service
public class ShopQueryService {

    private final ShopRepository shops;
    private final ChannelConnectionPort connections;
    private final ChannelAuthorisationRegistry authorisation;
    private final ActorDirectory actors;
    private final CurrentActor currentActor;

    public ShopQueryService(ShopRepository shops,
                            ChannelConnectionPort connections,
                            ChannelAuthorisationRegistry authorisation,
                            ActorDirectory actors,
                            CurrentActor currentActor) {
        this.shops = shops;
        this.connections = connections;
        this.authorisation = authorisation;
        this.actors = actors;
        this.currentActor = currentActor;
    }

    private Actor requireViewer() {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(SystemPermissions.CHANNEL_INSTANCE_VIEW)) {
            throw new ShopAccessDeniedException(SystemPermissions.CHANNEL_INSTANCE_VIEW);
        }
        return actor;
    }

    // ------------------------------------------------------------------ workspace

    /**
     * {@code SCS-024} — the workspace rows.
     *
     * <p>{@code TEC-096} — search, all three filters and the count are resolved by the SERVER.
     * The connection filter is resolved through Integration's port first and then applied as
     * an identifier restriction, so the two modules stay separate and the page still comes
     * back correctly counted rather than trimmed after the fact.
     */
    @Transactional(readOnly = true)
    public Page<ShopViews.ShopRow> list(ShopFilter filter, Pageable pageable) {
        requireViewer();

        Collection<UUID> restrictIds = List.of();
        boolean restricted = false;
        if (filter.connection() != null) {
            List<ShopEntity> candidates = shops.searchAll(filter.search(), filter.channelType(),
                    filter.configuration());
            Map<UUID, ChannelConnectionPort.ConnectionProjection> conditions =
                    readConnections(idsOf(candidates));
            if (conditions == null) {
                /*
                  🔴 Integration could not be read, so no shop can honestly be claimed to
                  match a CONNECTION filter. SYS-034 — the truthful answer is that the
                  question cannot be answered, not a silently emptied or unfiltered list.
                */
                throw new ConnectionUnavailableException(
                        "The connection state could not be read, so shops cannot be filtered by it.");
            }
            restricted = true;
            restrictIds = candidates.stream()
                    .filter(shop -> conditions.get(shop.getId()).state() == filter.connection())
                    .map(ShopEntity::getId)
                    .toList();
            if (restrictIds.isEmpty()) {
                /* An empty IN-list is not portable; an empty page is the same true answer. */
                return new PageImpl<>(List.of(), pageable, 0);
            }
        }

        Page<ShopEntity> found = shops.search(filter.search(), filter.channelType(),
                filter.configuration(), restricted, restrictIds, pageable);

        Map<UUID, ChannelConnectionPort.ConnectionProjection> conditions =
                readConnections(idsOf(found.getContent()));

        List<ShopViews.ShopRow> rows = found.getContent().stream()
                .map(shop -> new ShopViews.ShopRow(
                        shop.getId(),
                        shop.getCode(),
                        shop.getName(),
                        shop.getChannelType(),
                        shop.getChannelType().label(),
                        shop.getConfiguration(),
                        /* 🔴 null = not known. NEVER defaulted to NOT_CONNECTED (SCS-043.a). */
                        conditions == null ? null : conditions.get(shop.getId()).state(),
                        shop.getExternalLink(),
                        shop.isBound()))
                .toList();

        return new PageImpl<>(rows, pageable, found.getTotalElements());
    }

    /** The unfiltered corpus size, so a filtered-empty result can say how many DO exist. */
    @Transactional(readOnly = true)
    public long totalRegistered() {
        requireViewer();
        return shops.count();
    }

    /**
     * {@code SCS-020} — the summary strip.
     *
     * <p>🔴 EVERY FIGURE IS DERIVED HERE, from the same records the rows show
     * ({@code SCS-020.a}). No counter column is read, because none exists.
     *
     * <p>{@code UX-044.b} — computed over the ACTIVE FILTER SET and never over the visible
     * page: pagination is presentation and does not define scope.
     */
    @Transactional(readOnly = true)
    public ShopViews.ShopSummary summary(ShopFilter filter) {
        requireViewer();

        List<ShopEntity> matching = shops.searchAll(filter.search(), filter.channelType(),
                filter.configuration());
        Map<UUID, ChannelConnectionPort.ConnectionProjection> conditions =
                readConnections(idsOf(matching));

        if (filter.connection() != null && conditions != null) {
            ConnectionState wanted = filter.connection();
            matching = matching.stream()
                    .filter(shop -> conditions.get(shop.getId()).state() == wanted)
                    .toList();
        }

        // ---- all-shops card: the CONFIGURATION split, which needs no Integration read.
        Map<ConfigurationState, Integer> configurationCounts = new EnumMap<>(ConfigurationState.class);
        Map<ChannelTypeCode, List<ShopEntity>> byType = new LinkedHashMap<>();
        for (ShopEntity shop : matching) {
            configurationCounts.merge(shop.getConfiguration(), 1, Integer::sum);
            byType.computeIfAbsent(shop.getChannelType(), key -> new ArrayList<>()).add(shop);
        }

        ShopViews.AllShopsCard allShops = new ShopViews.AllShopsCard(
                byType.size(), matching.size(), configurationFigures(configurationCounts));

        // ---- one card per channel type PRESENT, in the canonical set order.
        List<ShopViews.ChannelTypeCard> cards = new ArrayList<>();
        for (ChannelTypeCode type : ChannelTypeCode.values()) {
            List<ShopEntity> ofType = byType.get(type);
            if (ofType == null) {
                continue;
            }
            if (conditions == null) {
                /*
                  🔴 SYS-034 — Integration is unreadable, so the card states the shop count
                  it genuinely knows and claims NO attention figure and NO connection split.
                  Counting every shop as not connected would be a fabricated business claim.
                */
                cards.add(new ShopViews.ChannelTypeCard(type, type.label(), ofType.size(), null, List.of()));
                continue;
            }
            Map<ConnectionState, Integer> connectionCounts = new EnumMap<>(ConnectionState.class);
            int attention = 0;
            for (ShopEntity shop : ofType) {
                ConnectionState state = conditions.get(shop.getId()).state();
                connectionCounts.merge(state, 1, Integer::sum);
                /*
                  🔴 SCS-021 — "needs attention" is a shop whose connection is NOT connected.
                  Configuration contributes nothing: DRAFT is not attention and SUSPENDED
                  never enters this figure.
                */
                if (state != ConnectionState.CONNECTED) {
                    attention++;
                }
            }
            cards.add(new ShopViews.ChannelTypeCard(type, type.label(), ofType.size(), attention,
                    connectionFigures(connectionCounts)));
        }

        return new ShopViews.ShopSummary(allShops, cards, conditions != null);
    }

    // ------------------------------------------------------------------ detail

    /** {@code SCS-040} — one shop, in full. */
    @Transactional(readOnly = true)
    public ShopViews.ShopDetail detail(UUID id) {
        requireViewer();
        ShopEntity shop = shops.findById(id).orElseThrow(() -> new ShopNotFoundException(id));

        ChannelConnectionPort.ConnectionProjection condition;
        try {
            condition = connections.read(id);
        } catch (ConnectionUnavailableException e) {
            /*
              🔴 SCS-043.a — the page still renders in full. Everything below this line is
              Trioloo's own record and is accurate; only the condition is unknown.
            */
            condition = null;
        }

        boolean bound = shop.isBound();
        boolean draft = shop.getConfiguration() == ConfigurationState.DRAFT;

        return new ShopViews.ShopDetail(
                shop.getId(),
                shop.getCode(),
                shop.getName(),
                shop.getChannelType(),
                shop.getChannelType().label(),
                shop.getMarket(),
                /* ⚠ SYS-034 — a market that was never recorded stays absent, not guessed. */
                shop.getMarket() == null ? null : shop.getMarket().label(),
                shop.getConfiguration(),
                condition != null,
                condition == null ? null : condition.state(),
                condition == null ? null : condition.lastCheckedAt(),
                shop.getExternalAccountIdentity(),
                shop.getExternalLink(),
                shop.getBoundAt(),
                shop.getAuthorisedAt(),
                shop.getActivatedAt(),
                actors.nameOf(shop.getActivatedBy()),
                shop.channelTypeChangeable(),
                shop.marketChangeable(),
                /*
                  🔴 SCS-051.b — AUTHORISATION NEVER ACTIVATES, and being connected is not the
                  test. The test is DRAFT plus a bound account, and nothing else.
                */
                draft && bound,
                activationBlockedReason(draft, bound),
                authorisation.supports(shop.getChannelType()),
                authorisation.unsupportedReason(shop.getChannelType()));
    }

    /**
     * {@code SCS-051.c} — why {@code Activate} cannot run, in the approved words.
     *
     * <p>⚠ Returns null when it CAN run. The reason accompanies a visible, greyed control; it
     * is never used to hide one, which is a permission decision and a different mechanism
     * ({@code SCS-050.b}).
     */
    private static String activationBlockedReason(boolean draft, boolean bound) {
        if (draft && bound) {
            return null;
        }
        if (!draft) {
            return "This shop has already been activated.";
        }
        return "Connect the account first — an active shop must have a verified account.";
    }

    // ------------------------------------------------------------------ helpers

    /**
     * Reads Integration, or returns null when it cannot be read.
     *
     * <p>🔴 NULL MEANS "NOT KNOWN" AND IS PROPAGATED AS SUCH. It is never coerced to
     * {@code NOT_CONNECTED}, which is a real condition and a different claim.
     */
    private Map<UUID, ChannelConnectionPort.ConnectionProjection> readConnections(Set<UUID> ids) {
        try {
            return connections.read(ids);
        } catch (ConnectionUnavailableException e) {
            return null;
        }
    }

    private static Set<UUID> idsOf(Collection<ShopEntity> entities) {
        return entities.stream().map(ShopEntity::getId).collect(Collectors.toCollection(java.util.LinkedHashSet::new));
    }

    /**
     * 🔴 {@code SCS-020.b} — ONLY STATES THAT ACTUALLY OCCUR PRODUCE A LINE. A zero is not
     * rendered as a zero; the line does not exist. Order follows the approved pack.
     */
    private static List<ShopViews.Figure> configurationFigures(Map<ConfigurationState, Integer> counts) {
        List<ShopViews.Figure> figures = new ArrayList<>();
        for (ConfigurationState state : List.of(ConfigurationState.ACTIVE, ConfigurationState.DRAFT,
                ConfigurationState.SUSPENDED, ConfigurationState.ARCHIVED)) {
            Integer count = counts.get(state);
            if (count != null && count > 0) {
                figures.add(new ShopViews.Figure(state.name(), LABELS.get(state), count));
            }
        }
        return figures;
    }

    private static List<ShopViews.Figure> connectionFigures(Map<ConnectionState, Integer> counts) {
        List<ShopViews.Figure> figures = new ArrayList<>();
        for (ConnectionState state : List.of(ConnectionState.CONNECTED, ConnectionState.REAUTH_REQUIRED,
                ConnectionState.NOT_CONNECTED, ConnectionState.ERROR)) {
            Integer count = counts.get(state);
            if (count != null && count > 0) {
                figures.add(new ShopViews.Figure(state.name(), CONNECTION_LABELS.get(state), count));
            }
        }
        return figures;
    }

    private static final Map<ConfigurationState, String> LABELS = Map.of(
            ConfigurationState.ACTIVE, "Active",
            ConfigurationState.DRAFT, "Draft",
            ConfigurationState.SUSPENDED, "Suspended",
            ConfigurationState.ARCHIVED, "Archived");

    /** The approved pack's exact wording. ⚠ Never a provider term ({@code SCS-043.b}). */
    private static final Map<ConnectionState, String> CONNECTION_LABELS = Map.of(
            ConnectionState.CONNECTED, "Connected",
            ConnectionState.REAUTH_REQUIRED, "Reauthorization required",
            ConnectionState.NOT_CONNECTED, "Not connected",
            ConnectionState.ERROR, "Connection error");
}
