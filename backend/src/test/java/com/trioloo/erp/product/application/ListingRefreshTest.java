package com.trioloo.erp.product.application;

import com.trioloo.erp.access.AccessFixtures;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.product.application.channel.ChannelAdapterPort;
import com.trioloo.erp.product.application.channel.ChannelCapabilityDeclaration;
import com.trioloo.erp.product.application.channel.DiscoveryPage;
import com.trioloo.erp.product.application.channel.OutboundListingPayload;
import com.trioloo.erp.product.application.channel.OutboundResult;
import com.trioloo.erp.product.application.channel.ReportedListingSnapshot;
import com.trioloo.erp.product.application.channel.ReportedSkuSnapshot;
import com.trioloo.erp.product.domain.ListingFieldKey;
import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SellableNature;
import com.trioloo.erp.product.domain.SerializationPolicy;
import com.trioloo.erp.product.domain.SyncState;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * FRAME 16 — single-listing refresh.
 *
 * <p>🔴 THE CLAIM UNDER TEST is that REFRESH READS THE MARKETPLACE AND NEVER WRITES TO IT. A
 * successful read updates the REPORTED side and nothing else; a failed read changes nothing at
 * all and never destroys the reported facts already held.
 *
 * <p>🔴 The second claim is that a successful read is NOT agreement: refresh may legitimately
 * discover divergence, and nothing here settles such a listing as {@code SYNCED}.
 *
 * <p>⚠ The adapter here is a CONTROLLED DOUBLE registered for this test's own channel type. No
 * marketplace is contacted and no provider implementation exists.
 */
@SpringBootTest
class ListingRefreshTest {

    /** ⚠ Swapped per test. The double is the only way a remote read can be exercised at all. */
    private static volatile Supplier<Optional<ReportedListingSnapshot>> response = Optional::empty;

    /**
     * ⚠ What the double DECLARES it can read, swapped per test.
     *
     * <p>🔴 Declared per channel INSTANCE in the real contract ({@code PRD-125}); the double
     * declares one set because each test uses one channel.
     */
    private static volatile ChannelCapabilityDeclaration capability = readable(
            ListingFieldKey.TITLE, ListingFieldKey.SALE_PRICE, ListingFieldKey.LISTING_STOCK);

    /** Builds a declaration where exactly the named fields are readable. */
    private static ChannelCapabilityDeclaration readable(String... fieldKeys) {
        Map<String, ChannelCapabilityDeclaration.FieldCapability> fields = new java.util.HashMap<>();
        for (String key : fieldKeys) {
            fields.put(key, new ChannelCapabilityDeclaration.FieldCapability(true, false));
        }
        return new ChannelCapabilityDeclaration(fields);
    }

    @TestConfiguration
    static class Adapters {

        /**
         * 🔴 A CONTROLLED DOUBLE, not a marketplace. It implements the same provider-neutral
         * port a real adapter would, so what is exercised here is the application's contract
         * rather than any channel's protocol.
         */
        @Bean
        ChannelAdapterPort testAdapter() {
            return new ChannelAdapterPort() {
                /*
                  ⚠ CHANGED 2026-08-15: was the free-text "TEST-CHANNEL". V11 enforces
                  {@code INV-15.4} — Channel Type is a CLOSED SET and free text is
                  forbidden — so an unrecognised value can no longer reach the column.
                  {@code SHOPIFY} is a recognised type with NO production adapter, which
                  is exactly what this double needs. Nothing the test protects changed:
                  it still registers one controlled adapter for one channel type.
                */
                @Override public String channelType() { return "SHOPIFY"; }

                @Override public ChannelCapabilityDeclaration declareCapability(UUID id) {
                    return capability;
                }

                @Override public DiscoveryPage discoverActive(UUID id, String cursor) {
                    return new DiscoveryPage(List.of(), null, true, null);
                }

                @Override public Optional<ReportedListingSnapshot> readListing(UUID id, String ext) {
                    return response.get();
                }

                @Override public OutboundResult pushUpdate(UUID id, OutboundListingPayload p) {
                    throw new UnsupportedOperationException("Frame 16 exercises inbound only.");
                }

                @Override public OutboundResult publishCreate(UUID id, OutboundListingPayload p) {
                    throw new UnsupportedOperationException("Frame 16 exercises inbound only.");
                }

                @Override public OutboundResult withdraw(UUID id, String ext) {
                    throw new UnsupportedOperationException("Frame 16 exercises inbound only.");
                }
            };
        }
    }

    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private StockItemCommandService stockItems;
    @Autowired private SellableProductCommandService sellables;
    @Autowired private ChannelListingCommandService commands;
    @Autowired private ChannelListingQueryService queries;
    @Autowired private ChannelListingOperationService operations;

    private AccessFixtures fixtures;
    private UUID actorId;

