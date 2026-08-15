package com.trioloo.erp.product.application;

import com.trioloo.erp.access.AccessFixtures;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.product.domain.RecordStatus;
import com.trioloo.erp.product.domain.SerializationPolicy;
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
import org.springframework.security.test.context.support.WithSecurityContext;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Stock Items — persistence, derivation, authority, valuation and CSV.
 *
 * <p>🔴 Runs against the ISOLATED test database only. {@code DevelopmentDatabaseIsolationTest}
 * is the tripwire that keeps it that way; nothing here touches the development data.
 *
 * <p>🔴 No business data is seeded on startup. Every record a test needs, that test creates.
 */
@SpringBootTest
class StockItemTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private StockItemQueryService queries;
    @Autowired private StockItemCommandService commands;
    @Autowired private StockItemCsvService csv;

    private AccessFixtures fixtures;
    private UUID actorId;

    @BeforeEach
    void setUp() {
        fixtures = new AccessFixtures(jdbc, passwordEncoder);
        clearProductData();
        fixtures.clear();
        actorId = fixtures.createProfile("p1-tester", "irrelevant", AccountLifecycleState.ACTIVE);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        clearProductData();
    }

    private void clearProductData() {
        // Stage P2 tables first: sellable_product and bom_line both reference product_variant,
        // so deleting the variant before them would violate the foreign keys that keep the
        // resolution targets honest.
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
                actorId, "p1-tester", "P1 Tester", "unused",
                AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        var auth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private UUID createItem(String sku, String name) {
        return commands.createInternal(new StockItemCommandService.StockItemInput(
                sku, name, "Trioloo", "RAM", "pcs", "0012345", SerializationPolicy.NOT_SERIALIZED,
                "RAM", RecordStatus.ACTIVE), actorId, Instant.now());
    }

    private void recordMovement(UUID variantId, String type, BigDecimal quantity, BigDecimal unitCost) {
        jdbc.update("""
                INSERT INTO inventory_movement (id, product_variant_id, quantity, movement_type, occurred_at, recorded_by, unit_cost)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), variantId, quantity, type, Timestamp.from(Instant.now()), actorId, unitCost);
    }

    private void reserve(UUID variantId, BigDecimal quantity) {
        jdbc.update("""
                INSERT INTO stock_reservation (id, product_variant_id, quantity, reserved_at, reserved_by)
                VALUES (?, ?, ?, ?, ?)
                """, UUID.randomUUID(), variantId, quantity, Timestamp.from(Instant.now()), actorId);
    }

    // ================================================================= persistence

    @Test
    @DisplayName("E-020 persists and the Inventory SKU is unique, including against archived records")
    void skuIsUnique() {
        actingWith(ProductPermissions.STOCK_ITEM_MANAGE);
        commands.create(new StockItemCommandService.StockItemInput(
                "SKU-1", "Kingston 16GB DDR4 3200", null, null, "pcs", null, null, null, RecordStatus.ARCHIVED));

        // PRD-013 - a retired SKU is never reissued, so archival does not free the string.
        assertThatThrownBy(() -> commands.create(new StockItemCommandService.StockItemInput(
                "sku-1", "Another item", null, null, "pcs", null, null, null, null)))
                .isInstanceOf(StockItemValidationException.class)
                .hasMessageContaining("never reissued");
    }

    @Test
    @DisplayName("🔴 product_variant carries no stock, availability or valuation column")
    void productTableHoldsNoStockFigure() {
        List<String> columns = jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'product_variant'",
                String.class);

        assertThat(columns).noneSatisfy(column -> assertThat(column.toLowerCase()).containsAnyOf(
                "stock_quantity", "current_stock", "on_hand", "physical_balance", "stock_balance",
                "available_balance", "available_quantity", "stock_value", "inventory_value",
                "out_of_stock", "reorder", "minimum_stock", "maximum_stock"));
    }

    @Test
    @DisplayName("The Inventory SKU is immutable on update")
    void skuIsImmutable() {
        actingWith(ProductPermissions.STOCK_ITEM_MANAGE);
        UUID id = createItem("SKU-IMM", "Immutable item");

        assertThatThrownBy(() -> commands.update(id, new StockItemCommandService.StockItemInput(
                "SKU-CHANGED", "Immutable item", null, null, "pcs", null, null, null, null), null))
                .isInstanceOf(StockItemValidationException.class)
                .hasMessageContaining("immutable");
    }

    // ================================================================= authority

    @Test
    @DisplayName("view permission grants the query; its absence denies it")
    void viewPermissionGatesQuery() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW);
        assertThat(queries.list(StockItemFilter.none(), PageRequest.of(0, 10))).isEmpty();

        actingWith(); // authenticated, no capabilities
        assertThatThrownBy(() -> queries.list(StockItemFilter.none(), PageRequest.of(0, 10)))
                .isInstanceOf(AccessDeniedByPermissionException.class);
    }

    @Test
    @DisplayName("🔴 view alone does not grant manage")
    void viewDoesNotImplyManage() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW);
        assertThatThrownBy(() -> commands.create(new StockItemCommandService.StockItemInput(
                "SKU-X", "Denied", null, null, "pcs", null, null, null, null)))
                .isInstanceOf(AccessDeniedByPermissionException.class);
    }

    @Test
    @DisplayName("🔴 manage alone does not imply valuation visibility")
    void manageDoesNotImplyValuation() {
        actingWith(ProductPermissions.STOCK_ITEM_MANAGE, ProductPermissions.STOCK_ITEM_VIEW);
        UUID id = createItem("SKU-VAL", "Valued item");
        recordMovement(id, "GOODS_RECEIPT_ACCEPTED", new BigDecimal("10"), new BigDecimal("1250.50"));

        assertThat(queries.maySeeValuation()).isFalse();
        StockItemView view = queries.detail(id);
        assertThat(view.stockValue()).isNull();
        assertThat(view.weightedAverageCost()).isNull();
    }

    @Test
    @DisplayName("🔴 an Administrator role name grants nothing implicitly")
    void administratorRoleNameGrantsNothing() {
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actorId, "p1-tester", "P1 Tester", "unused",
                AccountLifecycleState.ACTIVE, Set.of("ADMINISTRATOR"), Set.of());
        SecurityContextHolder.getContext().setAuthentication(
                new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                        principal, null, List.of(new SimpleGrantedAuthority("ROLE_ADMINISTRATOR"))));

        assertThatThrownBy(() -> queries.list(StockItemFilter.none(), PageRequest.of(0, 10)))
                .isInstanceOf(AccessDeniedByPermissionException.class);
    }

    // ================================================================= derivation

    @Test
    @DisplayName("No movements yields a truthful zero position, not missing data")
    void noMovementsYieldsZero() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW, ProductPermissions.STOCK_ITEM_MANAGE);
        UUID id = createItem("SKU-EMPTY", "Never moved");

        StockItemView view = queries.detail(id);
        assertThat(view.physicalStock()).isEqualByComparingTo("0");
        assertThat(view.availableQuantity()).isEqualByComparingTo("0");
        assertThat(view.outOfStock()).isTrue();
    }

    @Test
    @DisplayName("IVN-055 — physical 0 / available 0 is out of stock")
    void outOfStockWhenNothingHeld() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW, ProductPermissions.STOCK_ITEM_MANAGE);
        UUID id = createItem("SKU-OOS-1", "Zero");
        assertThat(queries.detail(id).outOfStock()).isTrue();
    }

    @Test
    @DisplayName("🔴 IVN-055 — physical 5 fully reserved is OUT OF STOCK, deliberately")
    void outOfStockWhenFullyReserved() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW, ProductPermissions.STOCK_ITEM_MANAGE);
        UUID id = createItem("SKU-OOS-2", "Reserved");
        recordMovement(id, "GOODS_RECEIPT_ACCEPTED", new BigDecimal("5"), new BigDecimal("100"));
        reserve(id, new BigDecimal("5"));

        StockItemView view = queries.detail(id);
        assertThat(view.physicalStock()).isEqualByComparingTo("5");
        assertThat(view.availableQuantity()).isEqualByComparingTo("0");
        assertThat(view.outOfStock()).isTrue();
    }

    @Test
    @DisplayName("IVN-055 — physical 5 with 2 reserved leaves 3 available and is not out of stock")
    void inStockWhenAvailabilityRemains() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW, ProductPermissions.STOCK_ITEM_MANAGE);
        UUID id = createItem("SKU-OOS-3", "Partly reserved");
        recordMovement(id, "GOODS_RECEIPT_ACCEPTED", new BigDecimal("5"), new BigDecimal("100"));
        reserve(id, new BigDecimal("2"));

        StockItemView view = queries.detail(id);
        assertThat(view.availableQuantity()).isEqualByComparingTo("3");
        assertThat(view.outOfStock()).isFalse();
    }

    @Test
    @DisplayName("IVN-055 — negative availability is out of stock (<=, not =)")
    void negativeAvailabilityIsOutOfStock() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW, ProductPermissions.STOCK_ITEM_MANAGE);
        UUID id = createItem("SKU-OOS-4", "Oversold");
        recordMovement(id, "GOODS_RECEIPT_ACCEPTED", new BigDecimal("2"), new BigDecimal("100"));
        reserve(id, new BigDecimal("5"));

        StockItemView view = queries.detail(id);
        assertThat(view.availableQuantity()).isEqualByComparingTo("-3");
        assertThat(view.outOfStock()).isTrue();
    }

    // ================================================================= summary and valuation

    @Test
    @DisplayName("🔴 The summary is pagination-independent and filter-aware")
    void summaryIgnoresPagination() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW, ProductPermissions.STOCK_ITEM_MANAGE);
        for (int i = 0; i < 7; i++) {
            createItem("SKU-P-" + i, "Item " + i);
        }

        // One visible card, seven counted: the page never defines the summary.
        assertThat(queries.list(StockItemFilter.none(), PageRequest.of(0, 1)).getContent()).hasSize(1);
        assertThat(queries.summary(StockItemFilter.none()).totalStockItems()).isEqualTo(7);
    }

    @Test
    @DisplayName("Total Stock Value uses physical quantity × weighted average cost, in BigDecimal")
    void totalStockValueUsesWeightedAverageCost() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW, ProductPermissions.STOCK_ITEM_MANAGE,
                ProductPermissions.VALUATION_VIEW);
        UUID id = createItem("SKU-WAC", "Valued");

        // Two acquisitions at different costs: WAC = (10×100 + 10×200) / 20 = 150.
        recordMovement(id, "GOODS_RECEIPT_ACCEPTED", new BigDecimal("10"), new BigDecimal("100.00"));
        recordMovement(id, "GOODS_RECEIPT_ACCEPTED", new BigDecimal("10"), new BigDecimal("200.00"));

        StockItemView view = queries.detail(id);
        assertThat(view.weightedAverageCost()).isEqualByComparingTo("150");
        assertThat(view.stockValue()).isEqualByComparingTo("3000");

        StockItemSummary summary = queries.summary(StockItemFilter.none());
        assertThat(summary.totalStockValue()).isEqualByComparingTo("3000");
        assertThat(summary.physicalStockUnits()).isEqualByComparingTo("20");
    }

    @Test
    @DisplayName("🔴 Without valuation authority the value is ABSENT, never zero")
    void valuationIsAbsentNotZeroWhenUnauthorised() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW, ProductPermissions.STOCK_ITEM_MANAGE,
                ProductPermissions.VALUATION_VIEW);
        UUID id = createItem("SKU-HIDDEN", "Restricted");
        recordMovement(id, "GOODS_RECEIPT_ACCEPTED", new BigDecimal("4"), new BigDecimal("25.00"));

        actingWith(ProductPermissions.STOCK_ITEM_VIEW);
        StockItemSummary summary = queries.summary(StockItemFilter.none());

        assertThat(summary.totalStockValue()).isNull();
        assertThat(summary.physicalStockUnits()).isEqualByComparingTo("4");
        assertThat(queries.detail(id).stockValue()).isNull();
    }

    @Test
    @DisplayName("A genuine zero value is zero, and is distinguishable from withheld")
    void genuineZeroIsZero() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW, ProductPermissions.STOCK_ITEM_MANAGE,
                ProductPermissions.VALUATION_VIEW);
        createItem("SKU-ZERO", "No movements");

        StockItemSummary summary = queries.summary(StockItemFilter.none());
        assertThat(summary.totalStockValue()).isNotNull().isEqualByComparingTo("0");
    }

    // ================================================================= filters and search

    @Test
    @DisplayName("Search covers technical name, Inventory SKU and barcode only")
    void searchCoversCanonicalIdentifiers() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW, ProductPermissions.STOCK_ITEM_MANAGE);
        createItem("SKU-FIND", "Kingston Fury 16GB");

        assertThat(queries.list(new StockItemFilter("fury", null, null, null, null, null, false),
                PageRequest.of(0, 10))).hasSize(1);
        assertThat(queries.list(new StockItemFilter("SKU-FIND", null, null, null, null, null, false),
                PageRequest.of(0, 10))).hasSize(1);
        assertThat(queries.list(new StockItemFilter("0012345", null, null, null, null, null, false),
                PageRequest.of(0, 10))).hasSize(1);
        assertThat(queries.list(new StockItemFilter("nonexistent", null, null, null, null, null, false),
                PageRequest.of(0, 10))).isEmpty();
    }

    @Test
    @DisplayName("The Out-of-Stock filter uses the same predicate as the summary")
    void outOfStockFilterMatchesSummary() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW, ProductPermissions.STOCK_ITEM_MANAGE);
        UUID stocked = createItem("SKU-IN", "In stock");
        createItem("SKU-OUT", "Out of stock");
        recordMovement(stocked, "GOODS_RECEIPT_ACCEPTED", new BigDecimal("3"), new BigDecimal("10"));

        StockItemFilter filter = new StockItemFilter(null, null, null, null, null, null, true);
        assertThat(queries.list(filter, PageRequest.of(0, 10)).getContent())
                .extracting(StockItemView::inventorySku).containsExactly("SKU-OUT");
        assertThat(queries.summary(filter).outOfStockItems()).isEqualTo(1);
        assertThat(queries.summary(StockItemFilter.none()).outOfStockItems()).isEqualTo(1);
    }

    // ================================================================= CSV

    @Test
    @DisplayName("PRD-149 — export emits the canonical header order")
    void exportHeaderOrder() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW, ProductPermissions.VALUATION_VIEW);
        String out = csv.export(StockItemFilter.none());
        assertThat(out.lines().findFirst()).hasValue(String.join(",", StockItemCsvService.HEADERS_WITH_COST));
    }

    @Test
    @DisplayName("🔴 PRD-153 — the cost column is OMITTED, not blanked, without authority")
    void costColumnIsOmittedNotBlanked() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW);
        String header = csv.export(StockItemFilter.none()).lines().findFirst().orElseThrow();

        assertThat(header).isEqualTo(String.join(",", StockItemCsvService.HEADERS_WITHOUT_COST));
        assertThat(header).doesNotContain("weighted_average_cost");
    }

    @Test
    @DisplayName("🔴 Export scope is the active filter, never the visible page")
    void exportIsNotPaginated() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW, ProductPermissions.STOCK_ITEM_MANAGE);
        for (int i = 0; i < 5; i++) {
            createItem("SKU-E-" + i, "Export " + i);
        }
        assertThat(csv.export(StockItemFilter.none()).lines().count()).isEqualTo(6); // header + 5
    }

    @Test
    @DisplayName("API-059 — a formula-triggering value is neutralised reversibly on export")
    void formulaInjectionIsNeutralised() {
        assertThat(StockItemCsvService.text("=cmd()")).startsWith("'=");
        assertThat(StockItemCsvService.unprotect("'=cmd()")).isEqualTo("=cmd()");
        assertThat(StockItemCsvService.text("safe,value")).isEqualTo("\"safe,value\"");
    }

    @Test
    @DisplayName("API-058 — decimals are plain text with no separators, and absent is empty not zero")
    void decimalSerialisation() {
        assertThat(StockItemCsvService.decimal(new BigDecimal("32500.00"))).isEqualTo("32500.00");
        assertThat(StockItemCsvService.decimal(null)).isEmpty();
    }

    @Test
    @DisplayName("The template carries headers only — no fabricated example row")
    void templateHasNoSampleData() {
        assertThat(csv.template().lines().count()).isEqualTo(1);
    }

    @Test
    @DisplayName("🔴 A read-only column carrying a value is an ERROR, never a silent ignore")
    void readOnlyColumnsAreRefused() {
        actingWith(ProductPermissions.STOCK_ITEM_MANAGE, ProductPermissions.STOCK_ITEM_VIEW);
        for (String column : List.of("physical_stock", "available_quantity", "weighted_average_cost")) {
            String file = "inventory_sku,technical_name,unit_of_measure," + column + "\r\n"
                    + "SKU-RO,Item,pcs,50\r\n";
            var plan = csv.validate(file);
            assertThat(plan.errorCount()).as(column).isEqualTo(1);
            assertThat(plan.outcomes().getFirst().message()).contains("read-only");
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movement", Long.class)).isZero();
    }

    @Test
    @DisplayName("🔴 Validation writes nothing; only confirmation does")
    void validationWritesNothing() {
        actingWith(ProductPermissions.STOCK_ITEM_MANAGE, ProductPermissions.STOCK_ITEM_VIEW);
        var plan = csv.validate("inventory_sku,technical_name,unit_of_measure\r\nSKU-NEW,New item,pcs\r\n");

        assertThat(plan.errorCount()).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM product_variant", Long.class)).isZero();

        csv.confirm(plan.planId());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM product_variant", Long.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("Import creates and updates by canonical identifier, never by name")
    void importCreatesAndUpdates() {
        actingWith(ProductPermissions.STOCK_ITEM_MANAGE, ProductPermissions.STOCK_ITEM_VIEW);
        createItem("SKU-UPD", "Original name");

        var plan = csv.validate("""
                inventory_sku,technical_name,unit_of_measure
                SKU-UPD,Renamed item,pcs
                SKU-CRE,Created item,pcs
                """);
        assertThat(plan.errorCount()).isZero();

        var result = csv.confirm(plan.planId());
        assertThat(result.created()).isEqualTo(1);
        assertThat(result.updated()).isEqualTo(1);
        assertThat(result.outcomes()).hasSize(2);
    }

    @Test
    @DisplayName("A duplicate SKU within one file is a row error naming the row")
    void duplicateSkuInFileIsRejected() {
        actingWith(ProductPermissions.STOCK_ITEM_MANAGE, ProductPermissions.STOCK_ITEM_VIEW);
        var plan = csv.validate("""
                inventory_sku,technical_name,unit_of_measure
                SKU-DUP,First,pcs
                SKU-DUP,Second,pcs
                """);
        assertThat(plan.errorCount()).isEqualTo(1);
        assertThat(plan.outcomes().get(1).rowNumber()).isEqualTo(3);
        assertThat(plan.outcomes().get(1).message()).contains("Duplicate");
    }

    @Test
    @DisplayName("🔴 A confirmed import is idempotent — the plan cannot be replayed")
    void confirmationIsIdempotent() {
        actingWith(ProductPermissions.STOCK_ITEM_MANAGE, ProductPermissions.STOCK_ITEM_VIEW);
        var plan = csv.validate("inventory_sku,technical_name,unit_of_measure\r\nSKU-ONCE,Once,pcs\r\n");
        csv.confirm(plan.planId());

        assertThatThrownBy(() -> csv.confirm(plan.planId()))
                .isInstanceOf(StockItemValidationException.class);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM product_variant", Long.class)).isEqualTo(1);
    }

    @Test
    @DisplayName("🔴 Import never creates a movement, a reservation or opening stock")
    void importCreatesNoStock() {
        actingWith(ProductPermissions.STOCK_ITEM_MANAGE, ProductPermissions.STOCK_ITEM_VIEW);
        var plan = csv.validate("inventory_sku,technical_name,unit_of_measure\r\nSKU-NOSTOCK,Item,pcs\r\n");
        csv.confirm(plan.planId());

        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM inventory_movement", Long.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM stock_reservation", Long.class)).isZero();
    }

    @Test
    @DisplayName("Import requires manage authority")
    void importRequiresManage() {
        actingWith(ProductPermissions.STOCK_ITEM_VIEW);
        assertThatThrownBy(() -> csv.validate("inventory_sku\r\nSKU-A\r\n"))
                .isInstanceOf(AccessDeniedByPermissionException.class);
    }

    @Test
    @DisplayName("An invalid enum value is a row error naming the field and the allowed values")
    void invalidEnumIsRejected() {
        actingWith(ProductPermissions.STOCK_ITEM_MANAGE, ProductPermissions.STOCK_ITEM_VIEW);
        var plan = csv.validate("""
                inventory_sku,technical_name,unit_of_measure,record_status
                SKU-ENUM,Item,pcs,NOT_A_STATUS
                """);
        assertThat(plan.errorCount()).isEqualTo(1);
        assertThat(plan.outcomes().getFirst().field()).isEqualTo("record_status");
        assertThat(plan.outcomes().getFirst().message()).contains("ACTIVE");
    }

    @Test
    @DisplayName("A duplicate header is refused before any row is considered")
    void duplicateHeaderRefused() {
        actingWith(ProductPermissions.STOCK_ITEM_MANAGE, ProductPermissions.STOCK_ITEM_VIEW);
        assertThatThrownBy(() -> csv.validate("inventory_sku,inventory_sku\r\nA,B\r\n"))
                .isInstanceOf(StockItemValidationException.class)
                .hasMessageContaining("Duplicate column");
    }

    @Test
    @DisplayName("Import attributes every write to the acting profile at write time")
    void importAttributesWrites() {
        actingWith(ProductPermissions.STOCK_ITEM_MANAGE, ProductPermissions.STOCK_ITEM_VIEW);
        var plan = csv.validate("inventory_sku,technical_name,unit_of_measure\r\nSKU-ATTR,Item,pcs\r\n");
        csv.confirm(plan.planId());

        UUID recorded = jdbc.queryForObject(
                "SELECT created_by FROM product_variant WHERE inventory_sku = 'SKU-ATTR'", UUID.class);
        assertThat(recorded).isEqualTo(actorId);
    }
}
