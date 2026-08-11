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
     * <p>Step 1 asserted zero tables. Step 2 authorised exactly the access-identity and
     * authority tables below and nothing else — no Product, Inventory, Order, Accounting,
     * Payroll or Customer table exists.
     *
     * <p>This deliberately lists the permitted set rather than counting, so that a later
     * change which quietly adds a business table without its owning module fails here.
     */
    @Test
    void onlyAuthorisedAccessTablesExist() {
        var jdbc = new JdbcTemplate(dataSource);
        var tables = jdbc.queryForList(
                "SELECT table_name FROM information_schema.tables "
                        + "WHERE table_schema = 'public' AND table_name <> 'flyway_schema_history' "
                        + "ORDER BY table_name",
                String.class);

        assertThat(tables).containsExactlyInAnyOrder(
                "operational_user_profile",
                "user_credential",
                "permission",
                "role",
                "role_permission",
                "user_role",
                "user_permission_override",
                "user_scope_assignment");
    }
}
