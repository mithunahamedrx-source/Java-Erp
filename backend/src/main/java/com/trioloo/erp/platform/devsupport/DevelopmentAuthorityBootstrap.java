package com.trioloo.erp.platform.devsupport;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Local-development-only provisioning for the designated review identity.
 *
 * <p>This writes ordinary data: one E-077 Operational User Profile, one real
 * DelegatingPasswordEncoder credential, and ordinary permanent GRANT overrides for every
 * currently defined permission. It does not change authorization code, create a wildcard,
 * grant Owner, grant Administrator, or bypass the normal permission-resolution pipeline.
 */
@Component
@Profile(DevelopmentAuthorityBootstrap.PROFILE)
public class DevelopmentAuthorityBootstrap {

    /** Deliberately specific: activating it must be a conscious local-development act. */
    public static final String PROFILE = "dev-authority";

    public static final String ENABLED_PROPERTY = "trioloo.dev.identity.provision";
    public static final String LEGACY_ENABLED_PROPERTY = "trioloo.dev.grant-all-permissions";
    public static final String USERNAME_PROPERTY = "DEV_USERNAME";
    public static final String PASSWORD_PROPERTY = "DEV_PASSWORD";
    public static final String FULL_NAME_PROPERTY = "trioloo.dev.identity.full-name";

    /** Any profile whose name contains one of these is treated as production. */
    static final List<String> PRODUCTION_MARKERS = List.of("prod", "production", "live", "staging");

    private static final Logger log = LoggerFactory.getLogger(DevelopmentAuthorityBootstrap.class);

    private final JdbcTemplate jdbc;
    private final Environment environment;
    private final PasswordEncoder passwordEncoder;

    public DevelopmentAuthorityBootstrap(JdbcTemplate jdbc, Environment environment, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.environment = environment;
        this.passwordEncoder = passwordEncoder;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void provisionDevelopmentIdentity() {
        refuseUnderProduction(environment.getActiveProfiles());

        if (!provisioningEnabled()) {
            log.info("Development identity provisioning is inactive ({} is not true).", ENABLED_PROPERTY);
            return;
        }

        String username = required(USERNAME_PROPERTY, "devuser");
        String password = required(PASSWORD_PROPERTY, null);
        String fullName = environment.getProperty(FULL_NAME_PROPERTY, "Dev User");

        UUID userId = ensureProfile(username, fullName);
        ensureCredential(userId, password);
        int granted = grantEveryDefinedPermission(userId);

        Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM permission", Integer.class);
        log.warn("DEVELOPMENT IDENTITY: '{}' is ACTIVE, has a real credential, and received {} new "
                + "permission override(s); it now holds all {} defined permissions through the normal "
                + "permission-resolution pipeline. This mechanism is development-only and never runs in production.",
                username, granted, total);
    }

    private boolean provisioningEnabled() {
        return Boolean.parseBoolean(environment.getProperty(ENABLED_PROPERTY,
                environment.getProperty(LEGACY_ENABLED_PROPERTY, "false")));
    }

    private UUID ensureProfile(String username, String fullName) {
        List<String> ids = jdbc.queryForList(
                "SELECT id::text FROM operational_user_profile WHERE username = ?", String.class, username);
        if (!ids.isEmpty()) {
            UUID id = UUID.fromString(ids.getFirst());
            jdbc.update("""
                    UPDATE operational_user_profile
                       SET lifecycle_state = 'ACTIVE',
                           activated_at = COALESCE(activated_at, now())
                     WHERE id = ?
                    """, id);
            return id;
        }

        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO operational_user_profile
                    (id, username, full_name, lifecycle_state, created_at, activated_at)
                VALUES (?, ?, ?, 'ACTIVE', now(), now())
                """, id, username, fullName);
        return id;
    }

    private void ensureCredential(UUID userId, String password) {
        List<String> existing = jdbc.queryForList(
                "SELECT password_hash FROM user_credential WHERE user_id = ?", String.class, userId);
        if (existing.isEmpty()) {
            jdbc.update("INSERT INTO user_credential (user_id, password_hash, updated_at) VALUES (?, ?, now())",
                    userId, passwordEncoder.encode(password));
            return;
        }

        String hash = existing.getFirst();
        if (!passwordEncoder.matches(password, hash) || passwordEncoder.upgradeEncoding(hash)) {
            jdbc.update("UPDATE user_credential SET password_hash = ?, updated_at = now() WHERE user_id = ?",
                    passwordEncoder.encode(password), userId);
        }
    }

    private int grantEveryDefinedPermission(UUID userId) {
        return jdbc.update("""
                INSERT INTO user_permission_override (
                    id, user_id, permission_id, direction, override_type, status,
                    business_reason, granted_by, granted_at, effective_from, expires_at)
                SELECT gen_random_uuid(), ?, p.id, 'GRANT', 'PERMANENT', 'ACTIVE',
                       'LOCAL DEVELOPMENT ONLY - full catalogue access for module review.',
                       ?, now(), now(), NULL
                  FROM permission p
                 WHERE NOT EXISTS (SELECT 1 FROM user_permission_override o
                                    WHERE o.user_id = ? AND o.permission_id = p.id)
                """, userId, userId, userId);
    }

    private String required(String property, String defaultValue) {
        String value = environment.getProperty(property, defaultValue);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(property + " must be configured when "
                    + ENABLED_PROPERTY + " is true. Use backend/.env or an equivalent local secret source.");
        }
        return value.trim();
    }

    public DevelopmentIdentitySnapshot snapshot(String username) {
        List<DevelopmentIdentitySnapshot> rows = jdbc.query("""
                SELECT u.id::text,
                       u.lifecycle_state,
                       c.password_hash,
                       (SELECT COUNT(*) FROM permission),
                       (SELECT COUNT(*) FROM user_permission_override o
                         WHERE o.user_id = u.id AND o.direction = 'GRANT' AND o.status = 'ACTIVE'),
                       (SELECT COUNT(*) FROM operational_user_profile WHERE username = u.username),
                       (SELECT COUNT(*) FROM user_credential c2 WHERE c2.user_id = u.id),
                       (SELECT COUNT(*) FROM user_permission_override o2 WHERE o2.user_id = u.id)
                  FROM operational_user_profile u
                  LEFT JOIN user_credential c ON c.user_id = u.id
                 WHERE u.username = ?
                """, (rs, rowNum) -> new DevelopmentIdentitySnapshot(
                UUID.fromString(rs.getString(1)),
                rs.getString(2),
                rs.getString(3),
                rs.getInt(4),
                rs.getInt(5),
                rs.getInt(6),
                rs.getInt(7),
                rs.getInt(8)), username);
        if (rows.size() != 1) {
            throw new IllegalStateException("Expected one development identity named '" + username
                    + "' but found " + rows.size());
        }
        return rows.getFirst();
    }

    public record DevelopmentIdentitySnapshot(
            UUID userId,
            String lifecycleState,
            String passwordHash,
            int definedPermissions,
            int activeGrantOverrides,
            int profileRows,
            int credentialRows,
            int overrideRows) {
    }

    /**
     * Throws rather than returning quietly: a production system that activated this profile
     * is misconfigured and must fail closed.
     */
    static void refuseUnderProduction(String[] activeProfiles) {
        for (String profile : activeProfiles) {
            String normalised = profile.toLowerCase(Locale.ROOT);
            for (String marker : PRODUCTION_MARKERS) {
                if (normalised.contains(marker)) {
                    throw new IllegalStateException(
                            "The development authority bootstrap must never run alongside a production profile. "
                                    + "Active profile '" + profile + "' looks like production. Refusing to start.");
                }
            }
        }
    }
}
