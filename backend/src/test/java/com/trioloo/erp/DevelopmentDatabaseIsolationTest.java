package com.trioloo.erp;

import static org.assertj.core.api.Assertions.assertThat;

import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Tripwire: automated tests must never run against the development database.
 *
 * <p>This exists because the two once shared a schema, and {@code AccessFixtures.clear()} —
 * which deletes every access row by design — erased the developer's own identity during a
 * live verification session. Configuration alone is not enough; developer discipline is not
 * enough. This test fails fast, before any destructive fixture can run.
 *
 * <p>It asserts on the database the {@link DataSource} actually connected to, not on the
 * configured URL, so an override anywhere in the property chain is still caught.
 */
@SpringBootTest
class DevelopmentDatabaseIsolationTest {

    /** The development database. Nothing in test scope may connect to it. */
    private static final String DEVELOPMENT_DATABASE = "trioloo_erp";

    /** The database integration tests are expected to use. */
    private static final String TEST_DATABASE = "trioloo_erp_test";

    @Autowired
    private DataSource dataSource;

    @Test
    void integrationTestsRunAgainstTheIsolatedTestDatabase() {
        String connectedDatabase = new JdbcTemplate(dataSource)
                .queryForObject("SELECT current_database()", String.class);

        assertThat(connectedDatabase)
                .as("Integration tests must not run against the development database. "
                        + "AccessFixtures.clear() is destructive and would erase development data.")
                .isNotEqualTo(DEVELOPMENT_DATABASE)
                .isEqualTo(TEST_DATABASE);
    }

    /**
     * The connection URL must not name the development database either.
     *
     * <p>Matched on the trailing database segment rather than a substring: "trioloo_erp_test"
     * literally contains "trioloo_erp", so a naive {@code doesNotContain} would fail even
     * when isolation is correct.
     */
    @Test
    void connectionUrlDoesNotPointAtTheDevelopmentDatabase() throws Exception {
        try (var connection = dataSource.getConnection()) {
            String url = connection.getMetaData().getURL();
            String database = url.substring(url.lastIndexOf('/') + 1).split("\\?")[0];

            assertThat(database)
                    .as("JDBC URL resolves to database '%s'", database)
                    .isNotEqualTo(DEVELOPMENT_DATABASE)
                    .isEqualTo(TEST_DATABASE);
        }
    }
}
