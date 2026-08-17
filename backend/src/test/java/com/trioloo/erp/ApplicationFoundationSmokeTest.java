package com.trioloo.erp;

import static org.assertj.core.api.Assertions.assertThat;

import com.trioloo.erp.platform.time.TimeZoneConfiguration;
import java.time.Clock;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Foundation smoke test.
 *
 * <p>Proves the three things Step 1 claims: the context starts, the canonical timezone is
 * in force, and Flyway reached the authoritative database.
 *
 * <p>Requires a running PostgreSQL and the environment described in
 * {@code backend/.env.example}. It is a real connectivity test by design - an in-memory
 * substitute would prove nothing about {@code TEC 1.2}'s locked engine.
 */
@SpringBootTest
class ApplicationFoundationSmokeTest {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private Clock businessClock;

    /** The Spring context starts and the datasource is wired. */
    @Test
    void applicationContextStarts() {
        assertThat(dataSource).isNotNull();
    }

    /** TEC-050 - the canonical business timezone is Asia/Dhaka. */
    @Test
    void businessClockUsesCanonicalTimezone() {
        assertThat(businessClock.getZone()).isEqualTo(TimeZoneConfiguration.BUSINESS_ZONE);
        assertThat(TimeZoneConfiguration.BUSINESS_ZONE.getId()).isEqualTo("Asia/Dhaka");
    }

