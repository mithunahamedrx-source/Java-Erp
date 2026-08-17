package com.trioloo.erp.system.application;

import com.trioloo.erp.access.AccessFixtures;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.integration.application.ChannelConnectionPort;
import com.trioloo.erp.integration.application.ConnectionUnavailableException;
import com.trioloo.erp.integration.application.IntegrationPermissions;
import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.integration.infrastructure.StoredChannelConnectionAdapter;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionRepository;
import com.trioloo.erp.system.domain.ChannelTypeCode;
import com.trioloo.erp.system.domain.ConfigurationState;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * FRAME 01 — the Shops & Channels workspace.
 *
 * <p>🔴 THE CLAIMS UNDER TEST are that the workspace is entirely SERVER-RESOLVED, that every
 * summary figure is DERIVED rather than stored, that "needs attention" carries exactly the
 * {@code SCS-021} meaning, and that an unreadable connection never becomes a claim.
 *
 * <p>🔴 THE MOST IMPORTANT ONE: when Integration cannot be read, the shops still come back in
 * full and NOTHING is counted as {@code NOT_CONNECTED}. Substituting that value would be a
 * fabricated business claim, and this suite fails if it ever happens.
 */
@SpringBootTest
class ShopsWorkspaceTest {

    /** ⚠ Swapped per test. The only way an unreadable connection can be exercised at all. */
    private static volatile boolean integrationReadable = true;

    @TestConfiguration
    static class Ports {

        /**
         * ⚠ A CONTROLLED DOUBLE that delegates to the real stored adapter unless a test has
         * asked it to fail. 🔴 It fabricates no condition of its own.
         */
        @Bean
        @Primary
        ChannelConnectionPort switchableConnectionPort(ChannelConnectionRepository repository) {
            StoredChannelConnectionAdapter real = new StoredChannelConnectionAdapter(repository);
            return new ChannelConnectionPort() {
                @Override
                public ConnectionProjection read(UUID channelInstanceId) {
                    refuseWhenUnreadable();
                    return real.read(channelInstanceId);
                }

                @Override
                public Map<UUID, ConnectionProjection> read(Collection<UUID> ids) {
                    refuseWhenUnreadable();
                    return real.read(ids);
                }

                private void refuseWhenUnreadable() {
                    if (!integrationReadable) {
                        throw new ConnectionUnavailableException(
                                "The connection state could not be read just now.");
                    }
                }
            };
        }
    }

    @Autowired
    private ShopQueryService queries;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private AccessFixtures fixtures;
    private UUID actorId;

    @BeforeEach
    void setUp() {
        fixtures = new AccessFixtures(jdbc, passwordEncoder);
        clearShops();
        fixtures.clear();
        for (String permission : List.of(SystemPermissions.CHANNEL_INSTANCE_VIEW,
                SystemPermissions.CHANNEL_INSTANCE_MANAGE,
                SystemPermissions.CHANNEL_INSTANCE_LIFECYCLE,
                IntegrationPermissions.CHANNEL_CONNECTION_AUTHORIZE)) {
            fixtures.createPermission(permission);
        }
        actorId = fixtures.createProfile("sc-tester", "irrelevant", AccountLifecycleState.ACTIVE);
        integrationReadable = true;
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clearShops();
        integrationReadable = true;
    }

    // =================================================================================
    // Permission — PRM-090, SCS-050
    // =================================================================================

