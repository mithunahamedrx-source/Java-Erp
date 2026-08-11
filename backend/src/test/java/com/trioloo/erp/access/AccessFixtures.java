package com.trioloo.erp.access;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * TEST-ONLY fixtures.
 *
 * <p>🔴 This class lives in test scope and is never packaged. It is not a bootstrap
 * mechanism, and it does NOT resolve {@code GAP-120}/{@code GAP-121}/{@code GAP-122} —
 * production still has no way to create a first Owner, which remains an open go-live
 * question the implementation must not answer.
 *
 * <p>Every identity here is created explicitly by a test that needs it. Nothing is seeded
 * on startup.
 */
public final class AccessFixtures {

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;

    public AccessFixtures(JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
    }

    /** Removes every access row so each test starts from an empty, unseeded system. */
    public void clear() {
        jdbc.update("DELETE FROM user_permission_override");
        jdbc.update("DELETE FROM user_scope_assignment");
        jdbc.update("DELETE FROM user_role");
        jdbc.update("DELETE FROM role_permission");
        jdbc.update("DELETE FROM user_credential");
        jdbc.update("DELETE FROM operational_user_profile");
        jdbc.update("DELETE FROM role");
        jdbc.update("DELETE FROM permission");
    }

    public UUID createProfile(String username, String rawPassword, AccountLifecycleState state) {
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        jdbc.update("""
                INSERT INTO operational_user_profile (id, username, full_name, lifecycle_state, created_at, activated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """, id, username, username + " (test)", state.name(), java.sql.Timestamp.from(now),
                state == AccountLifecycleState.ACTIVE ? java.sql.Timestamp.from(now) : null);

        jdbc.update("INSERT INTO user_credential (user_id, password_hash, updated_at) VALUES (?, ?, ?)",
                id, passwordEncoder.encode(rawPassword), java.sql.Timestamp.from(now));
        return id;
    }

    public UUID createPermission(String code) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO permission (id, code, description) VALUES (?, ?, ?)", id, code, code);
        return id;
    }

    public UUID createRole(String code) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO role (id, code, name) VALUES (?, ?, ?)", id, code, code);
        return id;
    }

    public void grantPermissionToRole(UUID roleId, UUID permissionId) {
        jdbc.update("INSERT INTO role_permission (role_id, permission_id) VALUES (?, ?)", roleId, permissionId);
    }

    public void assignRole(UUID userId, UUID roleId) {
        jdbc.update("INSERT INTO user_role (user_id, role_id) VALUES (?, ?)", userId, roleId);
    }

    public void addOverride(UUID userId, UUID permissionId, String direction, UUID grantedBy) {
        jdbc.update("""
                INSERT INTO user_permission_override
                    (id, user_id, permission_id, direction, override_type, status,
                     business_reason, granted_by, granted_at, effective_from, expires_at)
                VALUES (?, ?, ?, ?, 'PERMANENT', 'ACTIVE', 'test fixture', ?, ?, ?, NULL)
                """, UUID.randomUUID(), userId, permissionId, direction, grantedBy,
                java.sql.Timestamp.from(Instant.now()), java.sql.Timestamp.from(Instant.now().minusSeconds(60)));
    }

    public String lifecycleStateOf(UUID userId) {
        return jdbc.queryForObject(
                "SELECT lifecycle_state FROM operational_user_profile WHERE id = ?", String.class, userId);
    }
}
