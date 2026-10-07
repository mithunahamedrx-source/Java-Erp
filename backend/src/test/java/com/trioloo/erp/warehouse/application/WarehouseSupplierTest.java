package com.trioloo.erp.warehouse.application;

import com.trioloo.erp.access.AccessFixtures;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.procurement.application.SupplierService;
import com.trioloo.erp.product.application.AccessDeniedByPermissionException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Warehouses, Stock Locations and Suppliers - master data, capability-gated, never deleted. Isolated test DB only. */
@SpringBootTest
class WarehouseSupplierTest {

    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private WarehouseService warehouses;
    @Autowired private StockLocationService locations;
    @Autowired private SupplierService suppliers;
    @Autowired private com.trioloo.erp.procurement.application.SupplierLedgerService ledgers;

    private UUID actorId;

    @BeforeEach
    void setUp() {
        var fixtures = new AccessFixtures(jdbc, passwordEncoder);
        fixtures.clear();
        actorId = fixtures.createProfile("wh-tester", "x", AccountLifecycleState.ACTIVE);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        jdbc.update("DELETE FROM stock_location");
        jdbc.update("DELETE FROM warehouse");
        jdbc.update("DELETE FROM supplier");
    }

    private void actingWith(String... permissions) {
        var principal = new com.trioloo.erp.access.infrastructure.security.AccessUserDetails(
                actorId, "wh-tester", "WH Tester", "unused", AccountLifecycleState.ACTIVE, Set.of(), Set.of(permissions));
        SecurityContextHolder.getContext().setAuthentication(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                principal, null, Arrays.stream(permissions).map(SimpleGrantedAuthority::new).toList()));
    }

    private static final String[] ALL = {WarehouseService.VIEW, WarehouseService.MANAGE, StockLocationService.VIEW,
            StockLocationService.MANAGE, SupplierService.VIEW, SupplierService.MANAGE};

    private UUID mainWarehouse() {
        return warehouses.create(new WarehouseService.Input("wh-main", "Main Warehouse", "Dhanmondi 7A", null, null));
    }

    @Test
    @DisplayName("Viewing never implies managing; no capability sees nothing")
    void capabilitiesAreIndependent() {
        actingWith(WarehouseService.VIEW, StockLocationService.VIEW, SupplierService.VIEW);
        assertThatThrownBy(() -> warehouses.create(new WarehouseService.Input("WH-X", "X", null, null, null)))
                .isInstanceOf(AccessDeniedByPermissionException.class);
        assertThatThrownBy(() -> suppliers.create(supplier("Nope"))).isInstanceOf(AccessDeniedByPermissionException.class);
        assertThat(warehouses.list(null, null, 0, 10).content()).isEmpty();

        actingWith();
        assertThatThrownBy(() -> warehouses.list(null, null, 0, 10)).isInstanceOf(AccessDeniedByPermissionException.class);
        assertThatThrownBy(() -> suppliers.list(null, null, null, null, null, 0, 10)).isInstanceOf(AccessDeniedByPermissionException.class);
        assertThatThrownBy(() -> locations.list(null, null, null, null, null, 0, 10)).isInstanceOf(AccessDeniedByPermissionException.class);
    }

    @Test
    @DisplayName("A warehouse is created with an upper-case unique identifier, and listed with its location counts")
    void warehouseLifecycle() {
        actingWith(ALL);
        UUID id = mainWarehouse();
        var page = warehouses.list(null, null, 0, 10);
        assertThat(page.content()).singleElement().satisfies(w -> {
            assertThat(w.identifier()).isEqualTo("WH-MAIN");
            assertThat(w.address()).isEqualTo("Dhanmondi 7A");
            assertThat(w.recordStatus()).isEqualTo("ACTIVE");
            assertThat(w.locations()).isZero();
        });
        assertThat(page.kpis().warehouses()).isEqualTo(1);

        assertThatThrownBy(() -> warehouses.create(new WarehouseService.Input("wh-main", "Again", null, null, null)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("already exists");
        assertThatThrownBy(() -> warehouses.create(new WarehouseService.Input("bad id!", "X", null, null, null)))
                .isInstanceOf(IllegalArgumentException.class);

        long version = warehouses.list(null, null, 0, 10).content().getFirst().version();
        warehouses.update(id, new WarehouseService.Input(null, "Main Warehouse, Dhanmondi", "Dhanmondi 7A", "ARCHIVED", version));
        assertThat(warehouses.list(null, "ARCHIVED", 0, 10).content()).hasSize(1);
        assertThat(warehouses.list(null, "ACTIVE", 0, 10).content()).isEmpty();
        // A stale version is refused, not silently overwritten.
        assertThatThrownBy(() -> warehouses.update(id, new WarehouseService.Input(null, "Late", null, "ACTIVE", version)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("changed by someone else");
    }

    @Test
    @DisplayName("Sellability follows the type: only Storage is sellable, Quarantine never; the database refuses any other pairing")
    void locationSellabilityFollowsTheType() {
        actingWith(ALL);
        UUID wh = mainWarehouse();
        locations.create(new StockLocationService.Input(wh, "main-storage-a", "General storage", "STORAGE", null, null));
        locations.create(new StockLocationService.Input(wh, "MAIN-QUARANTINE", "Returned goods pending QC", "quarantine", null, null));
        locations.create(new StockLocationService.Input(wh, "MAIN-STAGING", null, "Staging", null, null));

        var all = locations.list(null, null, null, null, null, 0, 10);
        assertThat(all.content()).extracting(StockLocationService.Row::identifier, StockLocationService.Row::sellable)
                .containsExactlyInAnyOrder(org.assertj.core.groups.Tuple.tuple("MAIN-STORAGE-A", true),
                        org.assertj.core.groups.Tuple.tuple("MAIN-QUARANTINE", false), org.assertj.core.groups.Tuple.tuple("MAIN-STAGING", false));
        assertThat(all.kpis().storage()).isEqualTo(1);
        assertThat(all.kpis().quarantine()).isEqualTo(1);
        assertThat(locations.list(null, null, null, true, null, 0, 10).content()).hasSize(1);
        assertThat(warehouses.list(null, null, 0, 10).content().getFirst().quarantineLocations()).isEqualTo(1);

        // INV-5.2 / WHS-008 - the flag cannot be set against the type, even by a direct write.
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO stock_location (warehouse_id, identifier, location_type, sellable, created_by, updated_by)
                VALUES (?, 'BAD-Q', 'QUARANTINE', true, ?, ?)
                """, wh, actorId, actorId)).isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> locations.create(new StockLocationService.Input(wh, "main-storage-a", null, "STORAGE", null, null)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("already exists");
        assertThatThrownBy(() -> locations.create(new StockLocationService.Input(wh, "X1", null, "SHELF", null, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("An archived warehouse takes no new location, and a location's type is fixed after creation")
    void archivedWarehouseAndFixedType() {
        actingWith(ALL);
        UUID wh = mainWarehouse();
        UUID loc = locations.create(new StockLocationService.Input(wh, "Q-1", null, "QUARANTINE", null, null));
        long version = locations.list(null, null, null, null, null, 0, 10).content().getFirst().version();
        // The update shape has no way to change the type: only description and status move.
        locations.update(loc, new StockLocationService.Input(null, null, "Held for QC", "STORAGE", "ACTIVE", version));
        assertThat(locations.list(null, null, null, null, null, 0, 10).content().getFirst())
                .satisfies(l -> {
                    assertThat(l.locationType()).isEqualTo("QUARANTINE");
                    assertThat(l.sellable()).isFalse();
                    assertThat(l.description()).isEqualTo("Held for QC");
                });

        long whVersion = warehouses.list(null, null, 0, 10).content().getFirst().version();
        warehouses.update(wh, new WarehouseService.Input(null, "Main Warehouse", null, "ARCHIVED", whVersion));
        assertThatThrownBy(() -> locations.create(new StockLocationService.Input(wh, "Q-2", null, "QUARANTINE", null, null)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("not active");
    }

    @Test
    @DisplayName("The supplier ledger is a view: no money line exists before receipts and payments, and the balance is withheld, not zero")
    void supplierLedgerIsAView() {
        actingWith(ALL);
        UUID id = suppliers.create(supplier("Ledger Supplier"));
        var ledger = ledgers.ledger(id, null, null, null);
        assertThat(ledger.supplier().name()).isEqualTo("Ledger Supplier");
        assertThat(ledger.entries()).isEmpty();
        assertThat(ledger.outstandingBalance()).isNull();
        assertThat(ledgers.ledger(id, java.time.LocalDate.of(2026, 1, 1), java.time.LocalDate.of(2026, 1, 31), "PURCHASE_ORDER").entries()).isEmpty();
        assertThatThrownBy(() -> ledgers.ledger(UUID.randomUUID(), null, null, null)).isInstanceOf(IllegalArgumentException.class);
        actingWith();
        assertThatThrownBy(() -> ledgers.ledger(id, null, null, null)).isInstanceOf(AccessDeniedByPermissionException.class);
    }

    private static SupplierService.Input supplier(String name) {
        return new SupplierService.Input(name, "Ashraful Alam", "01711-204488", "a@example.test", "Dhaka", null, "REF-1", null, null, null, null);
    }

    @Test
    @DisplayName("A supplier is a simple party record: unique name, BDT by default, ordered active period, searchable, archived never deleted")
    void supplierLifecycle() {
        actingWith(ALL);
        UUID id = suppliers.create(supplier("Star Tech Ltd"));
        var row = suppliers.list(null, null, null, null, null, 0, 10).content().getFirst();
        assertThat(row.currency()).isEqualTo("BDT");
        assertThat(row.recordStatus()).isEqualTo("ACTIVE");

        assertThatThrownBy(() -> suppliers.create(supplier("star tech ltd"))).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> suppliers.create(new SupplierService.Input("X", null, null, null, null, "taka", null, null, null, null, null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> suppliers.create(new SupplierService.Input("Y", null, null, null, null, null, null,
                LocalDate.of(2026, 5, 1), LocalDate.of(2026, 1, 1), null, null))).isInstanceOf(IllegalArgumentException.class);

        suppliers.create(supplier("Ryans Computers"));
        assertThat(suppliers.list("01711", null, null, null, null, 0, 10).content()).hasSize(2);
        assertThat(suppliers.list("ryans", null, null, null, null, 0, 10).content()).extracting(SupplierService.Row::name).containsExactly("Ryans Computers");

        suppliers.update(id, new SupplierService.Input("Star Tech Ltd", "Ashraful Alam", "01711-204488", null, "Dhaka", "usd", null, null, null,
                "ARCHIVED", row.version()));
        assertThat(suppliers.list(null, "ARCHIVED", null, null, null, 0, 10).content()).singleElement().satisfies(s -> assertThat(s.currency()).isEqualTo("USD"));
        assertThat(suppliers.list(null, null, null, null, null, 0, 10).kpis().archived()).isEqualTo(1);

        // Filters by currency, purchase activity and period; the strip follows them. No order exists, so purchase is zero and
        // the due is withheld (null) until payables exist.
        assertThat(suppliers.list(null, null, "USD", null, null, 0, 10).content()).hasSize(1);
        assertThat(suppliers.list(null, null, null, "without-orders", "month", 0, 10).content()).hasSize(2);
        assertThat(suppliers.list(null, null, null, "with-orders", "week", 0, 10).content()).isEmpty();
        var strip = suppliers.list(null, null, null, null, "today", 0, 10).kpis();
        assertThat(strip.totalPurchase()).isEqualByComparingTo("0");
        assertThat(strip.totalDue()).isNull();
    }

    @Test
    @DisplayName("Lists page ten at a time")
    void pagesTenAtATime() {
        actingWith(ALL);
        for (int i = 0; i < 12; i++) {
            suppliers.create(supplier("Supplier %02d".formatted(i)));
        }
        var first = suppliers.list(null, null, null, null, null, 0, 10);
        assertThat(first.content()).hasSize(10);
        assertThat(first.totalElements()).isEqualTo(12);
        assertThat(first.totalPages()).isEqualTo(2);
        assertThat(suppliers.list(null, null, null, null, null, 1, 10).content()).hasSize(2);
    }
}