    @Test
    @DisplayName("PRM-004 the workspace refuses an actor without system.channel-instance.view")
    void listRefusesWithoutViewCapability() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE);

        assertThatThrownBy(() -> queries.list(ShopFilter.unfiltered(), PageRequest.of(0, 50)))
                .isInstanceOf(ShopAccessDeniedException.class)
                .hasMessageContaining(SystemPermissions.CHANNEL_INSTANCE_VIEW);
    }

    /** 🔴 {@code PRM-090.a} — MANAGE is not VIEW, and neither is LIFECYCLE. */
    @Test
    @DisplayName("PRM-090.a the summary refuses an actor holding only lifecycle")
    void summaryRefusesWithoutViewCapability() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_LIFECYCLE);

        assertThatThrownBy(() -> queries.summary(ShopFilter.unfiltered()))
                .isInstanceOf(ShopAccessDeniedException.class)
                .hasMessageContaining(SystemPermissions.CHANNEL_INSTANCE_VIEW);
    }

    // =================================================================================
    // SCS-024 — the row
    // =================================================================================

    @Test
    @DisplayName("SCS-024 a row carries the shop's own name, both states and the external link")
    void rowsCarryTheApprovedColumns() {
        UUID id = seedShop("CHN-000114", "Zeon Mart · Daraz", ChannelTypeCode.DARAZ,
                ConfigurationState.ACTIVE, "zeonmart_bd", "https://daraz.example/zeonmart");
        seedConnection(id, ConnectionState.CONNECTED);
        acting();

        var rows = queries.list(ShopFilter.unfiltered(), PageRequest.of(0, 50)).getContent();

        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.name()).isEqualTo("Zeon Mart · Daraz");
            assertThat(row.channelTypeLabel()).isEqualTo("Daraz");
            assertThat(row.configuration()).isEqualTo(ConfigurationState.ACTIVE);
            assertThat(row.connection()).isEqualTo(ConnectionState.CONNECTED);
            assertThat(row.externalLink()).isEqualTo("https://daraz.example/zeonmart");
            assertThat(row.bound()).isTrue();
        });
    }

    /**
     * 🔴 {@code SCS-024.b} — CONFIGURATION AND CONNECTION ARE INDEPENDENT. This is the case
     * the contract is built around: suspended, and still connected.
     */
    @Test
    @DisplayName("SCS-024.b a suspended shop can still be connected")
    void configurationAndConnectionAreIndependent() {
        UUID id = seedShop("CHN-000200", "MME Website", ChannelTypeCode.WEBSITE,
                ConfigurationState.SUSPENDED, "mme_web", "https://mme.example");
        seedConnection(id, ConnectionState.CONNECTED);
        acting();

        var row = queries.list(ShopFilter.unfiltered(), PageRequest.of(0, 50)).getContent().getFirst();

        assertThat(row.configuration()).isEqualTo(ConfigurationState.SUSPENDED);
        assertThat(row.connection()).isEqualTo(ConnectionState.CONNECTED);
    }

    /** {@code SCS-043} — absence of a connection record IS {@code NOT_CONNECTED}. */
    @Test
    @DisplayName("SCS-043 a shop that has never been authorised reads NOT_CONNECTED")
    void absenceOfARecordMeansNeverAuthorised() {
        seedShop("CHN-000300", "Friday PC · Daraz", ChannelTypeCode.DARAZ, ConfigurationState.DRAFT, null, null);
        acting();

        var row = queries.list(ShopFilter.unfiltered(), PageRequest.of(0, 50)).getContent().getFirst();

        assertThat(row.connection()).isEqualTo(ConnectionState.NOT_CONNECTED);
        assertThat(row.bound()).isFalse();
        assertThat(row.externalLink()).isNull();
    }

    // =================================================================================
    // SCS-022 — search
    // =================================================================================

    @Test
    @DisplayName("SCS-022 search matches shop name, internal code and external link")
    void searchCoversTheThreeApprovedFields() {
        seedShop("CHN-000114", "Zeon Mart · Daraz", ChannelTypeCode.DARAZ, ConfigurationState.ACTIVE,
                "zeonmart_bd", "https://daraz.example/zeonmart");
        seedShop("CHN-000900", "Trioloo Website", ChannelTypeCode.WEBSITE, ConfigurationState.DRAFT, null, null);
        acting();

        assertThat(namesMatching("Zeon")).containsExactly("Zeon Mart · Daraz");
        assertThat(namesMatching("000900")).containsExactly("Trioloo Website");
        assertThat(namesMatching("daraz.example")).containsExactly("Zeon Mart · Daraz");
    }

    /**
     * 🔴 {@code SCS-022} FIXES THE SCOPE AT THREE FIELDS. The bound ACCOUNT IDENTITY is
     * deliberately not searchable — widening the scope would be an invented capability, so
     * this test fails if someone adds it without ratification.
     */
    @Test
    @DisplayName("SCS-022 search does NOT reach the bound account identity")
    void searchDoesNotSilentlyWiden() {
        seedShop("CHN-000114", "Zeon Mart · Daraz", ChannelTypeCode.DARAZ, ConfigurationState.ACTIVE,
                "zeonmart_bd", null);
        acting();

        assertThat(namesMatching("zeonmart_bd")).isEmpty();
    }

    // =================================================================================
    // SCS-023 — filters
    // =================================================================================

    @Test
    @DisplayName("SCS-023 channel, connection and status each filter, and combine as AND")
    void filtersApplyIndividuallyAndTogether() {
        UUID connected = seedShop("CHN-1", "Daraz connected", ChannelTypeCode.DARAZ,
                ConfigurationState.ACTIVE, "a", null);
        seedConnection(connected, ConnectionState.CONNECTED);
        UUID reauth = seedShop("CHN-2", "Daraz reauth", ChannelTypeCode.DARAZ,
                ConfigurationState.DRAFT, "b", null);
        seedConnection(reauth, ConnectionState.REAUTH_REQUIRED);
        UUID website = seedShop("CHN-3", "Website connected", ChannelTypeCode.WEBSITE,
                ConfigurationState.ACTIVE, "c", null);
        seedConnection(website, ConnectionState.CONNECTED);
        acting();

        assertThat(names(new ShopFilter(null, ChannelTypeCode.DARAZ, null, null)))
                .containsExactlyInAnyOrder("Daraz connected", "Daraz reauth");
        assertThat(names(new ShopFilter(null, null, ConnectionState.CONNECTED, null)))
                .containsExactlyInAnyOrder("Daraz connected", "Website connected");
        assertThat(names(new ShopFilter(null, null, null, ConfigurationState.ACTIVE)))
                .containsExactlyInAnyOrder("Daraz connected", "Website connected");

        // AND, not OR.
        assertThat(names(new ShopFilter(null, ChannelTypeCode.DARAZ, ConnectionState.CONNECTED,
                ConfigurationState.ACTIVE))).containsExactly("Daraz connected");
        assertThat(names(new ShopFilter(null, ChannelTypeCode.WEBSITE, ConnectionState.REAUTH_REQUIRED, null)))
                .isEmpty();
    }

    /** ⚠ {@code SCS-022.b} — an empty result is an ordinary outcome, not an error. */
    @Test
    @DisplayName("SCS-022.b a filter matching nothing returns an empty page, not a failure")
    void anEmptyResultIsOrdinary() {
        seedShop("CHN-1", "Daraz account", ChannelTypeCode.DARAZ, ConfigurationState.ACTIVE, null, null);
        acting();

        var page = queries.list(new ShopFilter(null, ChannelTypeCode.SHOPIFY, null, null),
                PageRequest.of(0, 50));

        assertThat(page.getContent()).isEmpty();
        assertThat(page.getTotalElements()).isZero();
        /* 🔴 SCS-023.c — the corpus size is unchanged by a filter. */
        assertThat(queries.totalRegistered()).isEqualTo(1);
    }

    // =================================================================================
    // SCS-020 / SCS-021 — the summary strip
    // =================================================================================

    /**
     * 🔴 THE ATTENTION ARITHMETIC, taken from the approved pack itself: Daraz with four shops
     * — connected 2, reauthorization required 1, not connected 1 — reports 2 need attention.
     */
    @Test
    @DisplayName("SCS-021 needs attention counts every shop whose connection is not CONNECTED")
    void attentionCountsNonConnectedShops() {
        UUID a = seedShop("CHN-1", "Zeon Mart", ChannelTypeCode.DARAZ, ConfigurationState.ACTIVE, "a", null);
        seedConnection(a, ConnectionState.CONNECTED);
        UUID b = seedShop("CHN-2", "Trioloo", ChannelTypeCode.DARAZ, ConfigurationState.DRAFT, "b", null);
        seedConnection(b, ConnectionState.CONNECTED);
        UUID c = seedShop("CHN-3", "Zeon Tech", ChannelTypeCode.DARAZ, ConfigurationState.ACTIVE, "c", null);
        seedConnection(c, ConnectionState.REAUTH_REQUIRED);
        seedShop("CHN-4", "Friday PC", ChannelTypeCode.DARAZ, ConfigurationState.DRAFT, null, null);
        acting();

        var daraz = queries.summary(ShopFilter.unfiltered()).channelTypes().getFirst();

        assertThat(daraz.shopCount()).isEqualTo(4);
        assertThat(daraz.attentionCount()).isEqualTo(2);
    }

    /**
     * 🔴 {@code SCS-021.b} — CONFIGURATION CONTRIBUTES NOTHING. A DRAFT shop that is connected
     * is not attention, and a SUSPENDED one never enters the figure.
     */
    @Test
    @DisplayName("SCS-021.b draft and suspended do not create attention")
    void configurationNeverCreatesAttention() {
        UUID draft = seedShop("CHN-1", "Draft but connected", ChannelTypeCode.DARAZ,
                ConfigurationState.DRAFT, "a", null);
        seedConnection(draft, ConnectionState.CONNECTED);
        UUID suspended = seedShop("CHN-2", "Suspended but connected", ChannelTypeCode.DARAZ,
                ConfigurationState.SUSPENDED, "b", null);
        seedConnection(suspended, ConnectionState.CONNECTED);
        acting();

        assertThat(queries.summary(ShopFilter.unfiltered()).channelTypes().getFirst().attentionCount())
                .isZero();
    }

    /**
     * 🔴 {@code SCS-020.b} — ONLY CONDITIONS THAT ACTUALLY OCCUR ARE LISTED. The pack shows
     * Daraz WITHOUT a connection-error line because none of its shops is in that condition.
     */
    @Test
    @DisplayName("SCS-020.b a condition that does not occur produces no line, not a zero")
    void absentConditionsProduceNoLine() {
        UUID a = seedShop("CHN-1", "Connected", ChannelTypeCode.DARAZ, ConfigurationState.ACTIVE, "a", null);
        seedConnection(a, ConnectionState.CONNECTED);
        acting();

        var summary = queries.summary(ShopFilter.unfiltered());

        assertThat(summary.channelTypes().getFirst().connectionSplit())
                .extracting(ShopViews.Figure::key).containsExactly("CONNECTED");
        assertThat(summary.allShops().configurationSplit())
                .extracting(ShopViews.Figure::key).containsExactly("ACTIVE");
    }

    @Test
    @DisplayName("SCS-020 the all-shops card carries the channel-type count and configuration split")
    void allShopsCardIsDerived() {
        seedShop("CHN-1", "A", ChannelTypeCode.DARAZ, ConfigurationState.ACTIVE, null, null);
        seedShop("CHN-2", "B", ChannelTypeCode.DARAZ, ConfigurationState.DRAFT, null, null);
        seedShop("CHN-3", "C", ChannelTypeCode.WEBSITE, ConfigurationState.SUSPENDED, null, null);
        acting();

        var summary = queries.summary(ShopFilter.unfiltered());

        assertThat(summary.allShops().shopCount()).isEqualTo(3);
        assertThat(summary.allShops().channelTypeCount()).isEqualTo(2);
        assertThat(summary.allShops().configurationSplit())
                .extracting(ShopViews.Figure::key, ShopViews.Figure::count)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("ACTIVE", 1),
                        org.assertj.core.groups.Tuple.tuple("DRAFT", 1),
                        org.assertj.core.groups.Tuple.tuple("SUSPENDED", 1));
    }

    /** 🔴 {@code SCS-020.c} — one card per channel type PRESENT. Absent types produce no card. */
    @Test
    @DisplayName("SCS-020 only channel types actually present get a card")
    void onlyPresentChannelTypesGetCards() {
        seedShop("CHN-1", "A", ChannelTypeCode.DARAZ, ConfigurationState.ACTIVE, null, null);
        acting();

        assertThat(queries.summary(ShopFilter.unfiltered()).channelTypes())
                .extracting(ShopViews.ChannelTypeCard::channelType)
                .containsExactly(ChannelTypeCode.DARAZ);
    }

    // =================================================================================
    // SCS-043.a — the unreadable connection
    // =================================================================================

    /**
     * 🔴 THE CENTRAL SAFETY CLAIM. Integration is unreadable, and the shops STILL COME BACK.
     * Their connection is reported as UNKNOWN — never coerced to {@code NOT_CONNECTED}, which
     * is a real condition and a different, false claim.
     */
    @Test
    @DisplayName("SCS-043.a an unreadable connection never blanks the list and never becomes NOT_CONNECTED")
    void unreadableConnectionStillRendersTheShops() {
        UUID id = seedShop("CHN-1", "Zeon Mart", ChannelTypeCode.DARAZ, ConfigurationState.ACTIVE, "a", null);
        seedConnection(id, ConnectionState.CONNECTED);
        acting();
        integrationReadable = false;

        var rows = queries.list(ShopFilter.unfiltered(), PageRequest.of(0, 50)).getContent();

        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.name()).isEqualTo("Zeon Mart");
            assertThat(row.configuration()).isEqualTo(ConfigurationState.ACTIVE);
            /* 🔴 null = not known. NOT NOT_CONNECTED. */
            assertThat(row.connection()).isNull();
        });
    }

    /**
     * 🔴 {@code SYS-034} — with Integration unreadable the strip states the configuration
     * split it genuinely knows and makes NO attention claim at all.
     */
    @Test
    @DisplayName("SYS-034 an unreadable connection withholds the attention figure rather than guessing")
    void unreadableConnectionWithholdsTheAttentionFigure() {
        seedShop("CHN-1", "Zeon Mart", ChannelTypeCode.DARAZ, ConfigurationState.ACTIVE, "a", null);
        acting();
        integrationReadable = false;

        var summary = queries.summary(ShopFilter.unfiltered());

        assertThat(summary.connectionKnown()).isFalse();
        assertThat(summary.allShops().shopCount()).isEqualTo(1);
        assertThat(summary.channelTypes().getFirst().attentionCount()).isNull();
        assertThat(summary.channelTypes().getFirst().connectionSplit()).isEmpty();
    }

    /**
     * 🔴 A CONNECTION FILTER CANNOT BE HONOURED WHEN THE CONDITION CANNOT BE READ. Returning
     * everything, or nothing, would both be false answers, so the request fails outright.
     */
    @Test
    @DisplayName("SCS-043.a filtering BY connection fails honestly when Integration is unreadable")
    void filteringByConnectionFailsRatherThanLying() {
        seedShop("CHN-1", "Zeon Mart", ChannelTypeCode.DARAZ, ConfigurationState.ACTIVE, "a", null);
        acting();
        integrationReadable = false;

        assertThatThrownBy(() -> queries.list(new ShopFilter(null, null, ConnectionState.CONNECTED, null),
                PageRequest.of(0, 50)))
                .isInstanceOf(ConnectionUnavailableException.class);
    }

    // =================================================================================
    // helpers
    // =================================================================================

    private List<String> names(ShopFilter filter) {
        return queries.list(filter, PageRequest.of(0, 50)).getContent().stream()
                .map(ShopViews.ShopRow::name).toList();
    }

    private List<String> namesMatching(String search) {
        return names(new ShopFilter(search, null, null, null));
    }

    private UUID seedShop(String code, String name, ChannelTypeCode type, ConfigurationState configuration,
                          String accountIdentity, String link) {
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        jdbc.update("""
                INSERT INTO channel_instance
                    (id, code, name, channel_type, record_status, market,
                     external_account_identity, external_link, bound_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'BANGLADESH', ?, ?, ?, ?, ?)
                """, id, code, name, type.name(), configuration.name(), accountIdentity, link,
                accountIdentity == null ? null : Timestamp.from(now),
                Timestamp.from(now), Timestamp.from(now));
        return id;
    }

    private void seedConnection(UUID shopId, ConnectionState state) {
        jdbc.update("""
                INSERT INTO channel_connection (channel_instance_id, state, last_checked_at, updated_at)
                VALUES (?, ?, ?, ?)
                """, shopId, state.name(), Timestamp.from(Instant.now()), Timestamp.from(Instant.now()));
    }

    private void acting() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_VIEW);
    }

    private void actingWith(String... permissions) {
        var authorities = Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList();
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actorId, "sc-tester", "SC Tester", "unused",
                AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    /** ⚠ Connection rows reference shops, so they go first. */
    private void clearShops() {
        jdbc.update("DELETE FROM channel_connection");
        jdbc.update("DELETE FROM channel_listing_sku WHERE TRUE");
        jdbc.update("DELETE FROM channel_listing WHERE TRUE");
        jdbc.update("DELETE FROM channel_adapter_capability WHERE TRUE");
        /*
          V14 rows reference the shop and the foreign keys carry NO CASCADE, deliberately
          (INV-16.10 forbids hard-deleting a Channel Instance, so a cascade would encode an
          event that cannot legitimately occur). Test teardown therefore clears them first.
        */
        jdbc.update("DELETE FROM channel_authorisation_attempt");
        jdbc.update("DELETE FROM channel_credential");
        jdbc.update("DELETE FROM channel_instance");
    }
}