    /** TEC 1.2 - the database is reachable, and it is PostgreSQL. */
    @Test
    void authoritativeDatabaseIsReachablePostgres() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
        }
    }

    /** PRJ-080 - Flyway owns schema evolution, and the baseline migration was applied. */
    @Test
    void flywayBaselineHasBeenApplied() {
        var jdbc = new JdbcTemplate(dataSource);
        Integer applied = jdbc.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE success = true", Integer.class);
        assertThat(applied).isNotNull().isPositive();
    }

    /**
     * Schema tripwire.
     *
     * <p>Step 1 asserted zero tables. Step 2 authorised the access-identity and authority
     * tables. Stage P1 authorised exactly three more — {@code E-020} and the minimum Inventory
     * position foundation — and nothing else.
     *
     * <p>This deliberately lists the permitted set rather than counting, so that a later
     * change which quietly adds a business table without its owning module fails here.
     * 🔴 It caught P1's own migration on the first run, which is the point: extending the list
     * is a deliberate act, and no table reaches the schema without one.
     */
    @Test
    void onlyAuthorisedTablesExist() {
        var jdbc = new JdbcTemplate(dataSource);
        var tables = jdbc.queryForList(
                "SELECT table_name FROM information_schema.tables "
                        + "WHERE table_schema = 'public' AND table_name <> 'flyway_schema_history' "
                        + "ORDER BY table_name",
                String.class);

        assertThat(tables).containsExactlyInAnyOrder(
                // Step 2 — access identity and authority.
                "operational_user_profile",
                "user_credential",
                "permission",
                "role",
                "role_permission",
                "user_role",
                "user_permission_override",
                "user_scope_assignment",
                // Stage P1 — Product E-020 plus the minimum Inventory position foundation.
                "product_variant",
                "inventory_movement",
                "stock_reservation",
                // Stage P2 — Product E-058 plus the reusable build definition and bundle
                // membership. 🔴 Extending this list is a deliberate act: each of these four
                // is a canonical Product-owned entity, and NONE of them holds a quantity.
                "sellable_product",
                "build_template",
                "bom_line",
                "bundle_member",
                "channel_instance",
                "channel_listing",
                // Stage P3 — the connected Listings feature. 🔴 Each is a canonical
                // Product-owned entity and NONE of them stores a derived position: the
                // unsent-change condition, the mapping state and every batch tally are
                // computed at read time ({@code DB-001}, {@code INV-108.2}).
                "channel_listing_sku",            // E-106 the ORDERABLE and mapping unit
                "channel_listing_attribute",      // neutral channel attributes (PRD-192)
                "channel_listing_intended_media", // the listing's own media override
                "channel_listing_reported_media", // mirrored external references (PRD-182.b)
                "channel_listing_operation",      // E-107 one act against one listing
                "channel_listing_operation_batch",// E-108 the grouping of those acts
                "channel_listing_activity",       // PRD-129 activity, NOT an audit log
                "channel_adapter_capability",     // per-INSTANCE field capability (PRD-125)
                "media_asset",                    // E-105
                "sellable_product_media",           // the master media set media falls back to
                // PRD-198 - a Listing's OWN ordered, channel-facing highlights. 🔴 It holds
                // only what was authored FOR this listing; the Sellable Product master set is
                // never copied in, so absence here is what makes the fallback derivable.
                "channel_listing_highlight",
                /*
                  Shops & Channels — the INTEGRATION-owned connection condition ({@code
                  API-068}). 🔴 A deliberate addition, and the only table V11 creates: the
                  shop record itself reuses {@code channel_instance}, because {@code
                  DM-084.a} forbids a second concept for the same thing.
                  🔴 It stores a condition and an observation time and NO CREDENTIAL of any
                  kind ({@code API-070}).
                */
                "channel_connection",

                // V14 — Integration-owned provider authorisation storage (TEC-119, TEC-120).
                // 🔴 Ciphertext and a one-time callback correlation. Neither holds a business
                // fact, and neither may ever be projected through a business API (API-070).
                "channel_credential",
                "channel_authorisation_attempt");
    }

    /**
     * 🔴 The sellable layer holds no stock and no availability ({@code INV-58.1},
     * {@code INV-58.4}, {@code PRD-023}).
     *
     * <p>A companion to {@link #noStoredStockBalanceOrValuationColumnExists}: that guard names
     * the INVENTORY vocabulary, this one names the SELLABLE vocabulary a UI convenience would
     * most plausibly introduce. Deriving availability on every read is the whole point, and a
     * cache here would be a second, drifting answer.
     */
    @Test
    void sellableLayerStoresNoAvailabilityOrCommercialFigure() {
        var jdbc = new JdbcTemplate(dataSource);
        var columns = jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns "
                        + "WHERE table_schema = 'public' "
                        + "AND table_name IN ('sellable_product', 'bundle_member', 'build_template', "
                        + "'bom_line')",
                String.class);

        assertThat(columns).noneSatisfy(column -> assertThat(column.toLowerCase()).containsAnyOf(
                // 🔴 Derived availability is never stored (INV-58.4).
                "sellable_stock", "buildable", "ready_built", "bundle_stock", "available",
                // 🔴 Channel price belongs to E-059 (PRD-029); cost and margin to neither.
                "channel_price", "marketplace_price", "daraz_price", "website_price",
                "selling_price", "margin", "profit", "cost",
                // 🔴 No count whose basis is undefined (UX-037.f, PRD-150).
                "listing_count"));
    }

    /**
     * 🔴 The load-bearing schema guard: no module may acquire a stored stock balance.
     *
     * <p>{@code DB-001} / {@code IVN-002} — every quantity and every valuation is derived from
     * movements. A column matching any of these names would make a second copy of a figure
     * that already exists, which is exactly the failure those rules prohibit.
     */
    @Test
    void noStoredStockBalanceOrValuationColumnExists() {
        var jdbc = new JdbcTemplate(dataSource);
        var columns = jdbc.queryForList(
                "SELECT table_name || '.' || column_name FROM information_schema.columns "
                        + "WHERE table_schema = 'public'",
                String.class);

        assertThat(columns).noneSatisfy(column -> assertThat(column.toLowerCase()).containsAnyOf(
                "stock_quantity", "current_stock", "current_balance", "on_hand",
                "physical_balance", "stock_balance", "available_balance", "quantity_on_hand",
                "stock_value", "inventory_value", "total_stock_value", "cached_", "out_of_stock"));
    }
}
