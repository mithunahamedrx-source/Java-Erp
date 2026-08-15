package com.trioloo.erp.product.application;

import com.trioloo.erp.access.AccessFixtures;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SellableNature;
import com.trioloo.erp.product.domain.SerializationPolicy;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * FRAME 15 — the outbound review boundary.
 *
 * <p>🔴 THE CLAIM UNDER TEST is that reviewing is not sending. Composing a review must leave
 * the Listing, its operations, its activity and its derived unsent condition exactly as they
 * were, and a confirmation must refuse — recording NOTHING — whenever the reviewed version is
 * stale, a blocking preflight stands, or no adapter exists to send through.
 */
@SpringBootTest
class PushReviewTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private StockItemCommandService stockItems;
    @Autowired private SellableProductCommandService sellables;
    @Autowired private ChannelListingCommandService commands;
    @Autowired private PushReviewService reviews;

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
        actorId = fixtures.createProfile("p15-tester", "irrelevant", AccountLifecycleState.ACTIVE);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clearProductData();
    }

    // =================================================================================
    // Permission
    // =================================================================================

    /**
     * 🔴 {@code PRD-196.a} — MANAGE NEVER IMPLIES PUBLISH. An operator who may edit intent
     * cannot even OPEN the outbound review, because the review exists to authorise an act
     * they are not permitted to perform.
     */
    @Test
    @DisplayName("PRD-196.a manage and view alone cannot reach the outbound review")
    void reviewRequiresPublish() {
        actingWith(ProductPermissions.CHANNEL_LISTING_VIEW, ProductPermissions.CHANNEL_LISTING_MANAGE);
        UUID id = seedListing("88231");

        assertThatThrownBy(() -> reviews.review(id))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(ProductPermissions.CHANNEL_LISTING_PUBLISH);
        assertThatThrownBy(() -> reviews.confirm(id, null))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(ProductPermissions.CHANNEL_LISTING_PUBLISH);
    }

    /** 🔴 Sync authority is inbound and confers nothing outbound either. */
    @Test
    @DisplayName("PRD-196.a sync does not imply publish")
    void syncDoesNotImplyPublish() {
        actingAsPublisher();
        UUID id = seedListing("88232");
        // ⚠ Seeding needs MANAGE; the ACT under test is performed as sync-only.
        actingWith(ProductPermissions.CHANNEL_LISTING_VIEW, ProductPermissions.CHANNEL_LISTING_SYNC);

        assertThatThrownBy(() -> reviews.review(id))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(ProductPermissions.CHANNEL_LISTING_PUBLISH);
    }

    // =================================================================================
    // Mode
    // =================================================================================

    /**
     * 🔴 {@code PRD-171} — a remote identity exists, so the act would UPDATE that exact
     * listing and the neutral command is {@code PUSH_UPDATE}.
     */
    @Test
    @DisplayName("an existing remote identity produces EXISTING_UPDATE")
    void existingIdentityIsAnUpdate() {
        actingAsPublisher();
        UUID id = seedListing("DRZ-87720113");

        PushReviewView review = reviews.review(id);

        assertThat(review.mode()).isEqualTo(PushReviewView.EXISTING_UPDATE);
        assertThat(review.externalListingId()).isEqualTo("DRZ-87720113");
    }

    /**
     * 🔴 {@code PRD-188.b} / {@code §39.10.k} — a listing the channel has never accepted has
     * NO identifier. The review must report null rather than substituting the Seller SKU, the
     * local UUID or any invented value.
     */
    @Test
    @DisplayName("PRD-188.b no remote identity produces FIRST_PUBLICATION and invents no id")
    void absentIdentityIsAFirstPublication() {
        actingAsPublisher();
        UUID id = seedListing(null);

        PushReviewView review = reviews.review(id);

        assertThat(review.mode()).isEqualTo(PushReviewView.FIRST_PUBLICATION);
        assertThat(review.externalListingId()).isNull();
    }

    // =================================================================================
    // Reviewing changes nothing
    // =================================================================================

    /**
     * 🔴 §74 / §89 — THE CENTRAL CLAIM. Composing a review records no operation, writes no
     * activity, and leaves the derived unsent condition and the last-push timestamp exactly
     * as they were.
     */
    @Test
    @DisplayName("composing a review records no operation, no activity and clears no UNSENT")
    void reviewingRecordsNothing() {
        actingAsPublisher();
        UUID id = seedListing("88240");
        long operationsBefore = count("channel_listing_operation");
        long activityBefore = count("channel_listing_activity");
        long batchesBefore = count("channel_listing_operation_batch");

        PushReviewView review = reviews.review(id);
        reviews.review(id);

        assertThat(review.unsentLocalChanges()).isTrue();
        assertThat(count("channel_listing_operation")).isEqualTo(operationsBefore);
        assertThat(count("channel_listing_activity")).isEqualTo(activityBefore);
        assertThat(count("channel_listing_operation_batch")).isEqualTo(batchesBefore);
        // 🔴 The unsent condition is DERIVED and untouched: nothing was successfully pushed.
        assertThat(jdbc.queryForObject(
                "SELECT last_successful_push_at FROM channel_listing WHERE id = ?",
                Instant.class, id)).isNull();
        assertThat(reviews.review(id).unsentLocalChanges()).isTrue();
    }

    // =================================================================================
    // Preflight
    // =================================================================================

    /**
     * 🔴 §38 — the four dimensions are reported SEPARATELY. ⚠ With no adapter the marketplace
     * dimension reports that it CANNOT be evaluated; it never reports "passed", because a
     * category nothing checked is not a category that was accepted.
     */
    @Test
    @DisplayName("preflight reports four separate dimensions and never claims schema validation passed")
    void preflightKeepsDimensionsApart() {
        actingAsPublisher();
        UUID id = seedListing("88241");

        PushReviewView review = reviews.review(id);

        assertThat(review.preflight()).extracting(PushReviewView.PreflightItem::dimension)
                .contains(PushReviewView.PreflightItem.LOCAL_VALIDATION,
                        PushReviewView.PreflightItem.MAPPING,
                        PushReviewView.PreflightItem.ADAPTER_CAPABILITY,
                        PushReviewView.PreflightItem.MARKETPLACE_SCHEMA);
        assertThat(review.preflight().stream()
                .filter(i -> PushReviewView.PreflightItem.MARKETPLACE_SCHEMA.equals(i.dimension()))
                .map(PushReviewView.PreflightItem::text))
                .anySatisfy(text -> assertThat(text).contains("cannot be completed"));
    }

    /**
     * 🔴 §72 — the ONLY blocking item in this environment is the real one: there is no
     * adapter. ⚠ §39 — a blank optional field is a recommendation, never a blocker.
     */
    @Test
    @DisplayName("the absent adapter is the blocker; blank optional fields are not")
    void absentAdapterIsTheOnlyBlocker() {
        actingAsPublisher();
        UUID id = seedListing("88242");

        PushReviewView review = reviews.review(id);

        assertThat(review.preflight().stream().filter(PushReviewView.PreflightItem::blocking))
                .singleElement()
                .satisfies(item -> {
                    assertThat(item.dimension())
                            .isEqualTo(PushReviewView.PreflightItem.ADAPTER_CAPABILITY);
                    assertThat(item.text()).contains("No writable marketplace adapter");
                });
        assertThat(review.executable()).isFalse();
        assertThat(review.executionBlockedReason()).contains("No writable marketplace adapter");
    }

    /**
     * 🔴 {@code PRD-178} — UNMAPPED IS A VALID STATE. Mapping is REPORTED, and is never
     * invented as an outbound blocker beyond what canon states.
     */
    @Test
    @DisplayName("PRD-178 an unmapped Listing still reviews, with mapping reported not blocked")
    void unmappedIsReportedNotBlocked() {
        actingAsPublisher();
        UUID id = seedUnmappedListing("88243");

        PushReviewView review = reviews.review(id);

        assertThat(review.mappedSkuCount()).isZero();
        assertThat(review.preflight().stream()
                .filter(i -> PushReviewView.PreflightItem.MAPPING.equals(i.dimension())))
                .isNotEmpty()
                .allSatisfy(item -> assertThat(item.blocking()).isFalse());
    }

    // =================================================================================
    // Confirmation
    // =================================================================================

    /**
     * 🔴 §43 / §55 / §85 — with no adapter the confirmation REFUSES, and refuses BEFORE
     * anything is recorded. A batch, operation or activity row created here would describe an
     * attempt that never happened.
     */
    @Test
    @DisplayName("with no adapter the confirmation refuses and records nothing at all")
    void confirmationRefusesAndRecordsNothing() {
        actingAsPublisher();
        UUID id = seedListing("88244");
        PushReviewView review = reviews.review(id);
        long operationsBefore = count("channel_listing_operation");
        long batchesBefore = count("channel_listing_operation_batch");
        long activityBefore = count("channel_listing_activity");

        assertThatThrownBy(() -> reviews.confirm(id, review.reviewVersion()))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("No writable marketplace adapter");

        assertThat(count("channel_listing_operation")).isEqualTo(operationsBefore);
        assertThat(count("channel_listing_operation_batch")).isEqualTo(batchesBefore);
        assertThat(count("channel_listing_activity")).isEqualTo(activityBefore);
        // 🔴 No external identifier was invented and no push timestamp was fabricated.
        assertThat(jdbc.queryForObject(
                "SELECT last_successful_push_at FROM channel_listing WHERE id = ?",
                Instant.class, id)).isNull();
        assertThat(reviews.review(id).unsentLocalChanges()).isTrue();
    }

    /**
     * 🔴 §57 / §88 — A STALE REVIEW IS REFUSED BEFORE DISPATCH. The operator approved one
     * persisted revision; if the Listing moved on, what they read is not what would be sent.
     *
     * <p>⚠ The version guard is checked BEFORE the adapter guard, so this proves the stale
     * refusal on its own terms rather than incidentally through the absent adapter.
     */
    @Test
    @DisplayName("§57 a review taken at version N is refused after the Listing becomes N+1")
    void staleReviewIsRefusedBeforeDispatch() {
        actingAsPublisher();
        UUID id = seedListing("88245");
        PushReviewView atN = reviews.review(id);

        // A controlled, ordinary local edit — exactly what a colleague saving would produce.
        commands.update(id, retitled("88245", "Retitled after the review was opened"), null);
        PushReviewView atNext = reviews.review(id);
        assertThat(atNext.reviewVersion()).isGreaterThan(atN.reviewVersion());

        long operationsBefore = count("channel_listing_operation");
        assertThatThrownBy(() -> reviews.confirm(id, atN.reviewVersion()))
                .isInstanceOf(ChannelListingValidationException.class)
                .hasMessageContaining("changed after the review was opened");

        // 🔴 Nothing was attempted. The refusal happened before any dispatch.
        assertThat(count("channel_listing_operation")).isEqualTo(operationsBefore);
    }

    // =================================================================================
    // Per-unit truth
    // =================================================================================

    /**
     * 🔴 {@code UX-271.d} / {@code INV-106.2} — every per-SKU fact in the review comes from
     * its OWN orderable unit. No cell is filled from the parent Listing.
     */
    @Test
    @DisplayName("UX-271.d per-SKU facts come from the SKU, never from the parent Listing")
    void perSkuFactsStayPerSku() {
        actingAsPublisher();
        UUID id = seedListing("88246");
        UUID skuId = jdbc.queryForObject(
                "SELECT id FROM channel_listing_sku WHERE channel_listing_id = ?", UUID.class, id);
        jdbc.update("""
                UPDATE channel_listing_sku
                SET sale_price = 45900.00, published_marketplace_stock = 6,
                    package_weight_kg = 9.400, variation_label = '43 inch'
                WHERE id = ?
                """, skuId);

        PushReviewView review = reviews.review(id);

        assertThat(review.skus()).singleElement().satisfies(sku -> {
            // ⚠ The parent Listing carries 32500.00 / 12 — neither appears on the unit.
            assertThat(sku.salePrice()).isEqualTo("45900.00");
            assertThat(sku.listingStock()).isEqualTo("6");
            // ⚠ A PARCEL WEIGHT IS A QUANTITY, NOT MONEY. `DB-079`'s trailing-zero
            //   obligation is a monetary rule; 9.400 kg and 9.4 kg are the same mass.
            assertThat(sku.packageWeightKg()).isEqualTo("9.4");
            assertThat(sku.variationLabel()).isEqualTo("43 inch");
        });
    }

    // =================================================================================
    // §83 — one readiness truth
    // =================================================================================

    /**
     * 🔴 §83 — LOCAL PREFLIGHT MAY NOT CONTRADICT WHAT SAVE ALREADY ACCEPTED. A Listing the
     * ERP agreed to persist cannot become locally invalid merely because the operator asked
     * to review it; anything stricter here would be a second, disagreeing engine.
     */
    @Test
    @DisplayName("§83 a saved Listing carries no local-validation blocker")
    void localPreflightAgreesWithSave() {
        actingAsPublisher();
        UUID id = seedListing("88247");

        PushReviewView review = reviews.review(id);

        assertThat(review.preflight().stream()
                .filter(i -> PushReviewView.PreflightItem.LOCAL_VALIDATION.equals(i.dimension()))
                .filter(PushReviewView.PreflightItem::blocking))
                .isEmpty();
    }

    // =================================================================================
    // Fixtures
    // =================================================================================

    private UUID seedListing(String externalId) {
        channel();
        simple("SEL-1", "INV-1");
        return commands.create(listingInput(externalId, "SEL-1"));
    }

    private UUID seedUnmappedListing(String externalId) {
        channel();
        return commands.create(listingInput(externalId, null));
    }

    private ChannelListingCommandService.ChannelListingInput listingInput(String externalId,
                                                                         String sellableSku) {
        return new ChannelListingCommandService.ChannelListingInput("DARAZ-A", externalId, null,
                sellableSku, "Listing " + externalId, "Description", new BigDecimal("32500.00"),
                null, null, null, new BigDecimal("12"), "PUBLISH",
                null, null, null, null, null, null, null, null, null, null, null, null);
    }

    /** ⚠ The same input with a different intended title — an ordinary local save. */
    private ChannelListingCommandService.ChannelListingInput retitled(String externalId,
                                                                     String title) {
        ChannelListingCommandService.ChannelListingInput base = listingInput(externalId, "SEL-1");
        return new ChannelListingCommandService.ChannelListingInput(base.channelInstance(),
                base.externalListingId(), base.channelSku(), base.mappedSellableSku(),
                title, base.intendedDescription(), base.salePrice(), base.promotionPrice(),
                base.promotionStartsAt(), base.promotionEndsAt(),
                base.publishedMarketplaceStock(), base.publicationIntent(),
                null, null, null, null, null, null, null, null, null, null, null, null);
    }

    private void channel() {
        jdbc.update("""
                INSERT INTO channel_instance (id, code, name, channel_type)
                VALUES (?, 'DARAZ-A', 'Daraz account A', 'DARAZ')
                """, UUID.randomUUID());
    }

    private void simple(String sellableSku, String inventorySku) {
        stockItems.createInternal(new StockItemCommandService.StockItemInput(
                inventorySku, "Component " + inventorySku, "Trioloo", "RAM", "pcs", null,
                SerializationPolicy.NOT_SERIALIZED, "RAM", RecordStatus.ACTIVE),
                actorId, Instant.now());
        sellables.createInternal(new SellableProductCommandService.SellableProductInput(
                sellableSku, "Sellable " + sellableSku, SellableNature.SIMPLE, null,
                "Components", null, RecordStatus.ACTIVE, inventorySku, new BigDecimal("1"), null),
                actorId, Instant.now());
    }

    private long count(String table) {
        Long value = jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
        return value == null ? 0L : value;
    }

    private void actingAsPublisher() {
        actingWith(ProductPermissions.CHANNEL_LISTING_VIEW, ProductPermissions.CHANNEL_LISTING_MANAGE,
                ProductPermissions.CHANNEL_LISTING_PUBLISH);
    }

    private void actingWith(String... permissions) {
        var authorities = java.util.Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList();
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actorId, "p15-tester", "P15 Tester", "unused",
                AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    /** ⚠ Deletion order follows the same dependency chain the Listings suite uses. */
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
}