    @BeforeEach
    void setUp() {
        fixtures = new AccessFixtures(jdbc, passwordEncoder);
        clearProductData();
        fixtures.clear();
        for (String permission : List.of(ProductPermissions.CHANNEL_LISTING_VIEW,
                ProductPermissions.CHANNEL_LISTING_MANAGE,
                ProductPermissions.CHANNEL_LISTING_PUBLISH,
                ProductPermissions.CHANNEL_LISTING_SYNC,
                ProductPermissions.SELLABLE_PRODUCT_VIEW,
                ProductPermissions.SELLABLE_PRODUCT_MANAGE,
                ProductPermissions.STOCK_ITEM_VIEW,
                ProductPermissions.STOCK_ITEM_MANAGE)) {
            fixtures.createPermission(permission);
        }
        actorId = fixtures.createProfile("p16-tester", "irrelevant", AccountLifecycleState.ACTIVE);
        response = Optional::empty;
        capability = readable(ListingFieldKey.TITLE, ListingFieldKey.SALE_PRICE,
                ListingFieldKey.LISTING_STOCK);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clearProductData();
        response = Optional::empty;
        capability = readable(ListingFieldKey.TITLE);
    }

    // =================================================================================
    // §57 — permission
    // =================================================================================

    /** 🔴 {@code PRD-196.a} — an inbound act needs SYNC. Publish does not confer it. */
    @Test
    @DisplayName("PRD-196.a publish alone cannot refresh")
    void publishDoesNotGrantRefresh() {
        actingAll();
        UUID id = seed("SHOPIFY", "88301", true);
        actingWith(ProductPermissions.CHANNEL_LISTING_VIEW, ProductPermissions.CHANNEL_LISTING_PUBLISH);

        assertThatThrownBy(() -> operations.refreshOne(id))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(ProductPermissions.CHANNEL_LISTING_SYNC);
    }

    /** 🔴 Manage is local authoring authority and confers nothing inbound either. */
    @Test
    @DisplayName("PRD-196.a manage alone cannot refresh")
    void manageDoesNotGrantRefresh() {
        actingAll();
        UUID id = seed("SHOPIFY", "88302", true);
        actingWith(ProductPermissions.CHANNEL_LISTING_VIEW, ProductPermissions.CHANNEL_LISTING_MANAGE);

        assertThatThrownBy(() -> operations.refreshOne(id))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(ProductPermissions.CHANNEL_LISTING_SYNC);
    }

    // =================================================================================
    // §58 · §59 — preconditions refuse before recording
    // =================================================================================

    /**
     * 🔴 §58 — no adapter, so the act CANNOT BE ATTEMPTED. It is refused BEFORE any operation,
     * batch or activity row exists: a record of an attempt that never happened would be a lie
     * the operator could not detect.
     */
    @Test
    @DisplayName("§58 with no adapter the refresh is refused and records nothing")
    void noAdapterRefusesWithoutRecording() {
        actingAll();
        UUID id = seed("DARAZ", "88303", true);
        long operationsBefore = count("channel_listing_operation");
        long batchesBefore = count("channel_listing_operation_batch");
        // ⚠ Creating the fixture legitimately wrote field-change activity. The claim is that
        //   the REFUSED REFRESH adds nothing, so the comparison is against the before-count.
        long activityBefore = count("channel_listing_activity");

        assertThatThrownBy(() -> operations.refreshOne(id))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("No marketplace adapter is configured");

        assertThat(count("channel_listing_operation")).isEqualTo(operationsBefore);
        assertThat(count("channel_listing_operation_batch")).isEqualTo(batchesBefore);
        assertThat(count("channel_listing_activity")).isEqualTo(activityBefore);
    }

    /**
     * 🔴 §59 / {@code PRD-188.b} — a listing the channel has never accepted has nothing to read
     * back, and NO identifier is invented to make the request possible.
     */
    @Test
    @DisplayName("§59 a listing with no remote identity cannot be refreshed")
    void noRemoteIdentityRefuses() {
        actingAll();
        UUID id = seed("SHOPIFY", null, true);
        long before = count("channel_listing_operation");

        assertThatThrownBy(() -> operations.refreshOne(id))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("has not been published yet");

        assertThat(count("channel_listing_operation")).isEqualTo(before);
    }

    // =================================================================================
    // API-063.a — the ADAPTER declares capability, and the workspace sees what it declared
    // =================================================================================

