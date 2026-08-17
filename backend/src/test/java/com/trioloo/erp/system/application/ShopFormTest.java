package com.trioloo.erp.system.application;

import com.trioloo.erp.access.AccessFixtures;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.integration.application.IntegrationPermissions;
import com.trioloo.erp.integration.domain.ConnectionState;
import com.trioloo.erp.system.domain.ChannelTypeCode;
import com.trioloo.erp.system.domain.ConfigurationState;
import com.trioloo.erp.system.domain.MarketCode;
import com.trioloo.erp.system.infrastructure.persistence.ShopRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * FRAME 02 — the shop form, add and edit.
 *
 * <p>🔴 THE CLAIMS UNDER TEST are that registering a shop produces exactly the ratified
 * initial state and nothing more, that the channel type is a CLOSED SET with no free-text
 * escape, that fixed facts are REFUSED rather than silently ignored, and that no path through
 * this surface can write a remote-derived fact or a credential.
 */
@SpringBootTest
class ShopFormTest {

    @Autowired
    private ShopCommandService commands;
    @Autowired
    private ShopQueryService queries;
    @Autowired
    private ShopRepository shops;
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
        actorId = fixtures.createProfile("sc-form-tester", "irrelevant", AccountLifecycleState.ACTIVE);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clearShops();
    }

    // =================================================================================
    // SCS-030.c — what save actually does
    // =================================================================================

    /**
     * 🔴 THE CENTRAL CLAIM OF THIS FRAME. A created shop is {@code DRAFT} and
     * {@code NOT_CONNECTED}, carries an ERP-assigned code, and is bound to nothing.
     * 🔴 IT DOES NOT AUTO-CONNECT AND DOES NOT AUTO-ACTIVATE.
     */
    @Test
    @DisplayName("SCS-030.c a created shop is DRAFT, NOT_CONNECTED, coded by Trioloo and unbound")
    void createProducesTheRatifiedInitialState() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE, SystemPermissions.CHANNEL_INSTANCE_VIEW);

        UUID id = commands.create(new ShopCommandService.ShopInput("Trioloo · Daraz", "DARAZ", "BANGLADESH"));

        var detail = queries.detail(id);
        assertThat(detail.configuration()).isEqualTo(ConfigurationState.DRAFT);
        assertThat(detail.connection()).isEqualTo(ConnectionState.NOT_CONNECTED);
        assertThat(detail.code()).matches("CHN-\\d{6}");
        assertThat(detail.externalAccountIdentity()).isNull();
        assertThat(detail.externalLink()).isNull();
        assertThat(detail.boundAt()).isNull();
        assertThat(detail.authorisedAt()).isNull();
        assertThat(detail.activatedAt()).isNull();
        assertThat(detail.activatedByName()).isNull();
    }

    /**
     * 🔴 {@code SCS-043} — NOT_CONNECTED IS EXPRESSED AS ABSENCE. Registering a shop writes no
     * connection row at all, so no fabricated connection fact is ever created.
     */
    @Test
    @DisplayName("SCS-030.d creating a shop writes no connection record")
    void createWritesNoConnectionRecord() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE);

        commands.create(new ShopCommandService.ShopInput("Trioloo · Daraz", "DARAZ", "BANGLADESH"));

        assertThat(jdbc.queryForObject("SELECT count(*) FROM channel_connection", Integer.class)).isZero();
    }

    /** {@code SCS-091} — the ERP assigns a unique code; it is never operator-supplied. */
    @Test
    @DisplayName("SCS-091 each registration receives its own ERP-assigned code")
    void codesAreAssignedAndUnique() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE, SystemPermissions.CHANNEL_INSTANCE_VIEW);

        UUID first = commands.create(new ShopCommandService.ShopInput("A", "DARAZ", "BANGLADESH"));
        UUID second = commands.create(new ShopCommandService.ShopInput("B", "WEBSITE", "BANGLADESH"));

        assertThat(queries.detail(first).code()).isNotEqualTo(queries.detail(second).code());
    }

    // =================================================================================
    // SCS-030.b / INV-15.4 — the closed set
    // =================================================================================

    @Test
    @DisplayName("SCS-092.a all four offered channel types are accepted")
    void everyOfferedTypeIsAccepted() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE, SystemPermissions.CHANNEL_INSTANCE_VIEW);

        for (String type : List.of("DARAZ", "WEBSITE", "SHOPIFY", "WOOCOMMERCE")) {
            UUID id = commands.create(new ShopCommandService.ShopInput("Shop " + type, type, "BANGLADESH"));
            assertThat(queries.detail(id).channelType()).isEqualTo(ChannelTypeCode.valueOf(type));
        }
    }

    /** 🔴 {@code INV-15.4} — FREE TEXT IS FORBIDDEN. An unrecognised value is rejected. */
    @Test
    @DisplayName("INV-15.4 an unrecognised channel type is rejected, never stored")
    void freeTextChannelTypeIsRefused() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE);

        for (String rubbish : List.of("Lazada", "my own shop", "", "   ", "DARAZZ")) {
            assertThatThrownBy(() ->
                    commands.create(new ShopCommandService.ShopInput("A shop", rubbish, "BANGLADESH")))
                    .isInstanceOf(ShopValidationException.class)
                    .satisfies(e -> assertThat(((ShopValidationException) e).field()).isEqualTo("channelType"));
        }
        assertThat(shops.count()).isZero();
    }

    /**
     * 🔴 {@code SCS-092.b} — the API accepts only what the REGISTRY OFFERS. A recognised but
     * unoffered type is refused, so the form and the server cannot disagree about what a shop
     * can be.
     */
    @Test
    @DisplayName("SCS-092.b a recognised but unoffered channel type is refused by the API")
    void recognisedButUnofferedTypesAreRefused() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE);

        for (String manual : List.of("FACEBOOK", "WHATSAPP", "PHONE", "WALKIN")) {
            assertThatThrownBy(() ->
                    commands.create(new ShopCommandService.ShopInput("A shop", manual, "BANGLADESH")))
                    .isInstanceOf(ShopValidationException.class);
        }
    }

    // =================================================================================
    // SCS-030.e — validation
    // =================================================================================

    @Test
    @DisplayName("SCS-030.e a missing name fails against the NAME field with the approved message")
    void nameIsRequired() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE);

        assertThatThrownBy(() -> commands.create(new ShopCommandService.ShopInput("  ", "DARAZ", "BANGLADESH")))
                .isInstanceOf(ShopValidationException.class)
                .hasMessage("A shop needs a name operators can recognise.")
                .satisfies(e -> assertThat(((ShopValidationException) e).field()).isEqualTo("name"));
    }

    /** {@code INV-16.7} — one instance, one market, and the fact is required. */
    @Test
    @DisplayName("INV-16.7 market is required")
    void marketIsRequired() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE);

        for (String missing : List.of("", "   ")) {
            assertThatThrownBy(() -> commands.create(new ShopCommandService.ShopInput("A shop", "DARAZ", missing)))
                    .isInstanceOf(ShopValidationException.class)
                    .satisfies(e -> assertThat(((ShopValidationException) e).field()).isEqualTo("market"));
        }
    }

    /**
     * 🔴 {@code INV-16.7} — MARKET IS A CLOSED, ERP-SUPPLIED SET. Ratified 2026-08-15.
     * {@code BANGLADESH} is its only current member and is accepted; everything else is
     * REJECTED, never normalised onto it.
     */
    @Test
    @DisplayName("INV-16.7 the canonical market is accepted and persisted as its code")
    void theCanonicalMarketIsAccepted() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE, SystemPermissions.CHANNEL_INSTANCE_VIEW);

        UUID id = commands.create(new ShopCommandService.ShopInput("Zeon Mart", "DARAZ", "BANGLADESH"));

        assertThat(queries.detail(id).market()).isEqualTo(MarketCode.BANGLADESH);
        assertThat(queries.detail(id).marketLabel()).isEqualTo("Bangladesh");
        assertThat(jdbc.queryForObject("SELECT market FROM channel_instance WHERE id = ?", String.class, id))
                .isEqualTo("BANGLADESH");
    }

    /**
     * 🔴 FREE TEXT IS FORBIDDEN, AND ARBITRARY TEXT IS NEVER SILENTLY NORMALISED. Quietly
     * mapping "Bangla" or "India" onto the single current member would turn an operator's
     * mistake into a business fact and would hide the day a second market is genuinely needed.
     */
    @Test
    @DisplayName("INV-16.7 an unrecognised market is rejected, never normalised")
    void unrecognisedMarketsAreRefused() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE);

        for (String rubbish : List.of("India", "Pakistan", "Global", "International", "Asia",
                "BANGLADESHI", "BD", "my market")) {
            assertThatThrownBy(() ->
                    commands.create(new ShopCommandService.ShopInput("A shop", "DARAZ", rubbish)))
                    .isInstanceOf(ShopValidationException.class)
                    .satisfies(e -> assertThat(((ShopValidationException) e).field()).isEqualTo("market"));
        }
        assertThat(shops.count()).isZero();
    }

    /**
     * 🔴 THE DATABASE ENFORCES IT TOO ({@code V12}). Application validation is not the only
     * guard: a write that bypassed the service still cannot persist an unratified market.
     */
    @Test
    @DisplayName("V12 the database refuses an unrecognised market")
    void theDatabaseRefusesAnUnrecognisedMarket() {
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type, record_status, market,
                                              created_at, updated_at)
                VALUES (?, 'CHN-999999', 'Rogue', 'DARAZ', 'DRAFT', 'INDIA', now(), now())
                """, UUID.randomUUID()))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    /**
     * ⚠ {@code SYS-034} — a row that predates the feature and has NO market is still valid.
     * 🔴 Nothing backfills it to {@code BANGLADESH}: that would fabricate an attribution
     * nobody made. New shops cannot reach this state, because creation requires a market.
     */
    @Test
    @DisplayName("SYS-034 a legacy row with no market remains valid and is not backfilled")
    void legacyRowsWithoutAMarketSurvive() {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type, record_status, created_at, updated_at)
                VALUES (?, 'CHN-LEGACY', 'Pre-feature shop', 'DARAZ', 'ACTIVE', now(), now())
                """, id);
        actingWith(SystemPermissions.CHANNEL_INSTANCE_VIEW);

        var detail = queries.detail(id);
        assertThat(detail.market()).isNull();
        assertThat(detail.marketLabel()).isNull();
    }

    // =================================================================================
    // SCS-030 — edit, and what is fixed
    // =================================================================================

    @Test
    @DisplayName("SCS-030 the display name is editable")
    void nameIsEditable() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE, SystemPermissions.CHANNEL_INSTANCE_VIEW);
        UUID id = commands.create(new ShopCommandService.ShopInput("Old name", "DARAZ", "BANGLADESH"));

        commands.update(id, new ShopCommandService.ShopInput("New name", "DARAZ", "BANGLADESH"));

        assertThat(queries.detail(id).name()).isEqualTo("New name");
    }

    /** ⚠ Before an account is bound, nothing is settled yet — both may still change. */
    @Test
    @DisplayName("SCS-030 an unbound draft may still change its channel type and market")
    void unboundDraftIsStillMutable() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE, SystemPermissions.CHANNEL_INSTANCE_VIEW);
        UUID id = commands.create(new ShopCommandService.ShopInput("A shop", "DARAZ", "BANGLADESH"));

        commands.update(id, new ShopCommandService.ShopInput("A shop", "SHOPIFY", "BANGLADESH"));

        var detail = queries.detail(id);
        assertThat(detail.channelType()).isEqualTo(ChannelTypeCode.SHOPIFY);
        assertThat(detail.market()).isEqualTo(MarketCode.BANGLADESH);
        assertThat(detail.channelTypeChangeable()).isTrue();
        /*
          ⚠ Market REMAINS MUTABLE while unbound, which is the ratified rule. It cannot be
          exercised by moving to another value because the ratified set has ONE member today;
          asserting the CAPABILITY is the honest test, and inventing a second market to make a
          nicer assertion is exactly what is forbidden.
        */
        assertThat(detail.marketChangeable()).isTrue();
    }

    /**
     * 🔴 {@code SCS-030} — ONCE AN ACCOUNT IS BOUND, THE MARKET IS SETTLED AND THE CHANNEL
     * TYPE IS FIXED. The attempt is REFUSED with the reason, never silently discarded.
     */
    @Test
    @DisplayName("SCS-030 a bound shop refuses a channel-type or market change with the approved reason")
    void boundShopFixesChannelTypeAndMarket() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE, SystemPermissions.CHANNEL_INSTANCE_VIEW);
        UUID id = commands.create(new ShopCommandService.ShopInput("Zeon Mart", "DARAZ", "BANGLADESH"));
        bindAccount(id, "zeonmart_bd");

        assertThatThrownBy(() ->
                commands.update(id, new ShopCommandService.ShopInput("Zeon Mart", "SHOPIFY", "BANGLADESH")))
                .isInstanceOf(ShopValidationException.class)
                .hasMessageContaining("in operational use, so its channel type can no longer change");

        /*
          ⚠ THE MARKET-FIXED REFUSAL CANNOT BE EXERCISED THROUGH THE SERVICE TODAY: with one
          ratified member, no VALID change of market can be submitted at all. The rule is
          therefore asserted where it actually lives — on the aggregate, which refuses
          regardless of what any caller does — plus the projected flag the form reads.
        */
        assertThat(queries.detail(id).marketChangeable()).isFalse();
        assertThatThrownBy(() -> shops.findById(id).orElseThrow()
                .changeMarket(MarketCode.BANGLADESH, java.time.Instant.now()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("the market is settled");

        var detail = queries.detail(id);
        assertThat(detail.channelType()).isEqualTo(ChannelTypeCode.DARAZ);
        assertThat(detail.market()).isEqualTo(MarketCode.BANGLADESH);
        assertThat(detail.channelTypeChangeable()).isFalse();
        assertThat(detail.marketChangeable()).isFalse();
    }

    /** ⚠ Round-tripping the same fixed values is not a change and must still save the name. */
    @Test
    @DisplayName("SCS-030 resubmitting unchanged fixed fields still saves the editable one")
    void resubmittingFixedValuesIsNotAChange() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE, SystemPermissions.CHANNEL_INSTANCE_VIEW);
        UUID id = commands.create(new ShopCommandService.ShopInput("Zeon Mart", "DARAZ", "BANGLADESH"));
        bindAccount(id, "zeonmart_bd");

        commands.update(id, new ShopCommandService.ShopInput("Zeon Mart · Daraz", "DARAZ", "BANGLADESH"));

        assertThat(queries.detail(id).name()).isEqualTo("Zeon Mart · Daraz");
    }

    /**
     * 🔴 {@code INV-16.5} — THE REMOTE FACTS ARE NOT REACHABLE FROM THIS SURFACE. The input
     * record has no field for them, and the edit path leaves them exactly as authorisation
     * left them.
     */
    @Test
    @DisplayName("INV-16.5 editing never touches the bound account, the link or the audit facts")
    void editCannotReachRemoteDerivedFacts() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE, SystemPermissions.CHANNEL_INSTANCE_VIEW);
        UUID id = commands.create(new ShopCommandService.ShopInput("Zeon Mart", "DARAZ", "BANGLADESH"));
        bindAccount(id, "zeonmart_bd");
        var before = queries.detail(id);

        commands.update(id, new ShopCommandService.ShopInput("Renamed", "DARAZ", "BANGLADESH"));

        var after = queries.detail(id);
        assertThat(after.externalAccountIdentity()).isEqualTo(before.externalAccountIdentity());
        assertThat(after.externalLink()).isEqualTo(before.externalLink());
        assertThat(after.boundAt()).isEqualTo(before.boundAt());
        assertThat(after.code()).isEqualTo(before.code());
    }

    @Test
    @DisplayName("editing a shop that does not exist reports NOT FOUND")
    void updatingAMissingShopIsNotFound() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_MANAGE);

        assertThatThrownBy(() -> commands.update(UUID.randomUUID(),
                new ShopCommandService.ShopInput("A", "DARAZ", "BANGLADESH")))
                .isInstanceOf(ShopNotFoundException.class);
    }

    // =================================================================================
    // PRM-090 — permission
    // =================================================================================

    /** 🔴 {@code PRM-090.a} — VIEW is not MANAGE. Reading a shop confers no authority to add one. */
    @Test
    @DisplayName("PRM-090.a view alone cannot create or edit")
    void viewAloneCannotWrite() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_VIEW);

        assertThatThrownBy(() -> commands.create(new ShopCommandService.ShopInput("A", "DARAZ", "BD")))
                .isInstanceOf(ShopAccessDeniedException.class)
                .hasMessageContaining(SystemPermissions.CHANNEL_INSTANCE_MANAGE);
    }

    /** 🔴 {@code PRM-090.a} — LIFECYCLE is not MANAGE either. The four are independent. */
    @Test
    @DisplayName("PRM-090.a lifecycle authority alone cannot create a shop")
    void lifecycleAloneCannotWrite() {
        actingWith(SystemPermissions.CHANNEL_INSTANCE_LIFECYCLE);

        assertThatThrownBy(() -> commands.create(new ShopCommandService.ShopInput("A", "DARAZ", "BD")))
                .isInstanceOf(ShopAccessDeniedException.class)
                .hasMessageContaining(SystemPermissions.CHANNEL_INSTANCE_MANAGE);
    }

    // =================================================================================
    // helpers
    // =================================================================================

    /**
     * ⚠ Binds an account the way a real authorisation would, so the FIXED-field rules can be
     * exercised. 🔴 No OAuth flow is simulated and no credential exists.
     */
    private void bindAccount(UUID id, String accountIdentity) {
        jdbc.update("""
                UPDATE channel_instance
                   SET external_account_identity = ?, bound_at = ?, authorised_at = ?
                 WHERE id = ?
                """, accountIdentity, Timestamp.from(Instant.now()), Timestamp.from(Instant.now()), id);
    }

    private void actingWith(String... permissions) {
        var authorities = Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList();
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actorId, "sc-form-tester", "SC Form Tester", "unused",
                AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
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
}
