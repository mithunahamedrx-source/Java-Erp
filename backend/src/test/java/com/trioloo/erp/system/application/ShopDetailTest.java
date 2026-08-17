package com.trioloo.erp.system.application;

import com.trioloo.erp.access.AccessFixtures;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.integration.application.AuthorisationUnsupportedException;
import com.trioloo.erp.integration.application.ChannelAuthorisationPort;
import com.trioloo.erp.integration.application.ChannelAuthorisationRegistry;
import com.trioloo.erp.integration.application.ChannelAuthorisationService;
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
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * FRAME 03 — the shop detail page: connection, authorisation and lifecycle.
 *
 * <p>🔴 THE SAFETY-CRITICAL CLAIM is the identity mismatch: when an already-bound shop is
 * authorised as a DIFFERENT account, the rebind is REFUSED and the existing binding survives
 * byte-for-byte, so the shop's Listings and history stay attached to the account they were
 * created under ({@code INV-16.6}, {@code SCS-044}).
 *
 * <p>🔴 THE SECOND CLAIM is that authorisation NEVER activates, and that {@code DRAFT} +
 * {@code CONNECTED} is an ordinary, reachable, correct state.
 *
 * <p>⚠ The adapter here is a CONTROLLED DOUBLE registered for this test's own channel type.
 * No marketplace is contacted, and no provider implementation exists ({@code GAP-133}).
 */
@SpringBootTest
class ShopDetailTest {

    /** ⚠ What the controlled adapter reports, swapped per test. */
    private static volatile Optional<ChannelAuthorisationPort.AuthorisedAccount> reported = Optional.empty();
    /** ⚠ Whether Integration's condition read succeeds, swapped per test. */
    private static volatile boolean integrationReadable = true;

    @TestConfiguration
    static class Adapters {

        /** ⚠ Serves {@code SHOPIFY} so the production-empty registry stays untouched. */
        @Bean
        @Primary
        ChannelAuthorisationRegistry testRegistry() {
            return new ChannelAuthorisationRegistry(Set.of(ChannelTypeCode.SHOPIFY));
        }

        @Bean
        ChannelAuthorisationPort testAdapter() {
            return new ChannelAuthorisationPort() {
                @Override
                public ChannelTypeCode channelType() {
                    return ChannelTypeCode.SHOPIFY;
                }

                /*
                  ⚠ The state is echoed into the destination so the test can recover it exactly as
                  the provider would echo it back. No marketplace is contacted.
                */
                @Override
                public java.net.URI authorizationUri(UUID channelInstanceId, String state) {
                    return java.net.URI.create("https://shopify.example/authorize?state=" + state);
                }

                @Override
                public Optional<AuthorisedAccount> exchange(UUID channelInstanceId, String code) {
                    return reported;
                }
            };
        }

        @Bean
        @Primary
        ChannelConnectionPort switchableConnectionPort(ChannelConnectionRepository repository) {
            StoredChannelConnectionAdapter real = new StoredChannelConnectionAdapter(repository);
            return new ChannelConnectionPort() {
                @Override
                public ConnectionProjection read(UUID id) {
                    refuse();
                    return real.read(id);
                }

                @Override
                public Map<UUID, ConnectionProjection> read(Collection<UUID> ids) {
                    refuse();
                    return real.read(ids);
                }

                private void refuse() {
                    if (!integrationReadable) {
                        throw new ConnectionUnavailableException("The connection state could not be read just now.");
                    }
                }
            };
        }
    }

    /**
     * Runs a full authorisation the way a real one runs: initiate, then complete with the state the
     * provider echoes back.
     *
     * <p>🔴 THIS IS WHY THE {@code SCS-044} TESTS BELOW STILL MEAN SOMETHING. They used to call a
     * synchronous {@code authorise(id)} that no redirect provider could ever implement. The rules
     * they assert — bound, renewed, different account, claimed by another shop, not completed, and
     * the {@code INV-16.15} timestamps — are ratified and unchanged; only the transport moved. Each
     * one now exercises the real two-step path end to end.
     */
    private ChannelAuthorisationService.AuthorisationResult authoriseVia(UUID shopId) {
        String url = authorisation.initiate(shopId).authorizationUrl();
        String state = org.springframework.web.util.UriComponentsBuilder.fromUriString(url)
                .build().getQueryParams().getFirst("state");
        return authorisation.complete("test-authorisation-code", state);
    }