    /**
     * 🔴 THE DEFECT THIS EXISTS FOR. {@code channels()} built its per-field capability list
     * from {@code channel_adapter_capability} alone — a table NOTHING in this system ever
     * writes. Every field therefore reported UNDECLARED, and the operator was told "what it
     * can read or write is unknown" beside a channel whose adapter had just read nine real
     * listings successfully.
     *
     * <p>✅ {@code API-063.a} makes the ADAPTER the declaring authority, so it is asked.
     */
    @Test
    @DisplayName("API-063.a the channel view reports what the adapter actually declares")
    void channelViewReportsTheAdapterDeclaration() {
        actingAll();
        seed("SHOPIFY", "88350", false);
        capability = readable(ListingFieldKey.TITLE, ListingFieldKey.SALE_PRICE,
                ListingFieldKey.LISTING_STOCK);

        var channel = queries.channels().stream()
                .filter(c -> "SHOPIFY".equals(c.channelType())).findFirst().orElseThrow();

        assertThat(channel.capabilities()).isNotEmpty();
        assertThat(channel.capabilities().stream()
                .filter(ListingViews.CapabilityView::readable)
                .map(ListingViews.CapabilityView::fieldKey))
                .containsExactlyInAnyOrder(ListingFieldKey.TITLE, ListingFieldKey.SALE_PRICE,
                        ListingFieldKey.LISTING_STOCK);
    }

    /**
     * 🔴 READABLE IS NOT WRITABLE. The double declares three fields readable and none writable,
     * exactly as the Daraz adapter does — and the view must not upgrade one into the other.
     */
    @Test
    @DisplayName("API-063 a readable field is not reported writable")
    void readableIsNotReportedWritable() {
        actingAll();
        seed("SHOPIFY", "88351", false);
        capability = readable(ListingFieldKey.TITLE);

        var channel = queries.channels().stream()
                .filter(c -> "SHOPIFY".equals(c.channelType())).findFirst().orElseThrow();

        assertThat(channel.capabilities().stream().noneMatch(ListingViews.CapabilityView::writable))
                .isTrue();
    }

    /**
     * 🔴 A CHANNEL WITH NO ADAPTER DECLARES NOTHING, and absence stays NO support rather than
     * assumed support ({@code API-063}).
     */
    @Test
    @DisplayName("API-063 a channel with no adapter declares nothing readable or writable")
    void noAdapterDeclaresNothing() {
        actingAll();
        seed("DARAZ", "88352", false);

        var channel = queries.channels().stream()
                .filter(c -> "DARAZ".equals(c.channelType())).findFirst().orElseThrow();

        assertThat(channel.capabilities().stream()
                .noneMatch(c -> c.readable() || c.writable())).isTrue();
    }

    // =================================================================================
    // Adapter capability — "no adapter" is NOT "nothing readable"
    // =================================================================================

    /**
     * 🔴 THE DISTINCTION THIS CLOSURE EXISTS FOR. An adapter that EXISTS but declares nothing
     * readable blocks Refresh for a completely different reason than a missing adapter, and
     * the message says so: looking for an integration that is already installed is exactly
     * the wasted trip a merged message would cause.
     */
    @Test
    @DisplayName("API-063 an adapter that declares nothing readable is not reported as missing")
    void adapterPresentButNothingReadable() {
        actingAll();
        UUID id = seed("SHOPIFY", "88360", true);
        capability = new ChannelCapabilityDeclaration(Map.of());
        long operationsBefore = count("channel_listing_operation");
        long activityBefore = count("channel_listing_activity");

        assertThatThrownBy(() -> operations.refreshOne(id))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("reports no readable Listing facts")
                // 🔴 It must NOT claim the adapter is absent.
                .hasMessageNotContaining("No marketplace adapter is configured");

        // 🔴 The adapter was never called and nothing was recorded.
        assertThat(count("channel_listing_operation")).isEqualTo(operationsBefore);
        assertThat(count("channel_listing_operation_batch")).isZero();
        assertThat(count("channel_listing_activity")).isEqualTo(activityBefore);
        // 🔴 No reported fact was invented from a request that never executed.
        assertThat(queries.detail(id).reportedSalePriceReadable()).isFalse();
        assertThat(queries.detail(id).reportedSalePrice()).isNull();
        assertThat(queries.detail(id).hasUnsentLocalChanges()).isTrue();
    }

    /**
     * 🔴 An ABSENT declaration is NO support, never assumed support ({@code API-063}). A null
     * declaration is treated exactly as an empty one.
     */
    @Test
    @DisplayName("API-063 an absent declaration is treated as no support, not assumed support")
    void absentDeclarationIsNoSupport() {
        actingAll();
        UUID id = seed("SHOPIFY", "88361", true);
        capability = null;

        assertThatThrownBy(() -> operations.refreshOne(id))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("reports no readable Listing facts");
    }

    /**
     * 🔴 {@code PRD-199.h} applied to READABILITY — publication intent has no reported
     * counterpart, so declaring it readable does not make any listing FACT readable back.
     */
    @Test
    @DisplayName("publication intent alone is not a readable listing fact")
    void publicationIntentAloneIsNotReadable() {
        actingAll();
        UUID id = seed("SHOPIFY", "88362", true);
        capability = readable(ListingFieldKey.PUBLICATION_INTENT);

        assertThatThrownBy(() -> operations.refreshOne(id))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("reports no readable Listing facts");
    }

