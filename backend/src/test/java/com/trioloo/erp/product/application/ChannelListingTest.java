package com.trioloo.erp.product.application;

import com.trioloo.erp.access.AccessFixtures;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.product.domain.ListingFieldKey;
import com.trioloo.erp.product.domain.MappingState;
import com.trioloo.erp.product.domain.OperationKind;
import com.trioloo.erp.product.domain.OperationOutcome;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The ratified Channel Listing behaviour.
 *
 * <p>These tests exist to pin the rules that are easy to break by accident: save is not push,
 * unmapped is a legitimate state, reported never overwrites intended, manage does not imply
 * publish, and an absent adapter is reported honestly rather than simulated.
 */
@SpringBootTest
class ChannelListingTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private StockItemCommandService stockItems;
    @Autowired private SellableProductCommandService sellables;
    @Autowired private ChannelListingCommandService commands;
    @Autowired private ChannelListingQueryService queries;
    @Autowired private ChannelListingOperationService operations;
    @Autowired private ChannelListingCsvService csv;

    private AccessFixtures fixtures;
    private UUID actorId;

    /**
     * A promotion window positioned relative to a REAL now.
     *
     * <p>🔴 {@code PRD-199.d} makes the effective price a function of the clock. Rather than
     * substitute a clock, these tests move the WINDOW — which exercises the same rule against
     * the same clock the application actually reads, and is deterministic on any calendar day.
     */
    // ⚠ Postgres `timestamptz` stores MICROSECONDS. A nanosecond-precision fixture would
    // fail its own round-trip assertion, which would be a defect in the test, not the code.
    private static final Instant NOW = Instant.now().truncatedTo(ChronoUnit.MILLIS);
    private static final Instant STARTS = NOW.minus(Duration.ofDays(1));
    private static final Instant ENDS = NOW.plus(Duration.ofDays(1));
    /** A window that has not opened yet. */
    private static final Instant FUTURE_STARTS = NOW.plus(Duration.ofDays(7));
    private static final Instant FUTURE_ENDS = NOW.plus(Duration.ofDays(14));
    /** A window that has already closed. */
    private static final Instant PAST_STARTS = NOW.minus(Duration.ofDays(14));
    private static final Instant PAST_ENDS = NOW.minus(Duration.ofDays(7));

    @BeforeEach
    void setUp() {
        fixtures = new AccessFixtures(jdbc, passwordEncoder);
        clearProductData();
        fixtures.clear();
        seedProductPermissions();
        actorId = fixtures.createProfile("p3-tester", "irrelevant", AccountLifecycleState.ACTIVE);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clearProductData();
    }

    private void clearProductData() {
        jdbc.update("DELETE FROM channel_listing_activity");
        jdbc.update("DELETE FROM channel_listing_operation");
        jdbc.update("DELETE FROM channel_listing_operation_batch");
        jdbc.update("DELETE FROM channel_listing_highlight");
        jdbc.update("DELETE FROM channel_listing_attribute");
        jdbc.update("DELETE FROM channel_listing_reported_media");
        jdbc.update("DELETE FROM channel_listing_intended_media");
        jdbc.update("DELETE FROM sellable_product_media");
        jdbc.update("DELETE FROM media_asset");
        jdbc.update("DELETE FROM channel_listing_sku");
        jdbc.update("DELETE FROM channel_listing");
        jdbc.update("DELETE FROM channel_adapter_capability");
        jdbc.update("DELETE FROM channel_instance");
        jdbc.update("DELETE FROM bundle_member");
        jdbc.update("DELETE FROM bom_line");
        jdbc.update("DELETE FROM build_template");
        jdbc.update("DELETE FROM sellable_product");
        jdbc.update("DELETE FROM stock_reservation");
        jdbc.update("DELETE FROM inventory_movement");
        jdbc.update("DELETE FROM product_variant");
    }

    private void seedProductPermissions() {
        fixtures.createPermission(ProductPermissions.STOCK_ITEM_VIEW);
        fixtures.createPermission(ProductPermissions.STOCK_ITEM_MANAGE);
        fixtures.createPermission(ProductPermissions.SELLABLE_PRODUCT_VIEW);
        fixtures.createPermission(ProductPermissions.SELLABLE_PRODUCT_MANAGE);
        fixtures.createPermission(ProductPermissions.CHANNEL_LISTING_VIEW);
        fixtures.createPermission(ProductPermissions.CHANNEL_LISTING_MANAGE);
        fixtures.createPermission(ProductPermissions.CHANNEL_LISTING_PUBLISH);
        fixtures.createPermission(ProductPermissions.CHANNEL_LISTING_SYNC);
    }

    private void actingWith(String... permissions) {
        var authorities = java.util.Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList();
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actorId, "p3-tester", "P3 Tester", "unused",
                AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private UUID channel(String code) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type)
                VALUES (?, ?, ?, ?)
                """, id, code, "Channel " + code, "DARAZ");
        return id;
    }

    private void stockItem(String sku) {
        stockItems.createInternal(new StockItemCommandService.StockItemInput(
                sku, "Component " + sku, "Trioloo", "RAM", "pcs", null,
                SerializationPolicy.NOT_SERIALIZED, "RAM", RecordStatus.ACTIVE), actorId, Instant.now());
    }

    private void simple(String sellableSku, String inventorySku) {
        stockItem(inventorySku);
        sellables.createInternal(new SellableProductCommandService.SellableProductInput(
                sellableSku, "Sellable " + sellableSku, SellableNature.SIMPLE, null,
                "Components", null, RecordStatus.ACTIVE, inventorySku, new BigDecimal("1"), null),
                actorId, Instant.now());
    }

    /** The same input, carrying an authored highlight sequence. */
    /** The same input, carrying a promotion price and its window. */
    private ChannelListingCommandService.ChannelListingInput withPromotion(
            ChannelListingCommandService.ChannelListingInput base, String promotionPrice,
            Instant startsAt, Instant endsAt) {
        return new ChannelListingCommandService.ChannelListingInput(base.channelInstance(),
                base.externalListingId(), base.channelSku(), base.mappedSellableSku(),
                base.intendedTitle(), base.intendedDescription(), base.salePrice(),
                promotionPrice == null ? null : new BigDecimal(promotionPrice), startsAt, endsAt,
                base.publishedMarketplaceStock(), base.publicationIntent(),
                base.intendedChannelCategory(), base.intendedChannelCategoryRef(),
                base.highlights(),
                base.intendedTitleBn(), base.intendedDescriptionBn(), base.highlightsBn(),
                base.packageWeightKg(), base.packageLengthCm(), base.packageWidthCm(),
                base.packageHeightCm(), base.packageContent(), null);
    }

    private ChannelListingCommandService.ChannelListingInput withHighlights(
            ChannelListingCommandService.ChannelListingInput base, List<String> highlights) {
        return new ChannelListingCommandService.ChannelListingInput(base.channelInstance(),
                base.externalListingId(), base.channelSku(), base.mappedSellableSku(),
                base.intendedTitle(), base.intendedDescription(), base.salePrice(),
                base.promotionPrice(), base.promotionStartsAt(), base.promotionEndsAt(),
                base.publishedMarketplaceStock(), base.publicationIntent(),
                base.intendedChannelCategory(), base.intendedChannelCategoryRef(), highlights,
                base.intendedTitleBn(), base.intendedDescriptionBn(), base.highlightsBn(),
                base.packageWeightKg(), base.packageLengthCm(), base.packageWidthCm(),
                base.packageHeightCm(), base.packageContent(), null);
    }

    /** The same input, carrying the package publishing facts, {@code PRD-201}. */
    private ChannelListingCommandService.ChannelListingInput withPackage(
            ChannelListingCommandService.ChannelListingInput base, String weightKg,
            String lengthCm, String widthCm, String heightCm, String content) {
        return new ChannelListingCommandService.ChannelListingInput(base.channelInstance(),
                base.externalListingId(), base.channelSku(), base.mappedSellableSku(),
                base.intendedTitle(), base.intendedDescription(), base.salePrice(),
                base.promotionPrice(), base.promotionStartsAt(), base.promotionEndsAt(),
                base.publishedMarketplaceStock(), base.publicationIntent(),
                base.intendedChannelCategory(), base.intendedChannelCategoryRef(),
                base.highlights(), base.intendedTitleBn(), base.intendedDescriptionBn(),
                base.highlightsBn(),
                weightKg == null ? null : new BigDecimal(weightKg),
                lengthCm == null ? null : new BigDecimal(lengthCm),
                widthCm == null ? null : new BigDecimal(widthCm),
                heightCm == null ? null : new BigDecimal(heightCm), content, null);
    }

    /** The same input, carrying the Bangla overrides, {@code PRD-202}. */
    private ChannelListingCommandService.ChannelListingInput withBangla(
            ChannelListingCommandService.ChannelListingInput base, String titleBn,
            String descriptionBn, List<String> highlightsBn) {
        return new ChannelListingCommandService.ChannelListingInput(base.channelInstance(),
                base.externalListingId(), base.channelSku(), base.mappedSellableSku(),
                base.intendedTitle(), base.intendedDescription(), base.salePrice(),
                base.promotionPrice(), base.promotionStartsAt(), base.promotionEndsAt(),
                base.publishedMarketplaceStock(), base.publicationIntent(),
                base.intendedChannelCategory(), base.intendedChannelCategoryRef(),
                base.highlights(), titleBn, descriptionBn, highlightsBn,
                base.packageWeightKg(), base.packageLengthCm(), base.packageWidthCm(),
                base.packageHeightCm(), base.packageContent(), null);
    }

    private ChannelListingCommandService.ChannelListingInput listing(String channel, String external,
                                                                    String sku) {
        return new ChannelListingCommandService.ChannelListingInput(channel, external, null, sku,
                "Listing " + external, "Description " + external, new BigDecimal("32500.00"),
                // ⚠ PRD-199.b - no promotion by default. The window is meaningless without one.
                null, null, null,
                new BigDecimal("12"), "PUBLISH", null, null, null, null, null, null, null, null, null, null, null, null);
    }

    /** The same input, carrying a Seller / Channel SKU for the orderable unit. */
    private ChannelListingCommandService.ChannelListingInput withChannelSku(
            ChannelListingCommandService.ChannelListingInput base, String channelSku) {
        return new ChannelListingCommandService.ChannelListingInput(base.channelInstance(),
                base.externalListingId(), channelSku, base.mappedSellableSku(),
                base.intendedTitle(), base.intendedDescription(), base.salePrice(),
                base.promotionPrice(), base.promotionStartsAt(), base.promotionEndsAt(),
                base.publishedMarketplaceStock(), base.publicationIntent(),
                base.intendedChannelCategory(), base.intendedChannelCategoryRef(),
                base.highlights(), base.intendedTitleBn(), base.intendedDescriptionBn(),
                base.highlightsBn(), base.packageWeightKg(), base.packageLengthCm(),
                base.packageWidthCm(), base.packageHeightCm(), base.packageContent(), null);
    }

    // =================================================================================
    // Identity and mapping
    // =================================================================================

    /**
     * 🔴 {@code PRD-179.a} — a suggestion comes from DETERMINISTIC evidence: the channel's
     * Seller SKU and a Sellable SKU are the same identifier, which two systems already agree
     * on. {@code PRD-179.d} — the basis is stated in words and no confidence score exists.
     */
    @Test
    @DisplayName("PRD-179.a an exact Seller SKU match is offered as advisory evidence")
    void exactSellerSkuIsSuggested() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW,
                ProductPermissions.SELLABLE_PRODUCT_MANAGE, ProductPermissions.SELLABLE_PRODUCT_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(withChannelSku(listing("DARAZ-A", "88231", null), "SEL-1"));
        UUID skuId = queries.detail(id).skus().getFirst().id();

        assertThat(queries.mappingSuggestions(skuId)).singleElement().satisfies(s -> {
            assertThat(s.sellableSku()).isEqualTo("SEL-1");
            assertThat(s.basis()).isEqualTo("Exact seller SKU match");
            assertThat(s.exact()).isTrue();
        });
    }

    /**
     * 🔴 {@code PRD-179.b} — NO FUZZY MATCH IS EVER OFFERED AS EVIDENCE. A near-identical
     * name on a catalogue where two products differ by a graphics card and several thousand
     * taka is precisely the wrong thing to put in front of someone about to confirm.
     */
    @Test
    @DisplayName("PRD-179.b a similar name produces no suggestion at all")
    void similarNamesAreNeverSuggested() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW,
                ProductPermissions.SELLABLE_PRODUCT_MANAGE, ProductPermissions.SELLABLE_PRODUCT_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        // ⚠ A Seller SKU that merely RESEMBLES the Sellable SKU. Resemblance is not evidence.
        UUID id = commands.create(withChannelSku(listing("DARAZ-A", "88231", null), "SEL-1-BLACK"));
        UUID skuId = queries.detail(id).skus().getFirst().id();

        assertThat(queries.mappingSuggestions(skuId)).isEmpty();
    }

    /** ⚠ No Seller SKU is no evidence — an ordinary empty answer, never a failure. */
    @Test
    @DisplayName("PRD-179 a SKU with no Seller SKU yields no suggestions")
    void noSellerSkuYieldsNoSuggestions() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW,
                ProductPermissions.SELLABLE_PRODUCT_MANAGE, ProductPermissions.SELLABLE_PRODUCT_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(listing("DARAZ-A", "88231", null));
        UUID skuId = queries.detail(id).skus().getFirst().id();

        assertThat(queries.mappingSuggestions(skuId)).isEmpty();
    }

    /** 🔴 {@code PRD-179.b} — asking for advice must never CHANGE the mapping. */
    @Test
    @DisplayName("PRD-179.b reading suggestions maps nothing")
    void readingSuggestionsMapsNothing() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW,
                ProductPermissions.SELLABLE_PRODUCT_MANAGE, ProductPermissions.SELLABLE_PRODUCT_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(withChannelSku(listing("DARAZ-A", "88231", null), "SEL-1"));
        UUID skuId = queries.detail(id).skus().getFirst().id();

        assertThat(queries.mappingSuggestions(skuId)).hasSize(1);

        // 🔴 Still UNMAPPED afterwards. Only an explicit mapSku changes that.
        assertThat(queries.detail(id).mappingState()).isEqualTo(MappingState.UNMAPPED);
        assertThat(queries.detail(id).mappedSkuCount()).isZero();
    }

    /**
     * 🔴 RATIFIED — the Seller / Channel SKU is a purely LOCAL label until the marketplace
     * issues the listing an identity. Correcting a typo in a draft is an ordinary edit.
     */
    @Test
    @DisplayName("Seller SKU is editable while the Listing has no remote identity")
    void sellerSkuIsEditableBeforeRemoteIdentity() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        // ⚠ No external id: the channel has never accepted this listing.
        UUID id = commands.create(withChannelSku(listing("DARAZ-A", null, "SEL-1"), "SLR-TYPO"));
        commands.update(id, withChannelSku(listing("DARAZ-A", null, "SEL-1"), "SLR-CORRECTED"),
                queries.detail(id).version());

        assertThat(queries.detail(id).skus().getFirst().channelSku()).isEqualTo("SLR-CORRECTED");
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM channel_listing_activity
                WHERE channel_listing_id = ? AND field_key = 'channel_sku'
                """, Long.class, id)).isEqualTo(1L);
    }

    /**
     * 🔴 RATIFIED — once the marketplace has issued an identity the Seller SKU is how the
     * channel and the ERP agree WHICH orderable unit is which. Renaming it would silently
     * re-point a live unit, so it is refused; changing it requires a relist.
     */
    @Test
    @DisplayName("Seller SKU is immutable once the Listing has remote identity")
    void sellerSkuIsImmutableAfterRemoteIdentity() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(withChannelSku(listing("DARAZ-A", "88231", "SEL-1"), "SLR-LIVE"));

        assertThatThrownBy(() -> commands.update(id,
                withChannelSku(listing("DARAZ-A", "88231", "SEL-1"), "SLR-RENAMED"),
                queries.detail(id).version()))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("requires a relist");

        // ⚠ Nothing was half-written: the live unit still carries its own identifier.
        assertThat(queries.detail(id).skus().getFirst().channelSku()).isEqualTo("SLR-LIVE");
    }

    /**
     * ⚠ AN UNCHANGED SELLER SKU IS NOT A CHANGE. Edit round-trips the value it loaded, so a
     * published listing must be able to save its other fields without tripping the rule.
     */
    @Test
    @DisplayName("Resending the same Seller SKU on a published Listing is not a change")
    void resendingTheSameSellerSkuIsNotAChange() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(withChannelSku(listing("DARAZ-A", "88231", "SEL-1"), "SLR-LIVE"));
        var edited = withChannelSku(listing("DARAZ-A", "88231", "SEL-1"), "SLR-LIVE");
        commands.update(id, edited, queries.detail(id).version());

        assertThat(queries.detail(id).skus().getFirst().channelSku()).isEqualTo("SLR-LIVE");
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM channel_listing_activity
                WHERE channel_listing_id = ? AND field_key = 'channel_sku'
                """, Long.class, id)).isZero();
    }

    @Test
    @DisplayName("E-059 creates a Listing against one registered Channel Instance and one Sellable Product")
    void createsListingAgainstRegisteredChannelAndSellable() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));
        ChannelListingView view = queries.detail(id);

        assertThat(view.channelInstance()).isEqualTo("DARAZ-A");
        assertThat(view.externalListingId()).isEqualTo("88231");
        assertThat(view.mappedSellableSku()).isEqualTo("SEL-1");
        assertThat(view.salePrice()).isEqualTo("32500.00");
        // ⚠ PRD-199.b - no promotion by default, so the effective price IS the Sale Price.
        assertThat(view.promotionPrice()).isNull();
        assertThat(view.effectiveSellingPrice()).isEqualTo("32500.00");
        assertThat(view.listingStock()).isEqualTo("12");
        assertThat(view.mappingState()).isEqualTo(MappingState.MAPPED);
    }

    @Test
    @DisplayName("external listing id is unique within its Channel Instance, not globally")
    void externalIdUniqueWithinChannelInstanceOnly() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        channel("DARAZ-B");
        simple("SEL-1", "INV-1");

        commands.create(listing("DARAZ-A", "88231", "SEL-1"));
        commands.create(listing("DARAZ-B", "88231", "SEL-1"));

        assertThatThrownBy(() -> commands.create(listing("DARAZ-A", "88231", "SEL-1")))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("already exists");
    }

    /**
     * 🔴 {@code PRD-178} — the rule the V5 schema structurally forbade. An unmapped Listing is
     * a first-class state that must be creatable, storable and VISIBLE in the workspace.
     */
    @Test
    @DisplayName("PRD-178 an UNMAPPED Listing is a legitimate state, not a validation failure")
    void unmappedListingIsALegitimateState() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");

        UUID id = commands.create(new ChannelListingCommandService.ChannelListingInput(
                "DARAZ-A", "99001", "CH-SKU-1", null, "Discovered listing", null,
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null));

        ChannelListingView view = queries.detail(id);
        assertThat(view.mappingState()).isEqualTo(MappingState.UNMAPPED);
        assertThat(view.mappedSellableSku()).isNull();
        assertThat(view.skuCount()).isEqualTo(1);
        assertThat(view.mappedSkuCount()).isZero();

        // It must also be reachable through the workspace, which is the part V5 broke.
        assertThat(queries.list(ChannelListingFilter.none(), PageRequest.of(0, 10)).getContent())
                .extracting(ChannelListingView::id)
                .contains(id);
        assertThat(queries.summary(ChannelListingFilter.none()).unmappedListings()).isEqualTo(1);
    }

    /**
     * 🔴 {@code PRD-188.b} — a channel cannot have issued an identifier for a listing that
     * does not exist there yet. Demanding one would force the operator to invent it.
     */
    @Test
    @DisplayName("PRD-188.b an ERP-first draft may exist with no external listing id")
    void erpFirstDraftNeedsNoExternalIdentifier() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(new ChannelListingCommandService.ChannelListingInput(
                "DARAZ-A", null, null, "SEL-1", "Not published yet", null,
                new BigDecimal("100.00"), null, null, null, new BigDecimal("5"),
                null, null, null, null, null, null, null, null, null, null, null, null, null));

        ChannelListingView view = queries.detail(id);
        assertThat(view.externalListingId()).isNull();
        assertThat(view.localLifecycle().name()).isEqualTo("DRAFT");
    }

    /** 🔴 {@code PRD-179.c} — an unresolvable SKU never silently creates a Sellable Product. */
    @Test
    @DisplayName("PRD-179.c mapping to an unknown Sellable SKU is refused, never auto-created")
    void mappingNeverInventsASellableProduct() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE);
        channel("DARAZ-A");

        assertThatThrownBy(() -> commands.create(listing("DARAZ-A", "88231", "DOES-NOT-EXIST")))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("must resolve explicitly");

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM sellable_product", Long.class)).isZero();
    }

    // =================================================================================
    // Save is not push
    // =================================================================================

    /**
     * 🔴 {@code PRD-185} — the single most important boundary in the feature. A local save
     * changes intent, derives the unsent-change condition, and contacts nothing.
     */
    @Test
    @DisplayName("PRD-185 a local save changes intent, records no operation and contacts no channel")
    void localSaveIsNeverAPush() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));

        commands.update(id, new ChannelListingCommandService.ChannelListingInput(
                "DARAZ-A", "88231", null, null, "Edited title", "Edited description",
                new BigDecimal("31000.00"), null, null, null, new BigDecimal("12"),
                "PUBLISH", null, null, null, null, null, null, null, null, null, null, null, null), null);

        ChannelListingView view = queries.detail(id);
        assertThat(view.intendedTitle()).isEqualTo("Edited title");
        assertThat(view.hasUnsentLocalChanges()).isTrue();
        // 🔴 The unsent condition is NOT the sync state: PENDING means an attempt is owed to
        // the counterparty, which a purely local edit is not (PRD-185.d).
        assertThat(view.syncState()).isEqualTo(SyncState.PENDING);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM channel_listing_operation", Long.class))
                .isZero();
    }

    /**
     * 🔴 {@code INV-106.3} / {@code PRD-029} — for a SINGLE-SKU listing the listing-level
     * price and the orderable unit's price are the same fact.
     *
     * <p>⚠ The workspace reads the price from the SKUs. If a listing-level edit did not reach
     * the single SKU, the operator would be shown a price they never typed.
     */
    @Test
    @DisplayName("INV-106.3 a listing-level price edit reaches the single orderable SKU")
    void singleSkuListingPriceEditReachesTheSku() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));

        commands.update(id, new ChannelListingCommandService.ChannelListingInput(
                "DARAZ-A", "88231", null, null, "Listing 88231", "Description 88231",
                new BigDecimal("31000.00"), null, null, null, new BigDecimal("9"),
                "PUBLISH", null, null, null, null, null, null, null, null, null, null, null, null), null);

        ChannelListingView view = queries.detail(id);
        assertThat(view.salePrice()).isEqualTo("31000.00");
        assertThat(view.listingStock()).isEqualTo("9");
        assertThat(view.skus()).singleElement()
                .satisfies(sku -> {
                    assertThat(sku.salePrice()).isEqualTo("31000.00");
                    assertThat(sku.listingStock()).isEqualTo("9");
                });
    }

    /** 🔴 {@code PRJ-043} — a scale-only difference is not an edit. */
    @Test
    @DisplayName("PRJ-043 re-saving 32500.00 as 32500 records no price change")
    void scaleOnlyDifferenceIsNotAnEdit() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));
        jdbc.update("DELETE FROM channel_listing_activity");

        commands.update(id, new ChannelListingCommandService.ChannelListingInput(
                "DARAZ-A", "88231", null, null, "Listing 88231", "Description 88231",
                new BigDecimal("32500"), null, null, null, new BigDecimal("12"),
                "PUBLISH", null, null, null, null, null, null, null, null, null, null, null, null), null);

        Long priceChanges = jdbc.queryForObject("""
                SELECT COUNT(*) FROM channel_listing_activity
                WHERE channel_listing_id = ? AND field_key = ?
                """, Long.class, id, ListingFieldKey.SALE_PRICE);
        assertThat(priceChanges).isZero();
    }

    // =================================================================================
    // Intended vs reported
    // =================================================================================

    /**
     * 🔴 {@code SYS-034} / {@code API-063.c} — a value the adapter could not read is NOT an
     * empty value, and there is nothing to accept.
     */
    @Test
    @DisplayName("SYS-034 an unreadable reported value cannot be accepted as the marketplace value")
    void unreadableReportedValueCannotBeAccepted() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));

        assertThatThrownBy(() -> commands.acceptMarketplaceValue(id, ListingFieldKey.TITLE))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("not readable");
    }

    /**
     * 🔴 {@code PRD-183} — accepting adopts the reported value as intent and settles the
     * divergence, without inventing a remote operation.
     */
    @Test
    @DisplayName("PRD-183 accepting a readable reported value adopts it as intent")
    void acceptingAReadableReportedValueAdoptsIt() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));
        jdbc.update("""
                UPDATE channel_listing
                SET channel_reported_title = 'Channel title', reported_title_readable = TRUE
                WHERE id = ?
                """, id);

        commands.acceptMarketplaceValue(id, ListingFieldKey.TITLE);

        ChannelListingView view = queries.detail(id);
        assertThat(view.intendedTitle()).isEqualTo("Channel title");
        // Intent now equals what the channel holds, so the ERP owes it nothing.
        assertThat(view.hasUnsentLocalChanges()).isFalse();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM channel_listing_operation", Long.class))
                .isZero();
    }

    // =================================================================================
    // Authority
    // =================================================================================

    @Test
    @DisplayName("Administrator role receives no implicit Listing authority")
    void administratorRoleReceivesNoImplicitListingAuthority() {
        actingWith();
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        assertThatThrownBy(() -> queries.list(ChannelListingFilter.none(), PageRequest.of(0, 10)))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(ProductPermissions.CHANNEL_LISTING_VIEW);
    }

    /**
     * 🔴 {@code PRD-196.a} — MANAGE NEVER IMPLIES PUBLISH. An operator who may edit intent is
     * not thereby authorised to change what customers see.
     */
    @Test
    @DisplayName("PRD-196.a manage does not imply publish")
    void manageDoesNotImplyPublish() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));

        assertThatThrownBy(() -> operations.request(OperationKind.PUSH_UPDATE, List.of(id), "test"))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(ProductPermissions.CHANNEL_LISTING_PUBLISH);
    }

    /** 🔴 {@code PRD-196.a} — an inbound act needs sync authority, not manage. */
    @Test
    @DisplayName("PRD-196.a refresh requires sync authority")
    void refreshRequiresSyncAuthority() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));

        assertThatThrownBy(() -> operations.request(OperationKind.REFRESH, List.of(id), "test"))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(ProductPermissions.CHANNEL_LISTING_SYNC);
    }

    // =================================================================================
    // The honest adapter boundary
    // =================================================================================

    /**
     * 🔴 No adapter ships in this release. The operation must report that truthfully as
     * {@code MANUAL_REQUIRED} ({@code SYS-025}) rather than simulating remote success — a
     * false SUCCEEDED here is a lie the operator could never detect.
     */
    @Test
    @DisplayName("with no registered adapter a push settles MANUAL_REQUIRED, never SUCCEEDED")
    void absentAdapterIsReportedHonestly() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW,
                ProductPermissions.CHANNEL_LISTING_PUBLISH);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));

        UUID batchId = operations.request(OperationKind.PUSH_UPDATE, List.of(id), "test push");

        ListingViews.BatchView batch = operations.batch(batchId);
        assertThat(batch.requested()).isEqualTo(1);
        assertThat(batch.succeeded()).isZero();
        assertThat(batch.manualRequired()).isEqualTo(1);

        List<ListingViews.OperationView> forListing = operations.operationsFor(id);
        assertThat(forListing).hasSize(1);
        assertThat(forListing.getFirst().outcome()).isEqualTo(OperationOutcome.MANUAL_REQUIRED);
        // 🔴 The reason must say plainly that nothing was sent. A generic failure string
        // would leave the operator unable to tell "not attempted" from "attempted and lost".
        assertThat(forListing.getFirst().detail())
                .contains("No marketplace adapter is configured")
                .contains("was not sent");
        // MANUAL_REQUIRED is a NORMAL state, not a failure (SYS-025), and it is never
        // retried automatically (PRD-186.d).
        assertThat(forListing.getFirst().retryable()).isFalse();

        // 🔴 Nothing was sent, so the unsent-change condition must still stand.
        assertThat(queries.detail(id).syncState()).isEqualTo(SyncState.MANUAL_REQUIRED);
    }

    /** 🔴 {@code PRD-186.d} — {@code MANUAL_REQUIRED} members are never swept into a retry. */
    @Test
    @DisplayName("PRD-186.d retry refuses a batch whose members all need manual attention")
    void retryExcludesManualRequiredMembers() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW,
                ProductPermissions.CHANNEL_LISTING_PUBLISH);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));
        UUID batchId = operations.request(OperationKind.PUSH_UPDATE, List.of(id), "test push");

        assertThatThrownBy(() -> operations.retryFailed(batchId))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("must be resolved first");
    }

    // =================================================================================
    // Summary and CSV
    // =================================================================================

    /**
     * The five ratified summary facts, counted by the DATABASE over the filtered set.
     *
     * <p>🔴 {@code UX-037.g} — no count whose basis is undefined is exposed, which is why
     * there is deliberately no last-sync or non-active tile.
     */
    @Test
    @DisplayName("Listing summary reports the five ratified facts over the filtered set")
    void summaryReportsTheFiveRatifiedFacts() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID mapped = commands.create(listing("DARAZ-A", "88231", "SEL-1"));
        commands.create(new ChannelListingCommandService.ChannelListingInput(
                "DARAZ-A", "88232", "CH-SKU-2", null, "Unmapped", null,
                null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null));
        jdbc.update("UPDATE channel_listing SET sync_state = 'DIVERGED' WHERE id = ?", mapped);

        ChannelListingSummary summary = queries.summary(ChannelListingFilter.none());

        assertThat(summary.totalListings()).isEqualTo(2);
        assertThat(summary.unmappedListings()).isEqualTo(1);
        assertThat(summary.divergedListings()).isEqualTo(1);
        // Both were just created with intent and never pushed.
        assertThat(summary.unsentChangeListings()).isEqualTo(2);
        assertThat(summary.manualRequiredListings()).isZero();
    }

    @Test
    @DisplayName("CSV refuses channel-owned read-only facts instead of silently importing them")
    void csvRefusesReadOnlyChannelFacts() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        ChannelListingCsvService.ImportPlan plan = csv.validate(String.join("\n",
                String.join(",", ChannelListingCsvService.HEADERS),
                ",DARAZ-A,88231,,SEL-1,Title,Description,32500.00,,,,12,PUBLISH,,Reported title,,,,"));

        assertThat(plan.errorCount()).isEqualTo(1);
        assertThat(plan.outcomes().getFirst().field()).isEqualTo("channel_reported_title");
    }

    /**
     * 🔴 {@code PRD-195.b} / {@code PRD-195.c} — a spreadsheet may create a Listing that is
     * not yet published and not yet mapped. Requiring either would make CSV import unusable
     * for exactly the case it exists to serve.
     */
    @Test
    @DisplayName("PRD-195.b CSV accepts a row with neither an external id nor a mapping")
    void csvAcceptsUnpublishedUnmappedRow() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE);
        channel("DARAZ-A");

        ChannelListingCsvService.ImportPlan plan = csv.validate(String.join("\n",
                String.join(",", ChannelListingCsvService.HEADERS),
                ",DARAZ-A,,,,New listing,,,,,,,,,,,,,"));

        assertThat(plan.errorCount()).isZero();
        assertThat(plan.validCount()).isEqualTo(1);
    }

    // =================================================================================
    // PRD-199 - Sale Price and the optional, time-bounded promotion
    // =================================================================================

    /** ✅ {@code PRD-199.a}/{@code .b} - both are editable ERP intent, and both persist. */
    @Test
    @DisplayName("PRD-199 the Sale Price and the promotion are stored per orderable SKU")
    void bothPricesAreEditableAndStoredPerSku() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(withPromotion(listing("DARAZ-A", "88231", "SEL-1"),
                "29900.00", STARTS, ENDS));

        ChannelListingView view = queries.detail(id);
        assertThat(view.salePrice()).isEqualTo("32500.00");
        assertThat(view.promotionPrice()).isEqualTo("29900.00");
        assertThat(view.promotionStartsAt()).isEqualTo(STARTS);
        assertThat(view.promotionEndsAt()).isEqualTo(ENDS);
        // 🔴 INV-106.3 - the authoritative figures live on the orderable SKU.
        assertThat(view.skus()).singleElement().satisfies(sku -> {
            assertThat(sku.salePrice()).isEqualTo("32500.00");
            assertThat(sku.promotionPrice()).isEqualTo("29900.00");
        });
    }

    /**
     * 🔴 {@code PRD-199.d} - THE EFFECTIVE PRICE IS DERIVED FROM THE CLOCK.
     *
     * <p>⚠ Nothing stores "the current price". A window that has not opened is not in force,
     * and a window that has closed is over - both cases fall back to the base Sale Price
     * without any job having to run.
     */
    @Test
    @DisplayName("PRD-199.d the effective price follows the window, and is never stored")
    void effectivePriceFollowsTheWindow() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        // A window spanning now: the promotion is what a customer pays.
        UUID active = commands.create(withPromotion(listing("DARAZ-A", "88231", "SEL-1"),
                "29900.00", STARTS, ENDS));
        assertThat(queries.detail(active).effectiveSellingPrice()).isEqualTo("29900.00");
        assertThat(queries.detail(active).promotionActive()).isTrue();

        // A window that has NOT OPENED: the base price, and the promotion is not active.
        UUID scheduled = commands.create(withPromotion(listing("DARAZ-A", "88232", "SEL-1"),
                "29900.00", FUTURE_STARTS, FUTURE_ENDS));
        assertThat(queries.detail(scheduled).effectiveSellingPrice()).isEqualTo("32500.00");
        assertThat(queries.detail(scheduled).promotionActive()).isFalse();
        // ⚠ The promotion is still STORED - it is scheduled, not discarded.
        assertThat(queries.detail(scheduled).promotionPrice()).isEqualTo("29900.00");

        // A window that has CLOSED: back to the base price, with nothing to undo.
        UUID expired = commands.create(withPromotion(listing("DARAZ-A", "88233", "SEL-1"),
                "29900.00", PAST_STARTS, PAST_ENDS));
        assertThat(queries.detail(expired).effectiveSellingPrice()).isEqualTo("32500.00");
        assertThat(queries.detail(expired).promotionActive()).isFalse();

        // 🔴 DB-001 - no column holds any of this.
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns "
                + "WHERE table_name = 'channel_listing' AND column_name LIKE '%effective%'",
                Long.class)).isZero();
    }

    /** ✅ {@code PRD-199.e} - equality is VALID and simply means no reduction is offered. */
    @Test
    @DisplayName("PRD-199.e a promotion equal to the Sale Price is valid - no reduction offered")
    void equalPricesAreValid() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(withPromotion(listing("DARAZ-A", "88231", "SEL-1"),
                "32500.00", STARTS, ENDS));

        ChannelListingView view = queries.detail(id);
        assertThat(view.salePrice()).isEqualTo("32500.00");
        assertThat(view.promotionPrice()).isEqualTo("32500.00");
    }

    /**
     * 🔴 {@code PRD-199.e} - refused with a stated reason.
     *
     * <p>⚠ The values are NEVER silently swapped: a swap would publish a price the operator
     * did not choose.
     */
    @Test
    @DisplayName("PRD-199.e a promotion above the Sale Price is refused and never swapped")
    void promotionAboveSalePriceIsRefused() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        assertThatThrownBy(() -> commands.create(withPromotion(
                listing("DARAZ-A", "88231", "SEL-1"), "40000.00", STARTS, ENDS)))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("cannot be above the Sale Price");

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM channel_listing", Long.class)).isZero();
    }

    /**
     * 🔴 {@code PRD-199.c} - a promotion price REQUIRES both bounds, ordered.
     *
     * <p>⚠ Without a window it would be a permanent second price, which is precisely the
     * ambiguity this model removes.
     */
    @Test
    @DisplayName("PRD-199.c a promotion needs both window bounds, and the end must be later")
    void promotionWindowIsRequiredAndOrdered() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        assertThatThrownBy(() -> commands.create(withPromotion(
                listing("DARAZ-A", "88231", "SEL-1"), "29900.00", null, null)))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("both Promotion Starts and Promotion Ends");

        assertThatThrownBy(() -> commands.create(withPromotion(
                listing("DARAZ-A", "88231", "SEL-1"), "29900.00", STARTS, STARTS)))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("later than Promotion Starts");

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM channel_listing", Long.class)).isZero();
    }

    /** 🔴 {@code PRJ-043} - scale must not decide the comparison. */
    @Test
    @DisplayName("PRJ-043 a promotion of 1200 against a Sale Price of 1200.00 is equality")
    void scaleDoesNotDecideThePriceComparison() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(new ChannelListingCommandService.ChannelListingInput(
                "DARAZ-A", "88231", null, "SEL-1", "Scale", null,
                new BigDecimal("1200.00"), new BigDecimal("1200"), STARTS, ENDS,
                new BigDecimal("4"), "PUBLISH", null, null, null, null, null, null, null, null, null, null, null, null));
        // ⚠ The column is numeric(19,2), so the stored value comes back at that scale. The
        // point of this test is that 1200 vs 1200.00 was accepted as EQUALITY, not refused.
        assertThat(queries.detail(id).promotionPrice()).isEqualTo("1200.00");
        assertThat(queries.detail(id).salePrice()).isEqualTo("1200.00");
    }

    /**
     * 🔴 {@code PRD-199.k} - a historical MRP is RETAINED and never reinterpreted.
     *
     * <p>⚠ It is not migrated into the promotion price. A person entered it as a reference
     * price; asserting it as a promotion would manufacture an offer nobody scheduled.
     */
    @Test
    @DisplayName("PRD-199.k a retained MRP is never read back as a promotion price")
    void retainedMrpIsNeverReinterpreted() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));

        // A row carrying the superseded reference price, exactly as V7 left it.
        jdbc.update("UPDATE channel_listing SET mrp = 34000.00 WHERE id = ?", id);

        ChannelListingView view = queries.detail(id);
        assertThat(view.promotionPrice()).isNull();
        assertThat(view.effectiveSellingPrice()).isEqualTo("32500.00");
        // ✅ The column and its value are still there - retired, not destroyed.
        assertThat(jdbc.queryForObject("SELECT mrp FROM channel_listing WHERE id = ?",
                BigDecimal.class, id)).isEqualByComparingTo("34000.00");
    }

    /** 🔴 {@code PRD-199.g} / {@code SYS-034} - an unreadable reported value is not zero. */
    @Test
    @DisplayName("PRD-199.g an unreadable reported promotion never becomes zero or 'no promotion'")
    void unreadableReportedPricesNeverBecomeZero() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));

        ChannelListingView view = queries.detail(id);
        assertThat(view.reportedSalePriceReadable()).isFalse();
        assertThat(view.reportedSalePrice()).isNull();
        assertThat(view.reportedPromotionPriceReadable()).isFalse();
        assertThat(view.reportedPromotionPrice()).isNull();
        assertThat(view.reportedPromotionWindowReadable()).isFalse();

        // 🔴 None can be accepted, because there is nothing to accept.
        for (String field : List.of(ListingFieldKey.PROMOTION_PRICE,
                ListingFieldKey.PROMOTION_WINDOW, ListingFieldKey.SALE_PRICE)) {
            assertThatThrownBy(() -> commands.acceptMarketplaceValue(id, field))
                    .isInstanceOf(ChannelListingValidationException.class)
                    .hasMessageContaining("not readable");
        }
    }

    /**
     * 🔴 {@code PRD-199.g} - inbound readback writes the REPORTED side only.
     *
     * <p>The intended values are untouched, which is what makes the divergence detectable.
     */
    @Test
    @DisplayName("PRD-199.g reported prices are independent of intended prices")
    void reportedPricesAreIndependentOfIntended() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(withPromotion(listing("DARAZ-A", "88231", "SEL-1"),
                "29900.00", STARTS, ENDS));
        jdbc.update("""
                UPDATE channel_listing
                SET reported_sale_price = 31000.00, reported_sale_price_readable = TRUE,
                    reported_promotion_price = 28000.00, reported_promotion_price_readable = TRUE
                WHERE id = ?
                """, id);

        ChannelListingView view = queries.detail(id);
        assertThat(view.salePrice()).isEqualTo("32500.00");
        assertThat(view.promotionPrice()).isEqualTo("29900.00");
        assertThat(view.reportedSalePrice()).isEqualTo("31000.00");
        assertThat(view.reportedPromotionPrice()).isEqualTo("28000.00");
        // Two independent divergences, counted separately.
        assertThat(view.divergedFactCount()).isEqualTo(2);
    }

    /** 🔴 {@code PRD-199.j} - separate field-level history entries, never one merged fact. */
    @Test
    @DisplayName("PRD-199.j price and window changes are recorded as separate facts")
    void priceChangesAreRecordedSeparately() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));
        jdbc.update("DELETE FROM channel_listing_activity");

        commands.update(id, new ChannelListingCommandService.ChannelListingInput(
                "DARAZ-A", "88231", null, null, "Listing 88231", "Description 88231",
                new BigDecimal("31500.00"), new BigDecimal("29000.00"), STARTS, ENDS,
                new BigDecimal("12"), "PUBLISH", null, null, null, null, null, null, null, null, null, null, null, null), null);

        for (String field : List.of(ListingFieldKey.SALE_PRICE, ListingFieldKey.PROMOTION_PRICE,
                ListingFieldKey.PROMOTION_WINDOW)) {
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM channel_listing_activity "
                    + "WHERE channel_listing_id = ? AND field_key = ?", Long.class, id, field))
                    .as(field).isEqualTo(1);
        }
    }

    /** 🔴 {@code PRD-199.h} - the price and the promotion are separately declarable. */
    @Test
    @DisplayName("PRD-199.f/h the promotion fields are declarable and 'mrp' is not a field key")
    void pricesAreIndependentCapabilityFields() {
        assertThat(ListingFieldKey.all()).contains(ListingFieldKey.SALE_PRICE,
                ListingFieldKey.PROMOTION_PRICE, ListingFieldKey.PROMOTION_WINDOW);
        assertThat(ListingFieldKey.PROMOTION_PRICE).isNotEqualTo(ListingFieldKey.SALE_PRICE);
        assertThat(ListingFieldKey.isKnown("price")).isFalse();
        // 🔴 PRD-199.f - MRP is not a Channel Listing price, so it is not declarable.
        assertThat(ListingFieldKey.isKnown("mrp")).isFalse();
    }

    /** 🔴 {@code PRD-199.e} — CSV refuses the same violation, against its own row number. */
    @Test
    @DisplayName("PRD-199.e CSV rejects a row whose promotion is above its Sale Price")
    void csvRejectsPromotionAboveSalePrice() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE);
        channel("DARAZ-A");

        ChannelListingCsvService.ImportPlan plan = csv.validate(String.join("\n",
                String.join(",", ChannelListingCsvService.HEADERS),
                // Sale Price 1200, promotion 1400 - a "promotion" that costs more.
                ",DARAZ-A,88231,,,Backwards,,1200.00,1400.00,2026-08-20T00:00:00Z,2026-08-31T23:59:00Z,4,PUBLISH,,,,,,"));

        assertThat(plan.errorCount()).isEqualTo(1);
        assertThat(plan.outcomes().getFirst().field()).isEqualTo("promotion_price");
    }

    /** ✅ {@code PRD-197.f} — the documented CSV compatibility alias. */
    @Test
    @DisplayName("PRD-197.f the legacy channel_price CSV column imports as Sale Price")
    void csvLegacyPriceColumnMapsToSalePrice() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE);
        channel("DARAZ-A");

        ChannelListingCsvService.ImportPlan plan = csv.validate(String.join("\n",
                "channel_instance,intended_title,channel_price",
                "DARAZ-A,Legacy priced listing,1200.00"));

        assertThat(plan.errorCount()).isZero();
        assertThat(plan.validCount()).isEqualTo(1);
    }

    /** 🔴 {@code PRD-197.f} — supplying both names is a refusal, not a precedence puzzle. */
    @Test
    @DisplayName("PRD-197.f supplying both channel_price and sale_price is refused")
    void csvRefusesBothPriceColumnNames() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE);
        channel("DARAZ-A");

        ChannelListingCsvService.ImportPlan plan = csv.validate(String.join("\n",
                "channel_instance,intended_title,channel_price,sale_price",
                "DARAZ-A,Ambiguous,1200.00,1300.00"));

        assertThat(plan.errorCount()).isEqualTo(1);
        assertThat(plan.outcomes().getFirst().field()).isEqualTo("channel_price");
    }

    // =================================================================================
    // UX-044 — the server-side selection scope
    // =================================================================================

    /**
     * 🔴 {@code UX-044} — the per-channel breakdown is AGGREGATED BY THE DATABASE over the
     * same predicate that produced the selection, so the figures always sum to the total
     * beside them.
     */
    @Test
    @DisplayName("UX-044 the selection scope reports a per-channel count that sums to the total")
    void selectionScopeAggregatesPerChannelCounts() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        channel("DARAZ-B");
        simple("SEL-1", "INV-1");
        commands.create(listing("DARAZ-A", "88231", "SEL-1"));
        commands.create(listing("DARAZ-A", "88232", "SEL-1"));
        commands.create(listing("DARAZ-B", "88233", "SEL-1"));

        ChannelListingQueryService.SelectionScope scope =
                queries.selectionScope(ChannelListingFilter.none());

        assertThat(scope.listingIds()).hasSize(3);
        assertThat(scope.byChannel()).hasSize(2);
        assertThat(scope.byChannel())
                .extracting(ChannelListingQueryService.ChannelSelectionCount::channelName)
                .containsExactly("Channel DARAZ-A", "Channel DARAZ-B");
        assertThat(scope.byChannel())
                .extracting(ChannelListingQueryService.ChannelSelectionCount::selected)
                .containsExactly(2L, 1L);
        // 🔴 The breakdown sums to the selection it describes.
        assertThat(scope.byChannel().stream()
                .mapToLong(ChannelListingQueryService.ChannelSelectionCount::selected).sum())
                .isEqualTo(scope.listingIds().size());
        // The retained name list stays exactly the breakdown's names, in the same order.
        assertThat(scope.channelNames())
                .containsExactlyElementsOf(scope.byChannel().stream()
                        .map(ChannelListingQueryService.ChannelSelectionCount::channelName).toList());
    }

    /**
     * 🔴 The breakdown answers the SAME filter the selection was captured against — never the
     * whole corpus. A count taken from a different scope would let an operator act on
     * Listings they never chose.
     */
    @Test
    @DisplayName("UX-044 the per-channel breakdown honours the captured filter, not the corpus")
    void selectionScopeBreakdownHonoursTheFilter() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        channel("DARAZ-B");
        simple("SEL-1", "INV-1");
        commands.create(listing("DARAZ-A", "88231", "SEL-1"));
        commands.create(listing("DARAZ-A", "88232", "SEL-1"));
        commands.create(listing("DARAZ-B", "88233", "SEL-1"));

        ChannelListingQueryService.SelectionScope scoped = queries.selectionScope(
                new ChannelListingFilter(null, "DARAZ-B", null, null, null, null, null, null, false, false));

        assertThat(scoped.listingIds()).hasSize(1);
        assertThat(scoped.byChannel()).singleElement().satisfies(row -> {
            assertThat(row.channelName()).isEqualTo("Channel DARAZ-B");
            assertThat(row.selected()).isEqualTo(1L);
        });
        // 🔴 The excluded channel does not appear at all.
        assertThat(scoped.byChannel())
                .extracting(ChannelListingQueryService.ChannelSelectionCount::channelName)
                .doesNotContain("Channel DARAZ-A");
    }

    /** 🔴 The selection scope is a VIEW read and is refused without view authority. */
    @Test
    @DisplayName("UX-044 the selection scope requires view authority")
    void selectionScopeRequiresViewAuthority() {
        actingWith();
        assertThatThrownBy(() -> queries.selectionScope(ChannelListingFilter.none()))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(ProductPermissions.CHANNEL_LISTING_VIEW);
    }

    // =================================================================================
    // Intended versus reported - PRD-181, PRD-183
    // =================================================================================

    /**
     * 🔴 {@code PRD-183.d} - media that CAME BACK from the channel still has no reliable
     * ordering basis, so it must not manufacture a divergence. It settles MANUAL_REQUIRED,
     * a normal state ({@code PRD-183.e}), which is neither failure nor agreement.
     */
    @Test
    @DisplayName("PRD-183.d reported media without a reliable basis is MANUAL_REQUIRED, never DIVERGED")
    void reportedMediaWithoutReliableBasisIsManualRequired() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));
        jdbc.update("""
                INSERT INTO channel_listing_reported_media (channel_listing_id, external_reference, position)
                VALUES (?, ?, 0), (?, ?, 1)
                """, id, "https://cdn.example/one.jpg", id, "https://cdn.example/two.jpg");

        var media = queries.comparison(id).stream()
                .filter(r -> r.fieldKey().equals(ListingFieldKey.MEDIA))
                .findFirst()
                .orElseThrow();

        assertThat(media.state()).isEqualTo(ListingViews.ComparisonRow.MANUAL_REQUIRED);
        assertThat(media.state()).isNotEqualTo(ListingViews.ComparisonRow.DIVERGED);
        assertThat(media.reportedReadable()).isTrue();
        assertThat(media.resolvable()).isFalse();
        assertThat(media.reportedValue()).contains("order not reliably readable");
    }

    /**
     * 🔴 {@code SYS-034} - the channel returned NO media references. That is ABSENCE, and it
     * is never rendered as "no images" nor compared against the intended count.
     */
    @Test
    @DisplayName("SYS-034 media the channel never reported is NOT_READABLE, never zero images")
    void mediaTheChannelNeverReportedIsNotReadable() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));

        var media = queries.comparison(id).stream()
                .filter(r -> r.fieldKey().equals(ListingFieldKey.MEDIA))
                .findFirst()
                .orElseThrow();

        assertThat(media.state()).isEqualTo(ListingViews.ComparisonRow.NOT_READABLE);
        assertThat(media.reportedReadable()).isFalse();
        assertThat(media.reportedValue()).isNull();
    }

    /**
     * 🔴 A fact with no trustworthy comparison has nothing to accept. The refusal lives in
     * the BACKEND, not in whether the browser drew a button.
     */
    @Test
    @DisplayName("PRD-183 Accept Marketplace refuses a fact that was never comparably reported")
    void acceptMarketplaceRefusesAnUncomparableFact() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));

        assertThatThrownBy(() -> commands.acceptMarketplaceValue(id, ListingFieldKey.MEDIA))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("is not an acceptable Listing field");
    }

    // =================================================================================
    // Listing highlights - PRD-198
    // =================================================================================

    /**
     * 🔴 {@code PRD-198.b} - the AUTHORED order survives the round trip exactly. It is
     * never re-sorted, alphabetised or inferred from insertion or identifier order.
     */
    @Test
    @DisplayName("PRD-198.b Add Listing stores highlights in the authored order")
    void createStoresHighlightsInTheAuthoredOrder() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(withHighlights(listing("DARAZ-A", "88231", "SEL-1"),
                List.of("Zulu last", "Alpha first", "Mike middle")));

        assertThat(queries.detail(id).highlights())
                .containsExactly("Zulu last", "Alpha first", "Mike middle");
        assertThat(queries.detail(id).highlightsAreFallback()).isFalse();
    }

    /** ⚠ {@code PRD-198.d} - highlights are OPTIONAL. A Listing with none is ordinary. */
    @Test
    @DisplayName("PRD-198.d a Listing created with no highlights is complete, not incomplete")
    void createWithoutHighlightsIsValid() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));

        assertThat(queries.detail(id).highlights()).isEmpty();
        // PRD-198.c - no own set means the effective set FALLS BACK; it is never materialised.
        assertThat(queries.detail(id).highlightsAreFallback()).isTrue();
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM channel_listing_highlight", Long.class)).isZero();
    }

    /** 🔴 Reordering is a real edit: the new sequence replaces the old one exactly. */
    @Test
    @DisplayName("PRD-198.d Edit Listing may add, edit, remove and reorder highlights")
    void updateReplacesTheOrderedSet() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(withHighlights(listing("DARAZ-A", "88231", "SEL-1"),
                List.of("One", "Two", "Three")));

        commands.update(id, withHighlights(listing("DARAZ-A", "88231", "SEL-1"),
                List.of("Three", "One edited")), null);

        assertThat(queries.detail(id).highlights()).containsExactly("Three", "One edited");
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM channel_listing_highlight", Long.class)).isEqualTo(2L);
    }

    /**
     * 🔴 {@code PRD-198.c} - an EMPTY list CLEARS the override, so the master fallback
     * resumes. That is a different instruction from saying nothing, and the two are never
     * conflated.
     */
    @Test
    @DisplayName("PRD-198.c an empty list clears the override; an absent one changes nothing")
    void emptyClearsAndNullLeavesAlone() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(withHighlights(listing("DARAZ-A", "88231", "SEL-1"),
                List.of("Kept", "Also kept")));

        // Saying nothing about highlights must never delete authored copy.
        commands.update(id, listing("DARAZ-A", "88231", "SEL-1"), null);
        assertThat(queries.detail(id).highlights()).containsExactly("Kept", "Also kept");

        commands.update(id, withHighlights(listing("DARAZ-A", "88231", "SEL-1"), List.of()), null);
        assertThat(queries.detail(id).highlights()).isEmpty();
        assertThat(queries.detail(id).highlightsAreFallback()).isTrue();
    }

    /** ⚠ A blank highlight is not content. It is refused rather than silently dropped. */
    @Test
    @DisplayName("PRD-198 a blank highlight is refused, not quietly discarded")
    void blankHighlightIsRefused() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        assertThatThrownBy(() -> commands.create(withHighlights(
                listing("DARAZ-A", "88231", "SEL-1"), List.of("Real", "   "))))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("cannot be blank");

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM channel_listing", Long.class)).isZero();
    }

    /** 🔴 Authoring listing content is a MANAGE act, exactly like every other local save. */
    @Test
    @DisplayName("PRD-196.a authoring highlights requires manage authority")
    void highlightsRequireManageAuthority() {
        actingWith(ProductPermissions.CHANNEL_LISTING_VIEW);
        assertThatThrownBy(() -> commands.create(withHighlights(
                listing("DARAZ-A", "88231", "SEL-1"), List.of("Nope"))))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(ProductPermissions.CHANNEL_LISTING_MANAGE);
    }

    // =================================================================================
    // PRD-201 - package publishing facts
    // =================================================================================

    /**
     * 🔴 {@code PRD-201.b}/{@code .c} - the package facts are LOCAL publishing intent,
     * authorable with no adapter, and they land on the ORDERABLE SKU.
     */
    @Test
    @DisplayName("PRD-201.c the package facts persist on the orderable channel SKU")
    void packageFactsPersistOnTheOrderableSku() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(withPackage(listing("DARAZ-A", "88231", "SEL-1"),
                "1.250", "40", "30", "12.500", "1 x monitor, 1 x power cable"));

        assertThat(queries.detail(id).skus()).singleElement().satisfies(sku -> {
            // ⚠ `decimal()` normalises trailing zeros, exactly as it already does for
            //   listing stock. The COLUMN is numeric(19,3); the RENDERING is plain.
            assertThat(sku.packageWeightKg()).isEqualTo("1.25");
            assertThat(sku.packageLengthCm()).isEqualTo("40");
            assertThat(sku.packageWidthCm()).isEqualTo("30");
            assertThat(sku.packageHeightCm()).isEqualTo("12.5");
            assertThat(sku.packageContent()).isEqualTo("1 x monitor, 1 x power cable");
        });
    }

    /** 🔴 {@code PRD-201.f} - ABSENT is fine; ZERO is a claim and is refused. */
    @Test
    @DisplayName("PRD-201.f an unset package fact is absent, and a zero one is refused")
    void packageFactsAreAbsentNeverZero() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        // Nothing entered: every fact is NULL, and that is a complete, ordinary listing.
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));
        assertThat(queries.detail(id).skus()).singleElement().satisfies(sku -> {
            assertThat(sku.packageWeightKg()).isNull();
            assertThat(sku.packageContent()).isNull();
        });

        assertThatThrownBy(() -> commands.create(withPackage(
                listing("DARAZ-A", "88232", "SEL-1"), "0", null, null, null, null)))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("greater than zero");
    }

    /**
     * 🔴 {@code PRD-201.c} - a parcel is measured when someone measures it, which is very
     * often AFTER the listing was created. An update that read the package facts and wrote
     * nothing would silently discard the measurement.
     */
    @Test
    @DisplayName("PRD-201.c editing a Listing persists the package facts on its orderable SKU")
    void editingPersistsPackageFacts() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));
        assertThat(queries.detail(id).skus().getFirst().packageWeightKg()).isNull();

        commands.update(id, withPackage(listing("DARAZ-A", null, "SEL-1"),
                "1.250", "40", "30", "12.500", "1 x monitor, 1 x power cable"),
                queries.detail(id).version());

        assertThat(queries.detail(id).skus()).singleElement().satisfies(sku -> {
            assertThat(sku.packageWeightKg()).isEqualTo("1.25");
            assertThat(sku.packageHeightCm()).isEqualTo("12.5");
            assertThat(sku.packageContent()).isEqualTo("1 x monitor, 1 x power cable");
        });

        // 🔴 PRJ-091 / PRD-129 - the edit is recorded where it happened, as ONE parcel fact.
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM channel_listing_activity
                WHERE channel_listing_id = ? AND field_key = 'package'
                """, Long.class, id)).isEqualTo(1L);
    }

    /**
     * 🔴 {@code INV-106.2} - on a VARIATION listing the commercial figures belong to each
     * orderable unit. There is no single listing-level answer, so a listing-level edit must
     * not overwrite one arbitrary interpretation of it.
     */
    @Test
    @DisplayName("INV-106.2 a listing-level commercial edit is ignored on a multi-SKU Listing")
    void listingLevelCommercialEditIsIgnoredOnAVariationListing() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));
        // A second orderable unit, as discovery would report for a variation listing.
        jdbc.update("""
                INSERT INTO channel_listing_sku
                    (id, channel_listing_id, channel_sku, sale_price,
                     published_marketplace_stock, position, created_by, updated_by)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?)
                """, UUID.randomUUID(), id, "SLR-WHT", new BigDecimal("34900.00"),
                new BigDecimal("4"), actorId, actorId);

        String titleBefore = queries.detail(id).intendedTitle();
        assertThat(titleBefore).isNotNull();

        ChannelListingCommandService.ChannelListingInput edit =
                new ChannelListingCommandService.ChannelListingInput("DARAZ-A", null, null, null,
                        "A new listing-wide title", "Description 88231", new BigDecimal("1.00"),
                        null, null, null, new BigDecimal("999"), "PUBLISH", null, null, null,
                        null, null, null, null, null, null, null, null, null);
        commands.update(id, edit, queries.detail(id).version());

        var after = queries.detail(id);
        // ⚠ The listing-WIDE content is edited normally; only the per-unit figures are refused.
        assertThat(after.intendedTitle()).isEqualTo("A new listing-wide title");
        // 🔴 Neither orderable unit was repriced, and neither was restocked, by an edit that
        //    could not have known which unit it meant.
        assertThat(after.skus()).extracting("salePrice")
                .containsExactly("32500.00", "34900.00");
        assertThat(after.skus()).extracting("listingStock").containsExactly("12", "4");
    }

    /** 🔴 {@code PRD-201.d} / {@code INV-106.4} - never derived from Inventory. */
    @Test
    @DisplayName("PRD-201.d package facts are independent of any Inventory quantity")
    void packageFactsAreIndependentOfInventory() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(withPackage(listing("DARAZ-A", "88231", "SEL-1"),
                "2.000", null, null, null, null));

        // ⚠ The listing stock is 12 and the parcel weighs 2 kg. Neither figure derives from
        //   the other, and neither derives from a warehouse position.
        assertThat(queries.detail(id).listingStock()).isEqualTo("12");
        assertThat(queries.detail(id).skus().getFirst().packageWeightKg()).isEqualTo("2");
    }

    // =================================================================================
    // PRD-202 - English and Bangla
    // =================================================================================

    /**
     * 🔴 {@code PRD-202.c}/{@code .d} - the EFFECTIVE Bangla is DERIVED, and the English
     * value is NEVER copied into Bangla storage to implement it.
     */
    @Test
    @DisplayName("PRD-202.d a blank Bangla override falls back without being materialised")
    void blankBanglaFallsBackWithoutCopying() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));

        ChannelListingView view = queries.detail(id);
        // The override is genuinely absent...
        assertThat(view.intendedTitleBn()).isNull();
        assertThat(view.intendedDescriptionBn()).isNull();
        // ...and the effective Bangla is the English content, derived at read time.
        assertThat(view.effectiveTitleBn()).isEqualTo(view.intendedTitle());
        assertThat(view.effectiveDescriptionBn()).isEqualTo(view.intendedDescription());
        // 🔴 PRD-202.d - NOTHING was written to the Bangla columns.
        assertThat(jdbc.queryForObject(
                "SELECT COUNT(*) FROM channel_listing WHERE intended_title_bn IS NOT NULL",
                Long.class)).isZero();
    }

    /** ✅ {@code PRD-202.b} - an explicit override wins, and English is untouched. */
    @Test
    @DisplayName("PRD-202.b an explicit Bangla override replaces the fallback")
    void explicitBanglaOverridesTheFallback() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(withBangla(listing("DARAZ-A", "88231", "SEL-1"),
                "\u09ac\u09be\u0982\u09b2\u09be \u09b6\u09bf\u09b0\u09cb\u09a8\u09be\u09ae", null, null));

        ChannelListingView view = queries.detail(id);
        assertThat(view.effectiveTitleBn()).isEqualTo("\u09ac\u09be\u0982\u09b2\u09be \u09b6\u09bf\u09b0\u09cb\u09a8\u09be\u09ae");
        // 🔴 PRD-202.g - one-directional. The English title is unchanged.
        assertThat(view.intendedTitle()).isEqualTo("Listing 88231");
        // The description had no override, so it still falls back.
        assertThat(view.effectiveDescriptionBn()).isEqualTo(view.intendedDescription());
    }

    /** ⚠ {@code PRD-202.e} - whitespace is not content, so a blank override falls back. */
    @Test
    @DisplayName("PRD-202.e a whitespace-only Bangla override is treated as absent")
    void whitespaceBanglaIsAbsent() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        UUID id = commands.create(withBangla(listing("DARAZ-A", "88231", "SEL-1"),
                "   ", null, null));

        ChannelListingView view = queries.detail(id);
        assertThat(view.intendedTitleBn()).isNull();
        assertThat(view.effectiveTitleBn()).isEqualTo("Listing 88231");
    }

    /**
     * 🔴 {@code PRD-202.f} - the highlight sets fall back ALL-OR-NOTHING, with no per-line
     * merge, and each language keeps its own authored order.
     */
    @Test
    @DisplayName("PRD-202.f Bangla highlights fall back as a whole set, never merged")
    void banglaHighlightsFallBackAsAWholeSet() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");

        // English only: the effective Bangla set IS the English set.
        UUID english = commands.create(withHighlights(listing("DARAZ-A", "88231", "SEL-1"),
                List.of("One", "Two", "Three")));
        ChannelListingView first = queries.detail(english);
        assertThat(first.highlightsBn()).isEmpty();
        assertThat(first.effectiveHighlightsBn()).containsExactly("One", "Two", "Three");
        assertThat(first.highlightsBnAreFallback()).isTrue();

        // A Bangla set of its own replaces the WHOLE set, in its own order.
        UUID both = commands.create(withBangla(
                withHighlights(listing("DARAZ-A", "88232", "SEL-1"), List.of("One", "Two", "Three")),
                null, null, List.of("\u098f\u0995", "\u09a6\u09c1\u0987")));
        ChannelListingView second = queries.detail(both);
        assertThat(second.highlights()).containsExactly("One", "Two", "Three");
        assertThat(second.effectiveHighlightsBn()).containsExactly("\u098f\u0995", "\u09a6\u09c1\u0987");
        assertThat(second.highlightsBnAreFallback()).isFalse();
        // ⚠ Two entries, not five: the sets never merge.
        assertThat(second.effectiveHighlightsBn()).hasSize(2);
    }

    /** 🔴 {@code PRD-202.a} - content written before V10 IS the English content. */
    @Test
    @DisplayName("PRD-202.a existing listing content survives V10 as English content")
    void existingContentSurvivesAsEnglish() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(withHighlights(listing("DARAZ-A", "88231", "SEL-1"),
                List.of("Pre-existing highlight")));

        // Every highlight row written by the ordinary path is EN, exactly as V10's backfill
        // asserted for the rows that were already on disk.
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM channel_listing_highlight "
                + "WHERE channel_listing_id = ? AND language = 'EN'", Long.class, id)).isEqualTo(1L);
        assertThat(queries.detail(id).highlights()).containsExactly("Pre-existing highlight");
    }

    /** 🔴 The comparison is a VIEW read and is refused without view authority. */
    @Test
    @DisplayName("PRD-181 the comparison requires view authority")
    void comparisonRequiresViewAuthority() {
        actingWith(ProductPermissions.CHANNEL_LISTING_MANAGE, ProductPermissions.CHANNEL_LISTING_VIEW);
        channel("DARAZ-A");
        simple("SEL-1", "INV-1");
        UUID id = commands.create(listing("DARAZ-A", "88231", "SEL-1"));

        actingWith();
        assertThatThrownBy(() -> queries.comparison(id))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(ProductPermissions.CHANNEL_LISTING_VIEW);
    }
}
