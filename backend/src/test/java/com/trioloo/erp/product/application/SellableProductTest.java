package com.trioloo.erp.product.application;

import com.trioloo.erp.access.AccessFixtures;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.product.domain.BuildTemplateStatus;
import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SellableNature;
import com.trioloo.erp.product.domain.SerializationPolicy;
import com.trioloo.erp.product.infrastructure.persistence.SellableProductRepository;
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
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Stage P2 — {@code E-058} Sellable Product, the reusable build definition and bundles.
 *
 * <p>🔴 Runs against the ISOLATED test database only, and seeds NO business data on startup:
 * every record a test needs, that test creates.
 */
@SpringBootTest
class SellableProductTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private SellableProductQueryService queries;
    @Autowired private SellableProductCommandService commands;
    @Autowired private SellableProductCsvService csv;
    @Autowired private StockItemCommandService stockItems;
    @Autowired private SellableProductRepository sellables;

    private AccessFixtures fixtures;
    private UUID actorId;

    @BeforeEach
    void setUp() {
        fixtures = new AccessFixtures(jdbc, passwordEncoder);
        clearProductData();
        fixtures.clear();
        seedProductPermissions();
        actorId = fixtures.createProfile("p2-tester", "irrelevant", AccountLifecycleState.ACTIVE);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clearProductData();
    }

    private void clearProductData() {
        jdbc.update("DELETE FROM bundle_member");
        jdbc.update("DELETE FROM bom_line");
        jdbc.update("DELETE FROM build_template");
        jdbc.update("DELETE FROM sellable_product");
        jdbc.update("DELETE FROM stock_reservation");
        jdbc.update("DELETE FROM inventory_movement");
        jdbc.update("DELETE FROM product_variant");
    }

    /** Authenticates the test actor holding exactly the given capabilities and no others. */
    private void actingWith(String... permissions) {
        var authorities = java.util.Arrays.stream(permissions)
                .map(SimpleGrantedAuthority::new).toList();
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actorId, "p2-tester", "P2 Tester", "unused",
                AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private static final String VIEW = ProductPermissions.SELLABLE_PRODUCT_VIEW;
    private static final String MANAGE = ProductPermissions.SELLABLE_PRODUCT_MANAGE;
    private static final String ACTIVATE = ProductPermissions.BUILD_TEMPLATE_ACTIVATE;

    private void seedProductPermissions() {
        fixtures.createPermission(ProductPermissions.STOCK_ITEM_VIEW);
        fixtures.createPermission(ProductPermissions.STOCK_ITEM_MANAGE);
        fixtures.createPermission(ProductPermissions.SELLABLE_PRODUCT_VIEW);
        fixtures.createPermission(ProductPermissions.SELLABLE_PRODUCT_MANAGE);
        fixtures.createPermission(ProductPermissions.BUILD_TEMPLATE_ACTIVATE);
    }

    // ------------------------------------------------------------------ fixtures

    private UUID stockItem(String sku) {
        return stockItems.createInternal(new StockItemCommandService.StockItemInput(
                sku, "Component " + sku, "Trioloo", "RAM", "pcs", null,
                SerializationPolicy.NOT_SERIALIZED, "RAM", RecordStatus.ACTIVE), actorId, Instant.now());
    }

    private void movement(UUID variantId, BigDecimal quantity) {
        jdbc.update("""
                INSERT INTO inventory_movement (id, product_variant_id, quantity, movement_type,
                    occurred_at, recorded_by, unit_cost)
                VALUES (?, ?, ?, 'GOODS_RECEIPT_ACCEPTED', ?, ?, ?)
                """, UUID.randomUUID(), variantId, quantity, Timestamp.from(Instant.now()), actorId,
                new BigDecimal("100.00"));
    }

    private void reserve(UUID variantId, BigDecimal quantity) {
        jdbc.update("""
                INSERT INTO stock_reservation (id, product_variant_id, quantity, reserved_at, reserved_by)
                VALUES (?, ?, ?, ?, ?)
                """, UUID.randomUUID(), variantId, quantity, Timestamp.from(Instant.now()), actorId);
    }

    private UUID simple(String sku, String targetSku, String perUnit) {
        return commands.createInternal(new SellableProductCommandService.SellableProductInput(
                sku, "Sellable " + sku, SellableNature.SIMPLE, null, "Monitors", null,
                RecordStatus.ACTIVE, targetSku, new BigDecimal(perUnit), null), actorId, Instant.now());
    }

    private UUID assembled(String sku) {
        return assembled(sku, sku + "-FIN");
    }

    private UUID assembled(String sku, String finishedSku) {
        stockItem(finishedSku);
        return commands.createInternal(new SellableProductCommandService.SellableProductInput(
                sku, "Sellable " + sku, SellableNature.ASSEMBLED, null, "Desktops", null,
                RecordStatus.DRAFT, null, null, finishedSku), actorId, Instant.now());
    }

    private UUID bundle(String sku) {
        return commands.createInternal(new SellableProductCommandService.SellableProductInput(
                sku, "Sellable " + sku, SellableNature.BUNDLE, null, "Packages", null,
                RecordStatus.DRAFT, null, null, null), actorId, Instant.now());
    }

    private void activateSingleComponentTemplate(UUID sellableId, String componentSku, String quantityRequired) {
        UUID template = commands.createDraftBuildTemplate(sellableId);
        commands.addBomLine(template, new SellableProductCommandService.BomLineInput(
                componentSku, new BigDecimal(quantityRequired), "Required component", false, null));
        commands.activateBuildTemplate(template);
    }

    // ================================================================= E-058 persistence

    @Test
    @DisplayName("E-058 persists with its three canonical natures and a unique Sellable SKU")
    void persistsAndEnforcesUniqueSku() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");
        simple("SP-1", "INV-1", "1");

        assertThatThrownBy(() -> simple("sp-1", "INV-1", "1"))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    @DisplayName("🔴 INV-58.3 / PRD-070 — nature is IMMUTABLE and an update attempting it is an error")
    void natureIsImmutable() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");
        UUID id = simple("SP-1", "INV-1", "1");

        assertThatThrownBy(() -> commands.update(id, new SellableProductCommandService.SellableProductInput(
                null, null, SellableNature.ASSEMBLED, null, null, null, null, null, null, null), null))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("immutable");

        assertThat(sellables.findById(id).orElseThrow().getNature()).isEqualTo(SellableNature.SIMPLE);
    }

    @Test
    @DisplayName("🔴 The entity exposes no setter for nature at all — immutability is in the type")
    void natureHasNoSetter() {
        assertThat(java.util.Arrays.stream(
                        com.trioloo.erp.product.infrastructure.persistence.SellableProductEntity.class
                                .getMethods())
                .map(java.lang.reflect.Method::getName))
                .doesNotContain("setNature");
    }

    @Test
    @DisplayName("Sellable SKU is immutable on update")
    void sellableSkuIsImmutable() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");
        UUID id = simple("SP-1", "INV-1", "1");

        assertThatThrownBy(() -> commands.update(id, new SellableProductCommandService.SellableProductInput(
                "SP-RENAMED", null, null, null, null, null, null, null, null, null), null))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("immutable");
    }

    @Test
    @DisplayName("Optimistic locking refuses a stale write")
    void optimisticLocking() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");
        UUID id = simple("SP-1", "INV-1", "1");

        assertThatThrownBy(() -> commands.update(id, new SellableProductCommandService.SellableProductInput(
                null, "Renamed", null, null, null, null, null, null, null, null), 99L))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("changed by someone else");
    }

    @Test
    @DisplayName("🔴 INV-58.2 / PRD-021 — only a SIMPLE product may carry a Stock Item mapping")
    void resolutionTargetMustMatchNature() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");

        assertThatThrownBy(() -> commands.create(new SellableProductCommandService.SellableProductInput(
                "SP-BAD", "Bad", SellableNature.ASSEMBLED, null, null, null, RecordStatus.DRAFT,
                "INV-1", new BigDecimal("1"), null)))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("Only a SIMPLE");
    }

    @Test
    @DisplayName("PRD-158 — SIMPLE and BUNDLE may not carry an ASSEMBLED finished mapping")
    void assembledFinishedMappingIsNatureSpecific() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");
        stockItem("PC-FIN");

        assertThatThrownBy(() -> commands.create(new SellableProductCommandService.SellableProductInput(
                "SP-SIMPLE", "Simple", SellableNature.SIMPLE, null, null, null,
                RecordStatus.DRAFT, "INV-1", new BigDecimal("1"), "PC-FIN")))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("PRD-156");

        assertThatThrownBy(() -> commands.create(new SellableProductCommandService.SellableProductInput(
                "SP-BUNDLE", "Bundle", SellableNature.BUNDLE, null, null, null,
                RecordStatus.DRAFT, null, null, "PC-FIN")))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("PRD-156");
    }

    @Test
    @DisplayName("🔴 PRD-056 — a SIMPLE mapping resolves EXPLICITLY; an unknown SKU is refused")
    void simpleMappingMustResolveExplicitly() {
        actingWith(MANAGE, VIEW);

        assertThatThrownBy(() -> simple("SP-1", "DOES-NOT-EXIST", "1"))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("must resolve");
    }

    // ================================================================= SIMPLE availability

    @Test
    @DisplayName("PRD-023 SIMPLE — mapped available ÷ quantity per sale unit, floored")
    void simpleAvailability() {
        actingWith(MANAGE, VIEW);
        UUID variant = stockItem("INV-1");
        movement(variant, new BigDecimal("7"));
        UUID id = simple("SP-1", "INV-1", "2");

        SellableProductView view = queries.detail(id);
        // 7 available ÷ 2 per sale unit = 3 whole sale units. A partial unit cannot be sold.
        assertThat(view.availableSaleUnits()).isEqualByComparingTo("3");
        assertThat(view.simpleTargetInventorySku()).isEqualTo("INV-1");
    }

    @Test
    @DisplayName("🔴 PRD-024 — availability accounts for RESERVATIONS, not merely stock on hand")
    void simpleAvailabilityAccountsForReservations() {
        actingWith(MANAGE, VIEW);
        UUID variant = stockItem("INV-1");
        movement(variant, new BigDecimal("10"));
        reserve(variant, new BigDecimal("6"));
        UUID id = simple("SP-1", "INV-1", "1");

        assertThat(queries.detail(id).availableSaleUnits()).isEqualByComparingTo("4");
    }

    @Test
    @DisplayName("🔴 A Sellable Product duplicates no Stock Item — it holds a reference only")
    void simpleDoesNotDuplicateTheStockItem() {
        actingWith(MANAGE, VIEW);
        UUID variant = stockItem("INV-1");
        simple("SP-1", "INV-1", "1");

        assertThat(jdbc.queryForObject("SELECT count(*) FROM product_variant", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "SELECT simple_target_variant_id FROM sellable_product", UUID.class)).isEqualTo(variant);
    }

    // ================================================================= ASSEMBLED

    @Test
    @DisplayName("PRD-156 — an ASSEMBLED product requires an explicit finished Stock Item mapping")
    void assembledRequiresFinishedVariantMapping() {
        actingWith(MANAGE, VIEW);

        assertThatThrownBy(() -> commands.create(new SellableProductCommandService.SellableProductInput(
                "SP-PC", "PC", SellableNature.ASSEMBLED, null, null, null,
                RecordStatus.DRAFT, null, null, null)))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("PRD-156");
    }

    @Test
    @DisplayName("PRD-156 — the ASSEMBLED finished mapping target must resolve explicitly")
    void assembledFinishedVariantMustExist() {
        actingWith(MANAGE, VIEW);

        assertThatThrownBy(() -> commands.create(new SellableProductCommandService.SellableProductInput(
                "SP-PC", "PC", SellableNature.ASSEMBLED, null, null, null,
                RecordStatus.DRAFT, null, null, "DOES-NOT-EXIST")))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("PRD-156");
    }

    @Test
    @DisplayName("PRD-157 — linking the finished variant creates no stock, movement or reservation")
    void assembledFinishedMappingCreatesNoStock() {
        actingWith(MANAGE, VIEW);
        UUID finished = stockItem("PC-FIN");
        UUID id = commands.createInternal(new SellableProductCommandService.SellableProductInput(
                "SP-PC", "Sellable SP-PC", SellableNature.ASSEMBLED, null, "Desktops", null,
                RecordStatus.DRAFT, null, null, "PC-FIN"), actorId, Instant.now());

        SellableProductView view = queries.detail(id);
        assertThat(view.assembledFinishedVariantId()).isEqualTo(finished);
        assertThat(view.assembledFinishedInventorySku()).isEqualTo("PC-FIN");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_movement", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM stock_reservation", Integer.class)).isZero();
    }

    @Test
    @DisplayName("PRD-161 — ASSEMBLED finished Stock Item identity is immutable on edit")
    void assembledFinishedVariantIsImmutable() {
        actingWith(MANAGE, VIEW);
        stockItem("PC-FIN");
        stockItem("PC-FIN-2");
        UUID id = commands.createInternal(new SellableProductCommandService.SellableProductInput(
                "SP-PC", "Sellable SP-PC", SellableNature.ASSEMBLED, null, "Desktops", null,
                RecordStatus.DRAFT, null, null, "PC-FIN"), actorId, Instant.now());

        commands.update(id, new SellableProductCommandService.SellableProductInput(
                null, "Renamed PC", null, null, null, null, null, null, null, null), null);
        assertThat(queries.detail(id).assembledFinishedInventorySku()).isEqualTo("PC-FIN");

        assertThatThrownBy(() -> commands.update(id, new SellableProductCommandService.SellableProductInput(
                null, null, null, null, null, null, null, null, null, "PC-FIN-2"), null))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("PRD-161");
    }

    @Test
    @DisplayName("PRD-081 — an ASSEMBLED product cannot become ACTIVE without an ACTIVE template")
    void assembledCannotActivateWithoutTemplate() {
        actingWith(MANAGE, VIEW);
        UUID id = assembled("SP-PC");

        assertThatThrownBy(() -> commands.update(id, new SellableProductCommandService.SellableProductInput(
                null, null, null, null, null, null, RecordStatus.ACTIVE, null, null, null), null))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("PRD-081");
    }

    @Test
    @DisplayName("🔴 Availability with no ACTIVE template is NOT DERIVABLE, never zero (SYS-034)")
    void assembledWithoutTemplateIsUnresolvedNotZero() {
        actingWith(MANAGE, VIEW);
        UUID id = assembled("SP-PC");

        SellableProductView view = queries.detail(id);
        assertThat(view.availableSaleUnits()).isNull();
        assertThat(view.availabilityUnresolvedReason()).contains("PRD-081");
    }

    @Test
    @DisplayName("PRD-159 — no movements means ready-built contributes zero")
    void assembledNoMovementsMeansReadyBuiltZero() {
        actingWith(MANAGE, VIEW, ACTIVATE);
        stockItem("CPU-1");
        UUID id = assembled("SP-PC", "PC-FIN");
        activateSingleComponentTemplate(id, "CPU-1", "1");

        assertThat(queries.detail(id).availableSaleUnits()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("PRD-159 — ready-built 3 and buildable 0 yields 3")
    void assembledReadyBuiltOnlyAvailability() {
        actingWith(MANAGE, VIEW, ACTIVATE);
        UUID finished = stockItem("PC-FIN");
        stockItem("CPU-1");
        movement(finished, new BigDecimal("3"));
        UUID id = commands.createInternal(new SellableProductCommandService.SellableProductInput(
                "SP-PC", "Sellable SP-PC", SellableNature.ASSEMBLED, null, "Desktops", null,
                RecordStatus.DRAFT, null, null, "PC-FIN"), actorId, Instant.now());
        activateSingleComponentTemplate(id, "CPU-1", "1");

        assertThat(queries.detail(id).availableSaleUnits()).isEqualByComparingTo("3");
    }

    @Test
    @DisplayName("PRD-159 — ready-built 0 and buildable 4 yields 4")
    void assembledBuildableOnlyAvailability() {
        actingWith(MANAGE, VIEW, ACTIVATE);
        UUID component = stockItem("CPU-1");
        movement(component, new BigDecimal("4"));
        UUID id = assembled("SP-PC", "PC-FIN");
        activateSingleComponentTemplate(id, "CPU-1", "1");

        assertThat(queries.detail(id).availableSaleUnits()).isEqualByComparingTo("4");
    }

    @Test
    @DisplayName("PRD-159 — ready-built 3 and buildable 4 yields 7")
    void assembledReadyBuiltPlusBuildableAvailability() {
        actingWith(MANAGE, VIEW, ACTIVATE);
        UUID finished = stockItem("PC-FIN");
        UUID component = stockItem("CPU-1");
        movement(finished, new BigDecimal("3"));
        movement(component, new BigDecimal("4"));
        UUID id = commands.createInternal(new SellableProductCommandService.SellableProductInput(
                "SP-PC", "Sellable SP-PC", SellableNature.ASSEMBLED, null, "Desktops", null,
                RecordStatus.DRAFT, null, null, "PC-FIN"), actorId, Instant.now());
        activateSingleComponentTemplate(id, "CPU-1", "1");

        assertThat(queries.detail(id).availableSaleUnits()).isEqualByComparingTo("7");
    }

    @Test
    @DisplayName("PRD-023 ASSEMBLED — buildable quantity is the BOM-line minimum")
    void assembledAvailabilityIsTheMinimum() {
        actingWith(MANAGE, VIEW, ACTIVATE);
        UUID cpu = stockItem("CPU-1");
        UUID ram = stockItem("RAM-1");
        UUID psu = stockItem("PSU-1");
        movement(cpu, new BigDecimal("50"));
        movement(ram, new BigDecimal("40"));
        movement(psu, new BigDecimal("3"));

        UUID id = assembled("SP-PC");
        UUID template = commands.createDraftBuildTemplate(id);
        commands.addBomLine(template, new SellableProductCommandService.BomLineInput(
                "CPU-1", new BigDecimal("1"), "Processor", false, null));
        commands.addBomLine(template, new SellableProductCommandService.BomLineInput(
                "RAM-1", new BigDecimal("2"), "RAM", false, null));
        commands.addBomLine(template, new SellableProductCommandService.BomLineInput(
                "PSU-1", new BigDecimal("1"), "PSU", false, null));
        commands.activateBuildTemplate(template);

        SellableProductView view = queries.detail(id);
        // CPU 50, RAM 40÷2 = 20, PSU 3. The power supply constrains the build.
        assertThat(view.availableSaleUnits()).isEqualByComparingTo("3");
        assertThat(view.availabilityConstrainedBy()).isEqualTo("PSU-1");
        assertThat(view.activeBuildTemplateVersion()).isEqualTo(1);
    }

    @Test
    @DisplayName("PRD-033 — an OPTIONAL BOM line does not constrain buildability")
    void optionalLinesDoNotConstrain() {
        actingWith(MANAGE, VIEW, ACTIVATE);
        UUID cpu = stockItem("CPU-1");
        stockItem("GPU-1"); // deliberately no stock at all
        movement(cpu, new BigDecimal("5"));

        UUID id = assembled("SP-PC");
        UUID template = commands.createDraftBuildTemplate(id);
        commands.addBomLine(template, new SellableProductCommandService.BomLineInput(
                "CPU-1", new BigDecimal("1"), "Processor", false, null));
        commands.addBomLine(template, new SellableProductCommandService.BomLineInput(
                "GPU-1", new BigDecimal("1"), "GPU", true, null));
        commands.activateBuildTemplate(template);

        // The base configuration is buildable without the optional graphics card.
        assertThat(queries.detail(id).availableSaleUnits()).isEqualByComparingTo("5");
    }

    @Test
    @DisplayName("🔴 INV-61.1 / PRD-032 — a BOM line references a Product Variant, never a Sellable Product")
    void bomLineRejectsASellableSku() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");
        simple("SP-SIMPLE", "INV-1", "1");
        UUID id = assembled("SP-PC");
        UUID template = commands.createDraftBuildTemplate(id);

        // 🔴 A Sellable SKU simply does not resolve in the Inventory SKU space.
        assertThatThrownBy(() -> commands.addBomLine(template,
                new SellableProductCommandService.BomLineInput(
                        "SP-SIMPLE", new BigDecimal("1"), null, false, null)))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("PRD-032");
    }

    @Test
    @DisplayName("INV-61.3 — a BOM line must reference an ACTIVE Stock Item")
    void bomLineRequiresActiveVariant() {
        actingWith(MANAGE, VIEW, ProductPermissions.STOCK_ITEM_MANAGE);
        UUID draftVariant = stockItems.createInternal(new StockItemCommandService.StockItemInput(
                "INV-DRAFT", "Draft component", null, null, "pcs", null,
                SerializationPolicy.NOT_SERIALIZED, null, RecordStatus.DRAFT), actorId, Instant.now());
        assertThat(draftVariant).isNotNull();

        UUID id = assembled("SP-PC");
        UUID template = commands.createDraftBuildTemplate(id);
        assertThatThrownBy(() -> commands.addBomLine(template,
                new SellableProductCommandService.BomLineInput(
                        "INV-DRAFT", new BigDecimal("1"), null, false, null)))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("INV-61.3");
    }

    @Test
    @DisplayName("🔴 INV-60.2 / PRD-082 — a version needs a required line before it can be activated")
    void activationRequiresARequiredLine() {
        actingWith(MANAGE, VIEW, ACTIVATE);
        stockItem("GPU-1");
        UUID id = assembled("SP-PC");
        UUID template = commands.createDraftBuildTemplate(id);
        commands.addBomLine(template, new SellableProductCommandService.BomLineInput(
                "GPU-1", new BigDecimal("1"), "GPU", true, null));

        assertThatThrownBy(() -> commands.activateBuildTemplate(template))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("INV-60.2");
    }

    @Test
    @DisplayName("🔴 PRD-067 / PRD-068 / PRD-069 — activating v2 supersedes v1 and RETAINS it")
    void activatingANewVersionSupersedesAndRetains() {
        actingWith(MANAGE, VIEW, ACTIVATE);
        stockItem("CPU-1");
        UUID id = assembled("SP-PC");

        UUID v1 = commands.createDraftBuildTemplate(id);
        commands.addBomLine(v1, new SellableProductCommandService.BomLineInput(
                "CPU-1", new BigDecimal("1"), "Processor", false, null));
        commands.activateBuildTemplate(v1);

        UUID v2 = commands.createDraftBuildTemplate(id);
        commands.addBomLine(v2, new SellableProductCommandService.BomLineInput(
                "CPU-1", new BigDecimal("2"), "Processor", false, null));
        commands.activateBuildTemplate(v2);

        List<SellableProductQueryService.BuildTemplateView> versions = queries.buildTemplates(id);
        assertThat(versions).hasSize(2);
        assertThat(versions.get(0).versionNumber()).isEqualTo(2);
        assertThat(versions.get(0).status()).isEqualTo(BuildTemplateStatus.ACTIVE);
        // 🔴 Retained permanently — As-Built Records reference it (PRD-068).
        assertThat(versions.get(1).status()).isEqualTo(BuildTemplateStatus.SUPERSEDED);
        assertThat(versions.get(1).effectiveTo()).isNotNull();

        assertThat(jdbc.queryForObject("SELECT count(*) FROM build_template", Integer.class)).isEqualTo(2);
    }

    @Test
    @DisplayName("🔴 PRD-069 — an ACTIVE version can never be edited in place")
    void activeVersionIsNotEditable() {
        actingWith(MANAGE, VIEW, ACTIVATE);
        stockItem("CPU-1");
        stockItem("RAM-1");
        UUID id = assembled("SP-PC");
        UUID template = commands.createDraftBuildTemplate(id);
        commands.addBomLine(template, new SellableProductCommandService.BomLineInput(
                "CPU-1", new BigDecimal("1"), null, false, null));
        commands.activateBuildTemplate(template);

        assertThatThrownBy(() -> commands.addBomLine(template,
                new SellableProductCommandService.BomLineInput(
                        "RAM-1", new BigDecimal("1"), null, false, null)))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("PRD-069");
    }

    @Test
    @DisplayName("🔴 PRD-092 — activation captures WHO and WHEN as first-class facts")
    void activationIsAttributed() {
        actingWith(MANAGE, VIEW, ACTIVATE);
        stockItem("CPU-1");
        UUID id = assembled("SP-PC");
        UUID template = commands.createDraftBuildTemplate(id);
        commands.addBomLine(template, new SellableProductCommandService.BomLineInput(
                "CPU-1", new BigDecimal("1"), null, false, null));
        commands.activateBuildTemplate(template);

        SellableProductQueryService.BuildTemplateView active = queries.buildTemplates(id).getFirst();
        assertThat(active.activatedBy()).isEqualTo(actorId);
        assertThat(active.activatedAt()).isNotNull();
        assertThat(active.effectiveFrom()).isNotNull();
    }

    @Test
    @DisplayName("🔴 No stored buildable balance column exists anywhere on the sellable layer")
    void noStoredBuildableBalance() {
        List<String> columns = jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' "
                        + "AND table_name IN ('sellable_product','build_template','bom_line','bundle_member')",
                String.class);
        assertThat(columns).noneSatisfy(c -> assertThat(c.toLowerCase())
                .containsAnyOf("buildable", "sellable_stock", "ready_built", "available", "bundle_stock"));
    }

    // ================================================================= BUNDLE

    @Test
    @DisplayName("🔴 PRD-048 / INV-63.2 — a bundle may not contain a bundle")
    void bundleNestingIsOneLevel() {
        actingWith(MANAGE, VIEW);
        UUID inner = bundle("SP-INNER");
        UUID outer = bundle("SP-OUTER");
        assertThat(inner).isNotNull();

        assertThatThrownBy(() -> commands.addBundleMember(outer,
                new SellableProductCommandService.BundleMemberInput(
                        "SP-INNER", new BigDecimal("1"), false, null)))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("PRD-048");
    }

    @Test
    @DisplayName("PRD-023 BUNDLE — the minimum across members ÷ member quantities")
    void bundleAvailabilityIsTheMinimum() {
        actingWith(MANAGE, VIEW);
        UUID monitor = stockItem("MON-1");
        UUID keyboard = stockItem("KB-1");
        movement(monitor, new BigDecimal("10"));
        movement(keyboard, new BigDecimal("9"));
        simple("SP-MON", "MON-1", "1");
        simple("SP-KB", "KB-1", "1");

        UUID id = bundle("SP-BUNDLE");
        commands.addBundleMember(id, new SellableProductCommandService.BundleMemberInput(
                "SP-MON", new BigDecimal("1"), false, null));
        commands.addBundleMember(id, new SellableProductCommandService.BundleMemberInput(
                "SP-KB", new BigDecimal("2"), false, null));

        // Monitor 10 ÷ 1 = 10; keyboard 9 ÷ 2 = 4 (floored). The keyboard constrains.
        SellableProductView view = queries.detail(id);
        assertThat(view.availableSaleUnits()).isEqualByComparingTo("4");
        assertThat(view.bundleMemberCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("🔴 An unresolvable member makes the BUNDLE unresolvable, never zero")
    void bundleWithUnresolvableMemberIsUnresolved() {
        actingWith(MANAGE, VIEW);
        UUID assembledMember = assembled("SP-PC"); // no ACTIVE template
        assertThat(assembledMember).isNotNull();

        UUID id = bundle("SP-BUNDLE");
        commands.addBundleMember(id, new SellableProductCommandService.BundleMemberInput(
                "SP-PC", new BigDecimal("1"), false, null));

        SellableProductView view = queries.detail(id);
        assertThat(view.availableSaleUnits()).isNull();
        assertThat(view.availabilityUnresolvedReason()).contains("SP-PC");
    }

    @Test
    @DisplayName("🔴 A BUNDLE cannot become ACTIVE with no required member")
    void bundleNeedsAMemberToActivate() {
        actingWith(MANAGE, VIEW);
        UUID id = bundle("SP-BUNDLE");

        assertThatThrownBy(() -> commands.update(id, new SellableProductCommandService.SellableProductInput(
                null, null, null, null, null, null, RecordStatus.ACTIVE, null, null, null), null))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("PRD-021");
    }

    @Test
    @DisplayName("🔴 Defining a bundle creates NO inventory movement and NO stock")
    void bundleCreatesNoInventory() {
        actingWith(MANAGE, VIEW);
        stockItem("MON-1");
        simple("SP-MON", "MON-1", "1");
        UUID id = bundle("SP-BUNDLE");
        commands.addBundleMember(id, new SellableProductCommandService.BundleMemberInput(
                "SP-MON", new BigDecimal("1"), false, null));

        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_movement", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM stock_reservation", Integer.class)).isZero();
    }

    // ================================================================= summary

    @Test
    @DisplayName("The five summary values are derived, filter-aware and pagination-independent")
    void summaryIsDerivedAndFilterAware() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");
        simple("SP-A", "INV-1", "1");
        simple("SP-B", "INV-1", "1");
        assembled("SP-C");
        bundle("SP-D");

        SellableProductSummary all = queries.summary(SellableProductFilter.none());
        assertThat(all.totalSellableProducts()).isEqualTo(4);
        assertThat(all.simpleCount()).isEqualTo(2);
        assertThat(all.assembledCount()).isEqualTo(1);
        assertThat(all.bundleCount()).isEqualTo(1);
        // Only the two SIMPLE fixtures were created ACTIVE.
        assertThat(all.activeSellableProducts()).isEqualTo(2);

        SellableProductSummary filtered = queries.summary(new SellableProductFilter(
                null, SellableNature.SIMPLE, null, null));
        assertThat(filtered.totalSellableProducts()).isEqualTo(2);
        assertThat(filtered.assembledCount()).isZero();

        // 🔴 Pagination-independent: a one-row page does not change the totals.
        var page = queries.list(SellableProductFilter.none(), PageRequest.of(0, 1));
        assertThat(page.getContent()).hasSize(1);
        assertThat(queries.summary(SellableProductFilter.none()).totalSellableProducts()).isEqualTo(4);
    }

    @Test
    @DisplayName("Search covers name and Sellable SKU only — never identity (PRD-056)")
    void searchCoversCanonicalIdentifiers() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");
        simple("SP-FIND-ME", "INV-1", "1");

        assertThat(queries.allMatching(new SellableProductFilter("find-me", null, null, null))).hasSize(1);
        assertThat(queries.allMatching(new SellableProductFilter("Sellable SP-FIND", null, null, null)))
                .hasSize(1);
        assertThat(queries.allMatching(new SellableProductFilter("nothing", null, null, null))).isEmpty();
    }

    // ================================================================= CSV — PRD-150

    @Test
    @DisplayName("🔴 PRD-150 — the exact canonical header order, and listing_count is ABSENT")
    void csvHeadersAreTheCanonicalContract() {
        assertThat(SellableProductCsvService.HEADERS).containsExactly(
                "sellable_product_id", "sellable_sku", "name", "nature", "sellable_category",
                "record_status", "simple_target_inventory_sku", "simple_quantity_per_sale_unit",
                "assembled_finished_inventory_sku", "active_build_template_version", "warranty_package");
        assertThat(SellableProductCsvService.HEADERS).doesNotContain("listing_count");
        assertThat(SellableProductCsvService.HEADERS).doesNotContain("channel_price");
    }

    @Test
    @DisplayName("Export and import headers are identical, so a file round-trips (PRD-148.c)")
    void exportRoundTrips() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");
        simple("SP-1", "INV-1", "1");

        String exported = csv.export(SellableProductFilter.none());
        String header = exported.split("\r\n")[0];
        assertThat(header).isEqualTo(String.join(",", SellableProductCsvService.HEADERS));
        assertThat(csv.template().trim()).isEqualTo(header);
        // 🔴 The template carries headers only — no fabricated business data (UX-043.e).
        assertThat(csv.template().trim().split("\r\n")).hasSize(1);
    }

    @Test
    @DisplayName("CSV creates a SIMPLE product and resolves its mapping explicitly")
    void csvCreates() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");

        String file = String.join(",", SellableProductCsvService.HEADERS) + "\r\n"
                + ",SP-NEW,New monitor,SIMPLE,Monitors,ACTIVE,INV-1,1,,\r\n";
        var plan = csv.validate(file);
        assertThat(plan.errorCount()).isZero();

        // 🔴 Validation wrote nothing (API-060.f).
        assertThat(jdbc.queryForObject("SELECT count(*) FROM sellable_product", Integer.class)).isZero();

        var result = csv.confirm(plan.planId());
        assertThat(result.created()).isEqualTo(1);
        assertThat(queries.allMatching(SellableProductFilter.none())).hasSize(1);
    }

    @Test
    @DisplayName("CSV creates an ASSEMBLED product only with its finished Inventory SKU")
    void csvCreatesAssembledWithFinishedMapping() {
        actingWith(MANAGE, VIEW);
        stockItem("PC-FIN");

        String file = String.join(",", SellableProductCsvService.HEADERS) + "\r\n"
                + ",SP-PC,New PC,ASSEMBLED,Desktops,DRAFT,,,PC-FIN,,\r\n";
        var plan = csv.validate(file);
        assertThat(plan.errorCount()).isZero();

        csv.confirm(plan.planId());
        SellableProductView view = queries.allMatching(SellableProductFilter.none()).getFirst();
        assertThat(view.assembledFinishedInventorySku()).isEqualTo("PC-FIN");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inventory_movement", Integer.class)).isZero();
    }

    @Test
    @DisplayName("🔴 PRD-150.a / PRD-070 — a CSV attempting to change nature is an ERROR")
    void csvRefusesANatureChange() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");
        simple("SP-1", "INV-1", "1");

        String file = String.join(",", SellableProductCsvService.HEADERS) + "\r\n"
                + ",SP-1,Renamed,BUNDLE,,,,,,\r\n";
        var plan = csv.validate(file);

        assertThat(plan.errorCount()).isEqualTo(1);
        assertThat(plan.outcomes().getFirst().message()).contains("immutable");
        assertThat(plan.outcomes().getFirst().field()).isEqualTo("nature");
        // 🔴 Not silently ignored — and nothing was written.
        assertThat(sellables.findBySellableSkuIgnoreCase("SP-1").orElseThrow().getNature())
                .isEqualTo(SellableNature.SIMPLE);
    }

    @Test
    @DisplayName("🔴 PRD-150.b — active_build_template_version is READ-ONLY on import")
    void csvRefusesTheReadOnlyTemplateColumn() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");
        simple("SP-1", "INV-1", "1");

        String file = String.join(",", SellableProductCsvService.HEADERS) + "\r\n"
                + ",SP-1,Name,,,,,,,7,\r\n";
        var plan = csv.validate(file);

        assertThat(plan.errorCount()).isEqualTo(1);
        assertThat(plan.outcomes().getFirst().message()).contains("READ-ONLY");
    }

    @Test
    @DisplayName("🔴 PRD-150.b / PRD-150.c — BOM and bundle columns are REFUSED, never ignored")
    void csvRefusesExcludedColumns() {
        actingWith(MANAGE, VIEW);

        String file = String.join(",", SellableProductCsvService.HEADERS) + ",bom_lines\r\n";
        assertThatThrownBy(() -> csv.validate(file))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("PRD-150");

        String members = String.join(",", SellableProductCsvService.HEADERS) + ",bundle_members\r\n";
        assertThatThrownBy(() -> csv.validate(members))
                .isInstanceOf(SellableProductValidationException.class)
                .hasMessageContaining("PRD-150");
    }

    @Test
    @DisplayName("🔴 A SIMPLE row without its mapping is refused at create (PRD-021)")
    void csvRefusesSimpleWithoutMapping() {
        actingWith(MANAGE, VIEW);

        String file = String.join(",", SellableProductCsvService.HEADERS) + "\r\n"
                + ",SP-NEW,New,SIMPLE,,,,,,\r\n";
        var plan = csv.validate(file);
        assertThat(plan.errorCount()).isEqualTo(1);
        assertThat(plan.outcomes().getFirst().message()).contains("PRD-021");
    }

    @Test
    @DisplayName("🔴 API-060.d — a confirmed import is ATOMIC, and API-061.a makes it idempotent")
    void csvImportIsAtomicAndIdempotent() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");

        String file = String.join(",", SellableProductCsvService.HEADERS) + "\r\n"
                + ",SP-A,A,SIMPLE,,ACTIVE,INV-1,1,,\r\n"
                + ",SP-B,B,SIMPLE,,ACTIVE,INV-1,1,,\r\n";
        var plan = csv.validate(file);
        csv.confirm(plan.planId());
        assertThat(queries.allMatching(SellableProductFilter.none())).hasSize(2);

        // 🔴 The plan is consumed: resubmitting creates no duplicates.
        assertThatThrownBy(() -> csv.confirm(plan.planId()))
                .isInstanceOf(SellableProductValidationException.class);
        assertThat(queries.allMatching(SellableProductFilter.none())).hasSize(2);
    }

    @Test
    @DisplayName("🔴 PRD-152.d — an import NEVER deletes a record absent from the file")
    void csvNeverDeletes() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");
        simple("SP-KEEP", "INV-1", "1");

        String file = String.join(",", SellableProductCsvService.HEADERS) + "\r\n"
                + ",SP-OTHER,Other,SIMPLE,,ACTIVE,INV-1,1,,\r\n";
        csv.confirm(csv.validate(file).planId());

        assertThat(sellables.findBySellableSkuIgnoreCase("SP-KEEP")).isPresent();
    }

    @Test
    @DisplayName("Import records the ACTOR — attribution is captured, never reconstructed")
    void csvImportIsAttributed() {
        actingWith(MANAGE, VIEW);
        stockItem("INV-1");

        String file = String.join(",", SellableProductCsvService.HEADERS) + "\r\n"
                + ",SP-A,A,SIMPLE,,ACTIVE,INV-1,1,,\r\n";
        csv.confirm(csv.validate(file).planId());

        assertThat(jdbc.queryForObject(
                "SELECT created_by FROM sellable_product WHERE sellable_sku = 'SP-A'", UUID.class))
                .isEqualTo(actorId);
    }

    // ================================================================= security

    @Test
    @DisplayName("🔴 PRM-004 — view is required on every read entry point")
    void viewIsRequired() {
        actingWith(MANAGE);
        assertThatThrownBy(() -> queries.list(SellableProductFilter.none(), PageRequest.of(0, 10)))
                .isInstanceOf(AccessDeniedByPermissionException.class);
        assertThatThrownBy(() -> queries.summary(SellableProductFilter.none()))
                .isInstanceOf(AccessDeniedByPermissionException.class);
        assertThatThrownBy(() -> queries.buildTemplates(UUID.randomUUID()))
                .isInstanceOf(AccessDeniedByPermissionException.class);
    }

    @Test
    @DisplayName("🔴 view never implies manage")
    void viewDoesNotImplyManage() {
        actingWith(VIEW);
        assertThatThrownBy(() -> commands.create(new SellableProductCommandService.SellableProductInput(
                "SP-X", "X", SellableNature.BUNDLE, null, null, null, null, null, null, null)))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(MANAGE);
    }

    @Test
    @DisplayName("🔴 PRD-155 — manage never implies activate. Authoring a draft is not activating it")
    void manageDoesNotImplyActivate() {
        actingWith(MANAGE, VIEW);
        stockItem("CPU-1");
        UUID id = assembled("SP-PC");
        UUID template = commands.createDraftBuildTemplate(id);
        commands.addBomLine(template, new SellableProductCommandService.BomLineInput(
                "CPU-1", new BigDecimal("1"), null, false, null));

        assertThatThrownBy(() -> commands.activateBuildTemplate(template))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(ACTIVATE);
    }

    @Test
    @DisplayName("🔴 activate never implies manage either — the two are independent")
    void activateDoesNotImplyManage() {
        actingWith(ACTIVATE, VIEW);
        assertThatThrownBy(() -> commands.create(new SellableProductCommandService.SellableProductInput(
                "SP-X", "X", SellableNature.BUNDLE, null, null, null, null, null, null, null)))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(MANAGE);
    }

    @Test
    @DisplayName("🔴 CSV import requires manage and adds no CSV-specific permission (PRD-155.e)")
    void csvImportRequiresManage() {
        actingWith(VIEW);
        assertThatThrownBy(() -> csv.validate("sellable_sku\r\nSP-1\r\n"))
                .isInstanceOf(AccessDeniedByPermissionException.class)
                .hasMessageContaining(MANAGE);
    }

    @Test
    @DisplayName("🔴 PRM-068 — an Administrator ROLE NAME grants nothing implicitly")
    void administratorRoleNameGrantsNothing() {
        // The actor holds the Administrator role name and NO permission at all.
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actorId, "p2-tester", "P2 Tester", "unused",
                AccountLifecycleState.ACTIVE, Set.of("Administrator"), Set.of());
        SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        principal, null, List.of(new SimpleGrantedAuthority("ROLE_Administrator"))));

        assertThatThrownBy(() -> queries.list(SellableProductFilter.none(), PageRequest.of(0, 10)))
                .isInstanceOf(AccessDeniedByPermissionException.class);
    }

    @Test
    @DisplayName("🔴 PRM-089.c — no wildcard exists in any declared Product capability code")
    void noWildcardCapabilityExists() {
        List<String> codes = jdbc.queryForList("SELECT code FROM permission", String.class);
        assertThat(codes).isNotEmpty();
        assertThat(codes).allSatisfy(code -> assertThat(code).doesNotContain("*"));
        assertThat(codes).contains("product.sellable-product.view", "product.sellable-product.manage",
                "product.build-template.activate");
    }

    @Test
    @DisplayName("🔴 The V4 migration GRANTS nothing — it only DEFINES capabilities")
    void migrationGrantsNothing() throws Exception {
        String sql = java.nio.file.Files.readString(java.nio.file.Path.of(
                "src/main/resources/db/migration/V4__product_sellable_product_and_build_definition.sql"));
        assertThat(sql).doesNotContainIgnoringCase("INSERT INTO role_permission");
        assertThat(sql).doesNotContainIgnoringCase("INSERT INTO user_permission_override");
        assertThat(sql).doesNotContainIgnoringCase("INSERT INTO operational_user_profile");
        assertThat(sql).doesNotContainIgnoringCase("INSERT INTO user_role");
    }

    @Test
    @DisplayName("PRD-159 — Product availability uses the Inventory application boundary")
    void availabilityUsesInventoryApplicationBoundary() throws Exception {
        String service = java.nio.file.Files.readString(java.nio.file.Path.of(
                "src/main/java/com/trioloo/erp/product/application/SellableAvailabilityService.java"));

        assertThat(service).contains("StockPositionQuery");
        assertThat(service).doesNotContain("StockPositionRepository");
        assertThat(service).doesNotContain("JdbcTemplate");
    }

    // ================================================================= boundaries

    @Test
    @DisplayName("🔴 PRD-065 — a Stock Item cannot be archived while an ACTIVE template uses it")
    void variantCannotBeArchivedWhileAnActiveTemplateUsesIt() {
        actingWith(MANAGE, VIEW, ACTIVATE, ProductPermissions.STOCK_ITEM_MANAGE);
        UUID cpu = stockItem("CPU-1");
        UUID id = assembled("SP-PC");
        UUID template = commands.createDraftBuildTemplate(id);
        commands.addBomLine(template, new SellableProductCommandService.BomLineInput(
                "CPU-1", new BigDecimal("1"), null, false, null));
        commands.activateBuildTemplate(template);

        assertThatThrownBy(() -> stockItems.update(cpu, new StockItemCommandService.StockItemInput(
                null, null, null, null, null, null, null, null, RecordStatus.ARCHIVED), null))
                .isInstanceOf(StockItemValidationException.class)
                .hasMessageContaining("PRD-065");
    }

    @Test
    @DisplayName("🔴 No E-103 / E-104 table or endpoint was created by this stage")
    void orderSpecificBuildIsNotImplemented() {
        List<String> tables = jdbc.queryForList(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
                String.class);
        assertThat(tables).noneSatisfy(t -> assertThat(t.toLowerCase())
                .containsAnyOf("order_specific", "configuration_line", "build_job", "as_built"));
    }

    @Test
    @DisplayName("🔴 E-059 Channel Listing fields do not leak into Sellable Product")
    void sellableProductDoesNotAbsorbListingFields() {
        List<String> tables = jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns "
                        + "WHERE table_schema = 'public' AND table_name = 'sellable_product'",
                String.class);
        assertThat(tables).noneSatisfy(t -> assertThat(t.toLowerCase())
                .containsAnyOf("channel_price", "publication_intent", "listing_status",
                        "sync_state", "external_listing_id", "published_marketplace_stock"));
    }
}