    /**
     * ✅ PARTIAL CAPABILITY DOES NOT BLOCK. One readable fact makes the read worth performing;
     * the facts the adapter cannot read stay {@code NOT_READABLE} AFTERWARDS rather than
     * preventing the read from happening at all.
     */
    @Test
    @DisplayName("a partially readable adapter refreshes, leaving the rest not readable")
    void partialCapabilityStillRefreshes() {
        actingAll();
        UUID id = seed("SHOPIFY", "88363", true);
        // Declares title and price only — no stock, no media.
        capability = readable(ListingFieldKey.TITLE, ListingFieldKey.SALE_PRICE);
        response = () -> Optional.of(new ReportedListingSnapshot("88363", "Listing 88363", true,
                null, false, new BigDecimal("30900.00"), true, null, false, null, null, false,
                null, false, null, false, null, Map.of(), null, false, List.of()));

        RefreshResultView result = operations.refreshOne(id);

        assertThat(result.outcome()).isEqualTo("SUCCEEDED");
        ChannelListingView listing = queries.detail(id);
        assertThat(listing.reportedSalePrice()).isEqualTo("30900.00");
        // 🔴 Absent, not zero, not agreement.
        assertThat(listing.reportedStockReadable()).isFalse();
        assertThat(result.notReadableFieldCount()).isPositive();
    }

    /** ✅ A fully readable adapter proceeds exactly as before. */
    @Test
    @DisplayName("a readable adapter refreshes normally")
    void readableCapabilityRefreshes() {
        actingAll();
        UUID id = seed("SHOPIFY", "88364", true);
        response = () -> Optional.of(snapshot("88364", "Listing 88364", new BigDecimal("32500.00")));

        assertThat(operations.refreshOne(id).outcome()).isEqualTo("SUCCEEDED");
    }

    /**
     * 🔴 THE DIMENSIONS STAY APART. Capability is checked only after AUTHORITY and after
     * REMOTE IDENTITY, so each unmet precondition is reported as itself.
     */
    @Test
    @DisplayName("permission and remote identity remain separate from capability")
    void preconditionsStaySeparate() {
        actingAll();
        UUID withoutIdentity = seed("SHOPIFY", null, true);
        capability = new ChannelCapabilityDeclaration(Map.of());

        // 🔴 Missing identity is reported as itself, not as a capability problem.
        assertThatThrownBy(() -> operations.refreshOne(withoutIdentity))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("has not been published yet")
                .hasMessageNotContaining("readable Listing facts");

        // 🔴 Absent authority is reported as itself, even when capability is also unmet.
        actingWith(ProductPermissions.CHANNEL_LISTING_VIEW, ProductPermissions.CHANNEL_LISTING_MANAGE);
        assertThatThrownBy(() -> operations.refreshOne(withoutIdentity))
                .isInstanceOf(AccessDeniedByPermissionException.class);
    }

    // =================================================================================
    // §61 · §62 · §63 — what a successful read does
    // =================================================================================

    /** 🔴 §61 — the channel was read and nothing readable moved. No false divergence. */
    @Test
    @DisplayName("§61 an unchanged read completes with no change and invents no divergence")
    void successNoChange() {
        actingAll();
        UUID id = seed("SHOPIFY", "88310", true);
        // First read establishes the reported side.
        response = () -> Optional.of(snapshot("88310", "Listing 88310", new BigDecimal("32500.00")));
        operations.refreshOne(id);

        RefreshResultView second = operations.refreshOne(id);

        assertThat(second.outcome()).isEqualTo("SUCCEEDED");
        assertThat(second.state()).isEqualTo(RefreshResultView.STATE_COMPLETED_NO_CHANGE);
        assertThat(second.changedDomains()).isEmpty();
        assertThat(second.divergedFieldCount()).isZero();
    }

    /**
     * 🔴 §62 — THE CENTRAL CLAIM. A readable remote change updates the REPORTED side and the
     * INTENDED side is untouched, so the difference becomes visible instead of being silently
     * absorbed ({@code PRD-181.a}).
     */
    @Test
    @DisplayName("§62 a changed read updates reported only and never touches intended")
    void successChangeIsReportedOnly() {
        actingAll();
        UUID id = seed("SHOPIFY", "88311", true);
        markPushed(id);
        response = () -> Optional.of(snapshot("88311", "Listing 88311", new BigDecimal("32500.00")));
        operations.refreshOne(id);

        // The channel now reports a price Trioloo never intended.
        response = () -> Optional.of(snapshot("88311", "Listing 88311", new BigDecimal("30900.00")));
        RefreshResultView result = operations.refreshOne(id);

        assertThat(result.outcome()).isEqualTo("SUCCEEDED");
        assertThat(result.state()).isEqualTo(RefreshResultView.STATE_COMPLETED_CHANGED);
        assertThat(result.changedDomains()).contains("Sale Price");
        assertThat(result.divergedFieldCount()).isPositive();

        ChannelListingView listing = queries.detail(id);
        // 🔴 INTENDED IS UNTOUCHED. This is the whole reason the pair model exists.
        assertThat(listing.salePrice()).isEqualTo("32500.00");
        assertThat(listing.reportedSalePrice()).isEqualTo("30900.00");
        assertThat(listing.intendedTitle()).isEqualTo("Listing 88311");
    }