    @Autowired
    private ShopQueryService queries;
    @Autowired
    private ShopCommandService commands;
    @Autowired
    private ChannelAuthorisationService authorisation;
    @Autowired
    private JdbcTemplate jdbc;
    @Autowired
    private PasswordEncoder passwordEncoder;

    private AccessFixtures fixtures;
    private UUID actorId;

    private static final String ALL = "all";

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
        actorId = fixtures.createProfile("sc-detail-tester", "irrelevant", AccountLifecycleState.ACTIVE);
        reported = Optional.empty();
        integrationReadable = true;
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clearShops();
        reported = Optional.empty();
        integrationReadable = true;
    }

    // =================================================================================
    // SCS-040 — the detail read
    // =================================================================================

    @Test
    @DisplayName("SCS-040 the detail carries identity, both states and the audit facts")
    void detailCarriesTheApprovedFacts() {
        acting(ALL);
        UUID id = register("Zeon Mart", "SHOPIFY", "BANGLADESH");
        reported = Optional.of(new ChannelAuthorisationPort.AuthorisedAccount("zeonmart_bd", "https://shop.example"));
        authoriseVia(id);
        commands.activate(id);

        var detail = queries.detail(id);

        assertThat(detail.name()).isEqualTo("Zeon Mart");
        assertThat(detail.channelTypeLabel()).isEqualTo("Shopify");
        assertThat(detail.market()).isEqualTo(com.trioloo.erp.system.domain.MarketCode.BANGLADESH);
        assertThat(detail.marketLabel()).isEqualTo("Bangladesh");
        assertThat(detail.code()).matches("CHN-\\d{6}");
        /* 🔴 SCS-041 — two DIFFERENT facts, never collapsed. */
        assertThat(detail.externalAccountIdentity()).isEqualTo("zeonmart_bd");
        assertThat(detail.externalLink()).isEqualTo("https://shop.example");
        assertThat(detail.boundAt()).isNotNull();
        assertThat(detail.authorisedAt()).isNotNull();
        assertThat(detail.activatedAt()).isNotNull();
        /* 🔴 AGV-001 — the ACTOR is a first-class fact, not a reconstruction. */
        assertThat(detail.activatedByName()).isNotNull();
    }

    @Test
    @DisplayName("a shop that does not exist reports NOT FOUND")
    void missingShopIsNotFound() {
        acting(ALL);
        assertThatThrownBy(() -> queries.detail(UUID.randomUUID())).isInstanceOf(ShopNotFoundException.class);
    }

    @Test
    @DisplayName("PRM-090 the detail refuses an actor without view")
    void detailRefusesWithoutView() {
        acting(SystemPermissions.CHANNEL_INSTANCE_MANAGE);
        UUID id = registerAs(ALL, "Zeon Mart", "SHOPIFY");
        acting(SystemPermissions.CHANNEL_INSTANCE_MANAGE);

        assertThatThrownBy(() -> queries.detail(id))
                .isInstanceOf(ShopAccessDeniedException.class)
                .hasMessageContaining(SystemPermissions.CHANNEL_INSTANCE_VIEW);
    }

    /**
     * 🔴 {@code SCS-043.a} / {@code API-069} — THE PAGE STILL RENDERS. Everything except the
     * condition is Trioloo's own record and is accurate; a remote read failure must never
     * blank out local canonical data.
     */
    @Test
    @DisplayName("SCS-043.a an unreadable connection leaves every local fact intact")
    void unreadableConnectionDoesNotBlankThePage() {
        acting(ALL);
        UUID id = register("Zeon Mart", "SHOPIFY", "BANGLADESH");
        reported = Optional.of(new ChannelAuthorisationPort.AuthorisedAccount("zeonmart_bd", "https://shop.example"));
        authoriseVia(id);
        integrationReadable = false;

        var detail = queries.detail(id);

        assertThat(detail.connectionKnown()).isFalse();
        assertThat(detail.connection()).isNull();
        assertThat(detail.connectionLastCheckedAt()).isNull();
        // 🔴 Everything else survives.
        assertThat(detail.name()).isEqualTo("Zeon Mart");
        assertThat(detail.externalAccountIdentity()).isEqualTo("zeonmart_bd");
        assertThat(detail.boundAt()).isNotNull();
        assertThat(detail.market()).isEqualTo(com.trioloo.erp.system.domain.MarketCode.BANGLADESH);
        assertThat(detail.marketLabel()).isEqualTo("Bangladesh");
    }

    // =================================================================================
    // SCS-044 — the three authorisation results
    // =================================================================================

    /**
     * 🔴 {@code SCS-044} + {@code SCS-051.b} — A FIRST SUCCESS BINDS AND CONNECTS, AND LEAVES
     * THE SHOP IN {@code DRAFT}. Activating is a separate decision, and is not done for the
     * operator.
     */
    @Test
    @DisplayName("SCS-044 a first authorisation binds and connects but never activates")
    void firstAuthorisationLeavesTheShopInDraft() {
        acting(ALL);
        UUID id = register("Trioloo", "SHOPIFY", "BANGLADESH");
        reported = Optional.of(new ChannelAuthorisationPort.AuthorisedAccount("trioloo_official", null));

        var result = authoriseVia(id);

        assertThat(result.outcome()).isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.AUTHORISED);
        assertThat(result.firstBinding()).isTrue();
        assertThat(result.boundAccount()).isEqualTo("trioloo_official");

        var detail = queries.detail(id);
        /* 🔴 DRAFT + CONNECTED — the ordinary state the contract is built around. */
        assertThat(detail.configuration()).isEqualTo(ConfigurationState.DRAFT);
        assertThat(detail.connection()).isEqualTo(ConnectionState.CONNECTED);
        assertThat(detail.activatedAt()).isNull();
        assertThat(detail.activatable()).isTrue();
    }

    /**
     * 🔴 {@code INV-16.6} / {@code SCS-042.b} — RE-AUTHORISING THE SAME ACCOUNT RENEWS AND
     * DOES NOT RE-BIND. The binding date must be stable across renewals.
     */
    @Test
    @DisplayName("INV-16.6 re-authorising the same account renews without re-binding")
    void sameAccountRenewalDoesNotMoveTheBindingDate() throws Exception {
        acting(ALL);
        UUID id = register("Zeon Mart", "SHOPIFY", "BANGLADESH");
        reported = Optional.of(new ChannelAuthorisationPort.AuthorisedAccount("zeonmart_bd", "https://a.example"));
        authoriseVia(id);
        var first = queries.detail(id);

        Thread.sleep(10);
        reported = Optional.of(new ChannelAuthorisationPort.AuthorisedAccount("zeonmart_bd", "https://b.example"));
        var result = authoriseVia(id);

        assertThat(result.outcome()).isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.AUTHORISED);
        assertThat(result.firstBinding()).isFalse();

        var after = queries.detail(id);
        /* 🔴 THE BINDING DATE IS UNCHANGED. */
        assertThat(after.boundAt()).isEqualTo(first.boundAt());
        /* ⚠ The link is remote-derived and may legitimately move; it is still never identity. */
        assertThat(after.externalLink()).isEqualTo("https://b.example");
        assertThat(after.externalAccountIdentity()).isEqualTo("zeonmart_bd");
    }

    /**
     * 🔴 THE SAFETY-CRITICAL TEST. A different account is REJECTED, the existing binding is
     * UNCHANGED, and BOTH identities are reported so the operator can be told the truth.
     */
    @Test
    @DisplayName("SCS-044 a different account is rejected and the existing binding is untouched")
    void differentAccountIsRefusedAndNothingChanges() {
        acting(ALL);
        UUID id = register("Zeon Tech", "SHOPIFY", "BANGLADESH");
        reported = Optional.of(new ChannelAuthorisationPort.AuthorisedAccount("zeontech_bd", "https://zeontech.example"));
        authoriseVia(id);
        commands.activate(id);
        var before = queries.detail(id);

        reported = Optional.of(new ChannelAuthorisationPort.AuthorisedAccount("friday_pc_bd", "https://friday.example"));
        var result = authoriseVia(id);

        assertThat(result.outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.DIFFERENT_ACCOUNT);
        /* 🔴 BOTH identities — the one signed in as, and the one this shop is bound to. */
        assertThat(result.boundAccount()).isEqualTo("zeontech_bd");
        assertThat(result.attemptedAccount()).isEqualTo("friday_pc_bd");

        var after = queries.detail(id);
        assertThat(after.externalAccountIdentity()).isEqualTo("zeontech_bd");
        assertThat(after.externalLink()).isEqualTo(before.externalLink());
        assertThat(after.boundAt()).isEqualTo(before.boundAt());
        assertThat(after.authorisedAt()).isEqualTo(before.authorisedAt());
        assertThat(after.configuration()).isEqualTo(before.configuration());
        /* 🔴 The connection condition is NOT overwritten either. */
        assertThat(after.connection()).isEqualTo(before.connection());
    }

    /** 🔴 {@code INV-16.6} from the other side — one account belongs to ONE shop. */
    @Test
    @DisplayName("INV-16.6 an account already bound to another shop cannot be claimed")
    void anAccountCannotBeBoundToTwoShops() {
        acting(ALL);
        UUID first = register("Shop one", "SHOPIFY", "BANGLADESH");
        reported = Optional.of(new ChannelAuthorisationPort.AuthorisedAccount("shared_account", null));
        authoriseVia(first);

        UUID second = register("Shop two", "SHOPIFY", "BANGLADESH");
        var result = authoriseVia(second);

        assertThat(result.outcome())
                .isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.CLAIMED_BY_ANOTHER_SHOP);
        assertThat(queries.detail(second).externalAccountIdentity()).isNull();
        assertThat(queries.detail(first).externalAccountIdentity()).isEqualTo("shared_account");
    }

    /**
     * 🔴 {@code SCS-044} — NOT COMPLETED. Nothing was bound and the shop is unchanged, so no
     * connection record is written either.
     */
    @Test
    @DisplayName("SCS-044 an authorisation the channel did not confirm changes nothing at all")
    void notCompletedChangesNothing() {
        acting(ALL);
        UUID id = register("Friday PC", "SHOPIFY", "BANGLADESH");
        reported = Optional.empty();

        var result = authoriseVia(id);

        assertThat(result.outcome()).isEqualTo(ChannelAuthorisationService.AuthorisationResult.Outcome.NOT_COMPLETED);
        var detail = queries.detail(id);
        assertThat(detail.externalAccountIdentity()).isNull();
        assertThat(detail.boundAt()).isNull();
        assertThat(detail.connection()).isEqualTo(ConnectionState.NOT_CONNECTED);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM channel_connection", Integer.class)).isZero();
    }

    /** 🔴 {@code PRM-090.a} — manage and lifecycle confer NO authorisation authority. */
    @Test
    @DisplayName("PRM-090.a neither manage nor lifecycle can authorise")
    void authorisingNeedsItsOwnCapability() {
        UUID id = registerAs(ALL, "Zeon Mart", "SHOPIFY");
        acting(SystemPermissions.CHANNEL_INSTANCE_MANAGE, SystemPermissions.CHANNEL_INSTANCE_LIFECYCLE,
                SystemPermissions.CHANNEL_INSTANCE_VIEW);

        assertThatThrownBy(() -> authorisation.initiate(id))
                .isInstanceOf(ShopAccessDeniedException.class)
                .hasMessageContaining(IntegrationPermissions.CHANNEL_CONNECTION_AUTHORIZE);
    }

    /**
     * 🔴 {@code SCS-092.d} — MEMBERSHIP IMPLIES NO ADAPTER. Daraz is a recognised, offered
     * channel type with no integration behind it, and the system says so rather than
     * pretending.
     */
    @Test
    @DisplayName("SCS-092.d a channel type with no adapter refuses authorisation honestly")
    void aChannelTypeWithoutAnAdapterSaysSo() {
        acting(ALL);
        /*
          ⚠ WEBSITE, not DARAZ. Daraz now HAS an adapter, so using it here would assert the opposite
          of the truth. Website is recognised (INV-15.3) and genuinely has no integration behind it,
          which is exactly the case SCS-092.d describes.
        */
        UUID id = register("Trioloo Storefront", "WEBSITE", "BANGLADESH");

        assertThatThrownBy(() -> authorisation.initiate(id))
                .isInstanceOf(AuthorisationUnsupportedException.class)
                .hasMessageContaining("its integration is not built");

        var detail = queries.detail(id);
        assertThat(detail.authorisationSupported()).isFalse();
        assertThat(detail.authorisationUnsupportedReason()).isNotNull();
    }

    // =================================================================================
    // SCS-051 — Activate
    // =================================================================================

    @Test
    @DisplayName("SCS-051.a Activate moves DRAFT to ACTIVE and records who did it")
    void activateRecordsTheTransitionAndItsActor() {
        acting(ALL);
        UUID id = register("Trioloo", "SHOPIFY", "BANGLADESH");
        reported = Optional.of(new ChannelAuthorisationPort.AuthorisedAccount("trioloo_official", null));
        authoriseVia(id);

        commands.activate(id);

        var detail = queries.detail(id);
        assertThat(detail.configuration()).isEqualTo(ConfigurationState.ACTIVE);
        assertThat(detail.activatedAt()).isNotNull();
        assertThat(detail.activatedByName()).isEqualTo("sc-detail-tester (test)");
        /* 🔴 SCS-051.d — the connection is unaffected. */
        assertThat(detail.connection()).isEqualTo(ConnectionState.CONNECTED);
    }

    /**
     * 🔴 {@code SCS-051.c} — AVAILABLE ONLY ONCE AN ACCOUNT IS BOUND, and where it is not, the
     * reason is the approved sentence.
     */
    @Test
    @DisplayName("SCS-051.c an unbound shop cannot be activated, and says why")
    void unboundShopCannotBeActivated() {
        acting(ALL);
        UUID id = register("Friday PC", "DARAZ", "BANGLADESH");

        var detail = queries.detail(id);
        assertThat(detail.activatable()).isFalse();
        assertThat(detail.activationBlockedReason())
                .isEqualTo("Connect the account first — an active shop must have a verified account.");

        assertThatThrownBy(() -> commands.activate(id))
                .isInstanceOf(ShopValidationException.class)
                .hasMessageContaining("Connect the account first");
    }

    @Test
    @DisplayName("SCS-051 activating an already-active shop is refused")
    void activatingTwiceIsRefused() {
        acting(ALL);
        UUID id = register("Trioloo", "SHOPIFY", "BANGLADESH");
        reported = Optional.of(new ChannelAuthorisationPort.AuthorisedAccount("trioloo_official", null));
        authoriseVia(id);
        commands.activate(id);

        assertThatThrownBy(() -> commands.activate(id))
                .isInstanceOf(ShopValidationException.class)
                .hasMessageContaining("already been activated");
    }

    /** 🔴 {@code PRM-090.a} — MANAGE IS NOT LIFECYCLE. */
    @Test
    @DisplayName("PRM-090.a manage alone cannot activate")
    void activationNeedsLifecycleAuthority() {
        UUID id = registerAs(ALL, "Trioloo", "SHOPIFY");
        acting(ALL);
        reported = Optional.of(new ChannelAuthorisationPort.AuthorisedAccount("trioloo_official", null));
        authoriseVia(id);
        acting(SystemPermissions.CHANNEL_INSTANCE_MANAGE, SystemPermissions.CHANNEL_INSTANCE_VIEW);

        assertThatThrownBy(() -> commands.activate(id))
                .isInstanceOf(ShopAccessDeniedException.class)
                .hasMessageContaining(SystemPermissions.CHANNEL_INSTANCE_LIFECYCLE);
    }

    /**
     * 🔴 {@code SCS-051.e} — SUSPEND, REACTIVATE AND ARCHIVE ARE NOT BUILT, but the STATES
     * remain canonical and displayable. A suspended shop still reads correctly.
     */
    @Test
    @DisplayName("SCS-051.e SUSPENDED remains displayable even though no control produces it")
    void suspendedRemainsDisplayable() {
        acting(ALL);
        UUID id = register("MME Website", "SHOPIFY", "BANGLADESH");
        jdbc.update("UPDATE channel_instance SET record_status = 'SUSPENDED' WHERE id = ?", id);

        assertThat(queries.detail(id).configuration()).isEqualTo(ConfigurationState.SUSPENDED);
    }

    // =================================================================================
    // SCS-042 — the observation time
    // =================================================================================

    /**
     * 🔴 {@code SCS-042.a} — "LAST CHECKED" MEANS AN OBSERVATION ACTUALLY HAPPENED. Reading
     * the page does not create one, so a shop that has never been observed has no time to
     * show, and reading its detail twice does not invent one.
     */
    @Test
    @DisplayName("SCS-042.a reading the page never fabricates an observation time")
    void readingThePageIsNotAnObservation() {
        acting(ALL);
        UUID id = register("Friday PC", "SHOPIFY", "BANGLADESH");

        assertThat(queries.detail(id).connectionLastCheckedAt()).isNull();
        queries.detail(id);
        assertThat(queries.detail(id).connectionLastCheckedAt()).isNull();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM channel_connection", Integer.class)).isZero();
    }

    /** ⚠ A genuine authorisation IS an observation, so it does set the time. */
    @Test
    @DisplayName("SCS-042 a real authorisation records when the condition was observed")
    void aRealAuthorisationRecordsAnObservation() {
        acting(ALL);
        UUID id = register("Trioloo", "SHOPIFY", "BANGLADESH");
        reported = Optional.of(new ChannelAuthorisationPort.AuthorisedAccount("trioloo_official", null));

        authoriseVia(id);

        assertThat(queries.detail(id).connectionLastCheckedAt()).isNotNull();
    }

    // =================================================================================
    // helpers
    // =================================================================================

    private UUID register(String name, String channelType, String market) {
        return commands.create(new ShopCommandService.ShopInput(name, channelType, market));
    }

    private UUID registerAs(String permissions, String name, String channelType) {
        acting(permissions);
        return register(name, channelType, "BANGLADESH");
    }

    private void acting(String... permissions) {
        String[] granted = permissions.length == 1 && ALL.equals(permissions[0])
                ? new String[] { SystemPermissions.CHANNEL_INSTANCE_VIEW,
                        SystemPermissions.CHANNEL_INSTANCE_MANAGE,
                        SystemPermissions.CHANNEL_INSTANCE_LIFECYCLE,
                        IntegrationPermissions.CHANNEL_CONNECTION_AUTHORIZE }
                : permissions;
        var authorities = Arrays.stream(granted).map(SimpleGrantedAuthority::new).toList();
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actorId, "sc-detail-tester", "SC Detail Tester", "unused",
                AccountLifecycleState.ACTIVE, Set.of(), Set.of(granted));
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

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

    /** ⚠ Unused import guard — keeps the timestamp helper available for future audit tests. */
    @SuppressWarnings("unused")
    private Timestamp now() {
        return Timestamp.from(Instant.now());
    }
}
