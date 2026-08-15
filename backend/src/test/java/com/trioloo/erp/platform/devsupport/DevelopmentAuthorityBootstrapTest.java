package com.trioloo.erp.platform.devsupport;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Production-safety guards for the development authority bootstrap.
 *
 * <p>🔴 These tests exist to prove a NEGATIVE: that a convenience built for local review
 * cannot reach production, and that nothing in the security model was loosened to provide it.
 */
@SpringBootTest
class DevelopmentAuthorityBootstrapTest {

    @Autowired private ApplicationContext context;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;

    @Test
    @DisplayName("🔴 The bootstrap is ABSENT by default — no test depends on it")
    void beanIsNotActiveWithoutTheProfile() {
        assertThat(context.getBeanNamesForType(DevelopmentAuthorityBootstrap.class))
                .as("the dev-authority profile is not active in tests")
                .isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = { "prod", "production", "prod-eu", "live", "staging", "PRODUCTION" })
    @DisplayName("🔴 It REFUSES to run under anything resembling a production profile")
    void refusesUnderProductionProfiles(String profile) {
        assertThatThrownBy(() -> DevelopmentAuthorityBootstrap.refuseUnderProduction(new String[] { profile }))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("never run alongside a production profile");
    }

    @Test
    @DisplayName("It permits ordinary local profiles")
    void permitsLocalProfiles() {
        assertThatCode(() -> DevelopmentAuthorityBootstrap.refuseUnderProduction(
                new String[] { "dev-authority", "local" })).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("LOCAL DEV identity provisioning is idempotent and repairs a stale credential")
    void provisionsTheDesignatedDevelopmentIdentityIdempotently() {
        String username = "devuser";
        String password = "local-secret-for-test";
        ensurePermissionCatalogue();
        removeDevelopmentIdentity(username);

        var bootstrap = bootstrap(username, password);
        bootstrap.provisionDevelopmentIdentity();
        var first = bootstrap.snapshot(username);

        assertThat(first.profileRows()).isEqualTo(1);
        assertThat(first.credentialRows()).isEqualTo(1);
        assertThat(first.lifecycleState()).isEqualTo("ACTIVE");
        assertThat(passwordEncoder.matches(password, first.passwordHash())).isTrue();
        assertThat(first.definedPermissions()).isGreaterThan(0);
        assertThat(first.activeGrantOverrides()).isEqualTo(first.definedPermissions());

        jdbc.update("UPDATE user_credential SET password_hash = ?, updated_at = now() WHERE user_id = ?",
                passwordEncoder.encode("stale-local-secret"), first.userId());

        bootstrap.provisionDevelopmentIdentity();
        var second = bootstrap.snapshot(username);

        assertThat(second.userId()).isEqualTo(first.userId());
        assertThat(second.profileRows()).isEqualTo(1);
        assertThat(second.credentialRows()).isEqualTo(1);
        assertThat(second.overrideRows()).isEqualTo(first.overrideRows());
        assertThat(second.activeGrantOverrides()).isEqualTo(second.definedPermissions());
        assertThat(passwordEncoder.matches(password, second.passwordHash())).isTrue();
    }

    @Test
    @DisplayName("Provisioning fails closed when enabled without a local password")
    void enabledProvisioningRequiresALocalPassword() {
        var environment = new MockEnvironment()
                .withProperty(DevelopmentAuthorityBootstrap.ENABLED_PROPERTY, "true")
                .withProperty(DevelopmentAuthorityBootstrap.USERNAME_PROPERTY, "devuser");
        environment.setActiveProfiles(DevelopmentAuthorityBootstrap.PROFILE);

        var bootstrap = new DevelopmentAuthorityBootstrap(jdbc, environment, passwordEncoder);

        assertThatThrownBy(bootstrap::provisionDevelopmentIdentity)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(DevelopmentAuthorityBootstrap.PASSWORD_PROPERTY);
    }

    @Test
    @DisplayName("🔴 NO WILDCARD PERMISSION EXISTS — full access is many real grants, never one star")
    void noWildcardPermissionExists() {
        ensurePermissionCatalogue();
        var codes = jdbc.queryForList("SELECT code FROM permission", String.class);
        assertThat(codes).noneSatisfy(code -> assertThat(code).containsAnyOf("*", "all", "superuser", "admin.all"));
    }

    private DevelopmentAuthorityBootstrap bootstrap(String username, String password) {
        var environment = new MockEnvironment()
                .withProperty(DevelopmentAuthorityBootstrap.ENABLED_PROPERTY, "true")
                .withProperty(DevelopmentAuthorityBootstrap.USERNAME_PROPERTY, username)
                .withProperty(DevelopmentAuthorityBootstrap.PASSWORD_PROPERTY, password);
        environment.setActiveProfiles(DevelopmentAuthorityBootstrap.PROFILE);
        return new DevelopmentAuthorityBootstrap(jdbc, environment, passwordEncoder);
    }

    private void ensurePermissionCatalogue() {
        ensurePermission("product.read", "Product read access");
        ensurePermission("inventory.read", "Inventory read access");
        ensurePermission("warehouse.read", "Warehouse read access");
    }

    private void ensurePermission(String code, String description) {
        jdbc.update("""
                INSERT INTO permission (id, code, description)
                SELECT gen_random_uuid(), ?, ?
                 WHERE NOT EXISTS (SELECT 1 FROM permission WHERE code = ?)
                """, code, description, code);
    }

    private void removeDevelopmentIdentity(String username) {
        jdbc.update("""
                DELETE FROM user_permission_override
                 WHERE user_id IN (SELECT id FROM operational_user_profile WHERE username = ?)
                """, username);
        jdbc.update("""
                DELETE FROM user_role
                 WHERE user_id IN (SELECT id FROM operational_user_profile WHERE username = ?)
                """, username);
        jdbc.update("""
                DELETE FROM user_scope_assignment
                 WHERE user_id IN (SELECT id FROM operational_user_profile WHERE username = ?)
                """, username);
        jdbc.update("""
                DELETE FROM user_credential
                 WHERE user_id IN (SELECT id FROM operational_user_profile WHERE username = ?)
                """, username);
        jdbc.update("DELETE FROM operational_user_profile WHERE username = ?", username);
    }

    /**
     * 🔴 Asserts against the migration SOURCE rather than the live tables.
     *
     * <p>Table counts would be order-dependent — another test class legitimately creates
     * identities — and would prove nothing about what production runs. The migrations are what
     * production actually executes, so they are what this assertion reads.
     */
    @Test
    @DisplayName("🔴 No production migration grants a permission, creates an identity or a credential")
    void migrationsGrantNothingAndCreateNoIdentity() throws Exception {
        var migrations = java.nio.file.Path.of("src/main/resources/db/migration");
        try (var files = java.nio.file.Files.list(migrations)) {
            for (java.nio.file.Path file : files.toList()) {
                String sql = java.nio.file.Files.readString(file).toLowerCase(java.util.Locale.ROOT);

                // Defining a permission is legitimate catalogue configuration. GRANTING one,
                // or creating an identity to hold it, would be the bootstrap that
                // GAP-120/121/122 leave deliberately unanswered.
                assertThat(sql).as("%s must not grant a permission to a role", file.getFileName())
                        .doesNotContain("insert into role_permission");
                assertThat(sql).as("%s must not grant a permission override", file.getFileName())
                        .doesNotContain("insert into user_permission_override");
                assertThat(sql).as("%s must not assign a role", file.getFileName())
                        .doesNotContain("insert into user_role");
                assertThat(sql).as("%s must not create an identity", file.getFileName())
                        .doesNotContain("insert into operational_user_profile");
                assertThat(sql).as("%s must not create a credential", file.getFileName())
                        .doesNotContain("insert into user_credential");
            }
        }
    }
}