    /**
     * 🔴 §13 — A SUCCESSFUL READ IS NOT AGREEMENT. A refresh that discovers a readable
     * difference settles the listing DIVERGED, never SYNCED.
     */
    @Test
    @DisplayName("§13 a successful read that finds a difference is not labelled SYNCED")
    void successIsNotSynced() {
        actingAll();
        UUID id = seed("SHOPIFY", "88312", true);
        markPushed(id);
        response = () -> Optional.of(snapshot("88312", "A different title", new BigDecimal("30900.00")));

        operations.refreshOne(id);

        assertThat(queries.detail(id).syncState()).isEqualTo(SyncState.DIVERGED);
    }

    /**
     * 🔴 {@code PRD-185.d} / §52 — UNSENT AND DIVERGED ARE DIFFERENT FACTS. On a Listing whose
     * local edit was never pushed, a readable difference is EXPLAINED by that unsent edit and
     * is therefore UNSENT, not divergence — so Accept Marketplace is not offered for it.
     *
     * <p>⚠ This is why the two tests above mark the Listing as pushed first: divergence is
     * only meaningful once the ERP believes its own values reached the channel.
     */
    @Test
    @DisplayName("PRD-185.d a difference on a never-pushed Listing is UNSENT, not DIVERGED")
    void differenceOnUnsentListingIsNotDivergence() {
        actingAll();
        UUID id = seed("SHOPIFY", "88314", true);
        response = () -> Optional.of(snapshot("88314", "A different title", new BigDecimal("30900.00")));

        RefreshResultView result = operations.refreshOne(id);

        assertThat(result.unsentLocalChanges()).isTrue();
        assertThat(result.divergedFieldCount()).isZero();
        assertThat(queries.detail(id).syncState()).isEqualTo(SyncState.SYNCED);
    }

    /** ✅ §63 — where the channel now matches intent, ALIGNED is a legitimate conclusion. */
    @Test
    @DisplayName("§63 a read that matches intent may become ALIGNED without clearing UNSENT")
    void successAlignedKeepsUnsent() {
        actingAll();
        UUID id = seed("SHOPIFY", "88313", true);
        assertThat(queries.detail(id).hasUnsentLocalChanges()).isTrue();

        response = () -> Optional.of(snapshot("88313", "Listing 88313", new BigDecimal("32500.00")));
        RefreshResultView result = operations.refreshOne(id);

        assertThat(result.divergedFieldCount()).isZero();
        assertThat(queries.detail(id).syncState()).isEqualTo(SyncState.SYNCED);
        /*
          🔴 §17 / §29 — REFRESH DISCOVERED EQUALITY; IT DID NOT PROVE TRIOLOO'S OUTBOUND
          OPERATION COMPLETED. Clearing the unsent condition on a coincidence would tell the
          operator their edit had been sent when nothing ever sent it.
        */
        assertThat(result.unsentLocalChanges()).isTrue();
        assertThat(queries.detail(id).hasUnsentLocalChanges()).isTrue();
        assertThat(jdbc.queryForObject(
                "SELECT last_successful_push_at FROM channel_listing WHERE id = ?",
                Instant.class, id)).isNull();
    }

    // =================================================================================
    // §64 — failure
    // =================================================================================

    /**
     * 🔴 §31 / §64 — A FAILED FETCH MUST NOT DESTROY WHAT WE ALREADY KNEW. The previously read
     * reported facts survive, and the failure is reported as an OPERATION concern rather than
     * as divergence, unreadability or a lifecycle change.
     */
    @Test
    @DisplayName("§31 a failed refresh preserves the last good reported state")
    void failurePreservesLastGoodReported() {
        actingAll();
        UUID id = seed("SHOPIFY", "88320", true);
        response = () -> Optional.of(snapshot("88320", "Listing 88320", new BigDecimal("31000.00")));
        operations.refreshOne(id);
        assertThat(queries.detail(id).reportedSalePrice()).isEqualTo("31000.00");

        response = () -> { throw new IllegalStateException("The channel could not be reached."); };
        RefreshResultView result = operations.refreshOne(id);

        assertThat(result.outcome()).isEqualTo("FAILED");
        assertThat(result.state()).isEqualTo(RefreshResultView.STATE_FAILED);
        // 🔴 The known values are STILL THERE. A failed request is not new information about
        //    the marketplace, and blanking them would invent one.
        ChannelListingView listing = queries.detail(id);
        assertThat(listing.reportedSalePrice()).isEqualTo("31000.00");
        assertThat(listing.reportedSalePriceReadable()).isTrue();
        assertThat(listing.salePrice()).isEqualTo("32500.00");
    }

    /**
     * 🔴 §32 — "the channel did not return it" is NOT a deletion. Nothing about the listing's
     * lifecycle changes, and a person is asked to look ({@code PRD-177}).
     */
    @Test
    @DisplayName("§32 a listing the channel did not return is not treated as deleted")
    void notFoundIsNotDeletion() {
        actingAll();
        UUID id = seed("SHOPIFY", "88321", true);
        String lifecycleBefore = jdbc.queryForObject(
                "SELECT local_lifecycle FROM channel_listing WHERE id = ?", String.class, id);

        response = Optional::empty;
        RefreshResultView result = operations.refreshOne(id);

        assertThat(result.outcome()).isEqualTo("MANUAL_REQUIRED");
        assertThat(result.detail()).contains("absence is not a deletion");
        assertThat(jdbc.queryForObject("SELECT local_lifecycle FROM channel_listing WHERE id = ?",
                String.class, id)).isEqualTo(lifecycleBefore);
    }

    // =================================================================================
    // §65 — partial readability
    // =================================================================================

    /**
     * 🔴 §65 / {@code API-063.c} — a fact the channel did not return stays NOT READABLE. It
     * never becomes blank, zero or agreement, and the whole refresh is not called a failure
     * merely because one domain could not be read.
     */
    @Test
    @DisplayName("§65 unreadable facts stay unreadable while readable ones update")
    void partialReadability() {
        actingAll();
        UUID id = seed("SHOPIFY", "88330", true);
        response = () -> Optional.of(new ReportedListingSnapshot("88330",
                "Listing 88330", true,             // title readable
                null, false,                       // description NOT readable
                new BigDecimal("30900.00"), true,  // Sale Price readable
                null, false, null, null, false,    // no promotion reported
                null, false,                       // stock NOT readable
                null, false,                       // category NOT readable
                null, Map.of(), null, false, List.of()));

        RefreshResultView result = operations.refreshOne(id);

        assertThat(result.outcome()).isEqualTo("SUCCEEDED");
        ChannelListingView listing = queries.detail(id);
        assertThat(listing.reportedSalePrice()).isEqualTo("30900.00");
        // 🔴 Absent, not zero and not empty.
        assertThat(listing.reportedStockReadable()).isFalse();
        assertThat(listing.reportedStock()).isNull();
        assertThat(listing.reportedDescriptionReadable()).isFalse();
        assertThat(result.notReadableFieldCount()).isPositive();
    }

    // =================================================================================
    // §66 — per-SKU truth
    // =================================================================================

    /**
     * 🔴 §66 / {@code UX-271.d} — each orderable unit keeps its OWN reported facts. No
     * parent-fill, no averaging and no borrowing between siblings.
     */
    @Test
    @DisplayName("§66 each SKU keeps its own reported facts")
    void perSkuFactsStayApart() {
        actingAll();
        UUID id = seed("SHOPIFY", "88340", true);
        jdbc.update("UPDATE channel_listing_sku SET channel_sku = 'SKU-A' WHERE channel_listing_id = ?", id);
        jdbc.update("""
                INSERT INTO channel_listing_sku (id, channel_listing_id, channel_sku, position,
                                                 created_by, created_at, updated_by, updated_at, version)
                VALUES (?, ?, 'SKU-B', 1, ?, now(), ?, now(), 0)
                """, UUID.randomUUID(), id, actorId, actorId);

        response = () -> Optional.of(new ReportedListingSnapshot("88340", "Listing 88340", true,
                null, false, new BigDecimal("32500.00"), true, null, false, null, null, false,
                null, false, null, false, null, Map.of(), null, false,
                List.of(new ReportedSkuSnapshot("SKU-A", new BigDecimal("11100.00"), true,
                                null, false, null, null, false, new BigDecimal("4"), true, "A"),
                        new ReportedSkuSnapshot("SKU-B", new BigDecimal("22200.00"), true,
                                null, false, null, null, false, new BigDecimal("9"), true, "B"))));

        operations.refreshOne(id);

        List<ListingViews.SkuView> skus = queries.detail(id).skus();
        assertThat(skus).hasSize(2);
        ListingViews.SkuView a = skus.stream().filter(s -> "SKU-A".equals(s.channelSku())).findFirst().orElseThrow();
        ListingViews.SkuView b = skus.stream().filter(s -> "SKU-B".equals(s.channelSku())).findFirst().orElseThrow();
        assertThat(a.reportedSalePrice()).isEqualTo("11100.00");
        assertThat(b.reportedSalePrice()).isEqualTo("22200.00");
        assertThat(a.reportedStock()).isEqualTo("4");
        assertThat(b.reportedStock()).isEqualTo("9");
    }

    /**
     * 🔴 §66 / {@code §39.10.k} — the remote identity of an orderable SKU is UNDEFINED in the
     * domain model. A reported SKU the ERP cannot truthfully associate becomes its own
     * UNMAPPED unit; its facts are never poured into an existing sibling to make them fit.
     */
    @Test
    @DisplayName("§39.10.k an unassociable reported SKU is not merged into a sibling")
    void unassociableSkuIsNotInvented() {
        actingAll();
        UUID id = seed("SHOPIFY", "88341", true);
        jdbc.update("UPDATE channel_listing_sku SET channel_sku = 'SKU-A' WHERE channel_listing_id = ?", id);
        jdbc.update("""
                INSERT INTO channel_listing_sku (id, channel_listing_id, channel_sku, position,
                                                 created_by, created_at, updated_by, updated_at, version)
                VALUES (?, ?, 'SKU-B', 1, ?, now(), ?, now(), 0)
                """, UUID.randomUUID(), id, actorId, actorId);

        response = () -> Optional.of(new ReportedListingSnapshot("88341", "Listing 88341", true,
                null, false, new BigDecimal("32500.00"), true, null, false, null, null, false,
                null, false, null, false, null, Map.of(), null, false,
                List.of(new ReportedSkuSnapshot("SKU-UNKNOWN", new BigDecimal("99900.00"), true,
                        null, false, null, null, false, new BigDecimal("1"), true, "?"))));

        operations.refreshOne(id);

        List<ListingViews.SkuView> skus = queries.detail(id).skus();
        // 🔴 The unknown unit exists on its own; neither sibling absorbed its price.
        assertThat(skus).hasSize(3);
        assertThat(skus).filteredOn(s -> "SKU-A".equals(s.channelSku()))
                .allSatisfy(s -> assertThat(s.reportedSalePrice()).isNull());
        assertThat(skus).filteredOn(s -> "SKU-B".equals(s.channelSku()))
                .allSatisfy(s -> assertThat(s.reportedSalePrice()).isNull());
    }

    // =================================================================================
    // §68 — operation records
    // =================================================================================

    /** 🔴 §68 — a real attempt IS an operation, and one attempt produces exactly one record. */
    @Test
    @DisplayName("§68 one refresh produces exactly one operation record")
    void oneRefreshOneOperation() {
        actingAll();
        UUID id = seed("SHOPIFY", "88350", true);
        response = () -> Optional.of(snapshot("88350", "Listing 88350", new BigDecimal("32500.00")));

        operations.refreshOne(id);

        assertThat(count("channel_listing_operation")).isEqualTo(1);
        assertThat(operations.operationsFor(id)).hasSize(1);
    }

    // =================================================================================
    // Fixtures
    // =================================================================================

    private ReportedListingSnapshot snapshot(String ext, String title, BigDecimal price) {
        return new ReportedListingSnapshot(ext, title, true, null, false, price, true,
                null, false, null, null, false, null, false, null, false, null,
                Map.of(), null, false, List.of());
    }

    private UUID seed(String channelType, String externalId, boolean mapped) {
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type)
                VALUES (?, ?, ?, ?)
                """, UUID.randomUUID(), "CH-" + channelType, "Channel " + channelType, channelType);
        if (mapped) {
            stockItems.createInternal(new StockItemCommandService.StockItemInput(
                    "INV-1", "Component INV-1", "Trioloo", "RAM", "pcs", null,
                    SerializationPolicy.NOT_SERIALIZED, "RAM", RecordStatus.ACTIVE),
                    actorId, Instant.now());
            sellables.createInternal(new SellableProductCommandService.SellableProductInput(
                    "SEL-1", "Sellable SEL-1", SellableNature.SIMPLE, null, "Components", null,
                    RecordStatus.ACTIVE, "INV-1", new BigDecimal("1"), null),
                    actorId, Instant.now());
        }
        return commands.create(new ChannelListingCommandService.ChannelListingInput(
                "CH-" + channelType, externalId, null, mapped ? "SEL-1" : null,
                "Listing " + externalId, "Description", new BigDecimal("32500.00"),
                null, null, null, new BigDecimal("12"), "PUBLISH",
                null, null, null, null, null, null, null, null, null, null, null, null));
    }

    /**
     * ⚠ Marks the Listing as having been successfully pushed.
     *
     * <p>🔴 Written directly because no adapter exists to perform a real push. It sets ONLY the
     * derived-unsent input, so a later readable difference reads as DIVERGENCE rather than as
     * an unsent local edit ({@code PRD-185.d}).
     */
    private void markPushed(UUID id) {
        jdbc.update("UPDATE channel_listing SET last_successful_push_at = now() WHERE id = ?", id);
    }

    private long count(String table) {
        Long value = jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
        return value == null ? 0L : value;
    }

    private void actingAll() {
        actingWith(ProductPermissions.CHANNEL_LISTING_VIEW, ProductPermissions.CHANNEL_LISTING_MANAGE,
                ProductPermissions.CHANNEL_LISTING_PUBLISH, ProductPermissions.CHANNEL_LISTING_SYNC,
                ProductPermissions.SELLABLE_PRODUCT_MANAGE, ProductPermissions.SELLABLE_PRODUCT_VIEW,
                ProductPermissions.STOCK_ITEM_MANAGE, ProductPermissions.STOCK_ITEM_VIEW);
    }

    private void actingWith(String... permissions) {
        var authorities = java.util.Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList();
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actorId, "p16-tester", "P16 Tester", "unused",
                AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private void clearProductData() {
        for (String table : List.of("channel_listing_activity", "channel_listing_operation",
                "channel_listing_operation_batch", "channel_listing_highlight",
                "channel_listing_attribute", "channel_listing_reported_media",
                "channel_listing_intended_media", "sellable_product_media", "media_asset",
                "channel_listing_sku", "channel_listing", "channel_adapter_capability",
                "channel_instance", "bundle_member", "bom_line", "build_template",
                "sellable_product", "stock_reservation", "inventory_movement",
                "product_variant")) {
            jdbc.update("DELETE FROM " + table);
        }
    }

    // ============================ bounded attributes, the first-live-pull regression

    /**
     * 🔴 THE REGRESSION TEST FOR THE FIRST LIVE SYNC NOW. It failed with
     * {@code value too long for type character varying(1024)} inserting into
     * {@code channel_listing_attribute}, and the whole discovery rolled back — a real seller's
     * catalogue, lost to one long attribute.
     *
     * <p>⚠ EVERY EXISTING TEST PASSED THROUGH THIS CODE and none caught it, because every fixture
     * used short values. The column limit only exists in the database, so only a test that actually
     * writes can prove the behaviour.
     */
    @Test
    @DisplayName("🔴 an attribute too long to store is recorded unreadable, and the refresh succeeds")
    void overlongAttributeDoesNotBreakPersistence() {
        actingAll();
        UUID id = seed("SHOPIFY", "88401", true);
        capability = readable(ListingFieldKey.TITLE, ListingFieldKey.DESCRIPTION,
                ListingFieldKey.ATTRIBUTES);

        /* A description far past the generic column, exactly as a real product carries. */
        String longDescription = "<p>" + "d".repeat(4000) + "</p>";
        Map<String, String> attributes = new java.util.LinkedHashMap<>();
        attributes.put("brand", "Zeon");
        /* 🔴 A null value is the adapter saying: this attribute exists and could not be recorded. */
        attributes.put("warranty", null);

        response = () -> Optional.of(new ReportedListingSnapshot("88401", "Long listing", true,
                longDescription, true, null, false, null, false, null, null, false,
                null, false, null, false, null, attributes, null, false, List.of()));

        /* ✅ No DataIntegrityViolationException — this is the line that used to throw. */
        RefreshResultView result = operations.refreshOne(id);
        assertThat(result.outcome()).isEqualTo("SUCCEEDED");

        /* ✅ The long description landed on its own unbounded column. */
        assertThat(queries.detail(id).reportedDescription()).isEqualTo(longDescription);

        /* ✅ The ordinary attribute stored normally. */
        assertThat(jdbc.queryForObject(
                "SELECT reported_value FROM channel_listing_attribute "
                        + "WHERE channel_listing_id = ? AND attribute_key = 'brand'", String.class, id))
                .isEqualTo("Zeon");
        assertThat(jdbc.queryForObject(
                "SELECT reported_readable FROM channel_listing_attribute "
                        + "WHERE channel_listing_id = ? AND attribute_key = 'brand'", Boolean.class, id))
                .isTrue();

        /* 🔴 The unrecordable one kept its KEY, with no value and readable=false. */
        assertThat(jdbc.queryForObject(
                "SELECT reported_value FROM channel_listing_attribute "
                        + "WHERE channel_listing_id = ? AND attribute_key = 'warranty'", String.class, id))
                .isNull();
        assertThat(jdbc.queryForObject(
                "SELECT reported_readable FROM channel_listing_attribute "
                        + "WHERE channel_listing_id = ? AND attribute_key = 'warranty'", Boolean.class, id))
                .isFalse();

        /* 🔴 And no copy of the description was written into the generic table. */
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM channel_listing_attribute WHERE channel_listing_id = ? "
                        + "AND attribute_key = 'description'", Long.class, id)).isZero();
    }
}
