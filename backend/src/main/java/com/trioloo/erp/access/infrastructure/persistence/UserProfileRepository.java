package com.trioloo.erp.access.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Repository for {@code E-077} Operational User Profile.
 *
 * <p>{@code PRJ-031} — a repository never contains business orchestration. These methods
 * only fetch; precedence and lifecycle decisions live in the application layer.
 *
 * <p>Role, permission and override rows are read through explicit projection queries rather
 * than mapped as an entity graph, which keeps the mapping surface small and avoids the
 * unbounded graphs {@code PRJ-190} warns against.
 */
public interface UserProfileRepository extends JpaRepository<UserProfileEntity, UUID> {

    Optional<UserProfileEntity> findByUsername(String username);

    /** Role codes assigned to a user. Roles are an INPUT to resolution ({@code AGV-018}). */
    @Query(value = """
            SELECT r.code FROM user_role ur
            JOIN role r ON r.id = ur.role_id
            WHERE ur.user_id = :userId
            """, nativeQuery = true)
    List<String> findRoleCodes(@Param("userId") UUID userId);

    /**
     * Permission codes derived from the user's roles.
     *
     * <p>🔴 Nothing here special-cases Administrator. {@code AGV 13.4} makes it a role like
     * any other, holding exactly what configuration grants it and nothing more.
     */
    @Query(value = """
            SELECT DISTINCT p.code
            FROM user_role ur
            JOIN role_permission rp ON rp.role_id = ur.role_id
            JOIN permission p ON p.id = rp.permission_id
            WHERE ur.user_id = :userId
            """, nativeQuery = true)
    List<String> findRoleDerivedPermissionCodes(@Param("userId") UUID userId);

    /**
     * Override rows for a user, unfiltered by status or window.
     *
     * <p>Deliberately unfiltered so that precedence stays in one testable place in the
     * application layer instead of being half-expressed in SQL.
     */
    @Query(value = """
            SELECT p.code, o.direction, o.status, o.effective_from, o.expires_at
            FROM user_permission_override o
            JOIN permission p ON p.id = o.permission_id
            WHERE o.user_id = :userId
            """, nativeQuery = true)
    List<Object[]> findOverrideRows(@Param("userId") UUID userId);

    /**
     * The ENTIRE current permission catalogue.
     *
     * <p>🔴 Read at resolution time for an Owner ({@code AGV-037}), never copied onto the
     * profile. A permission introduced by a later migration is therefore held by every Owner
     * immediately, with no backfill and no drift.
     */
    @Query(value = "SELECT p.code FROM permission p", nativeQuery = true)
    List<String> findAllPermissionCodes();

    /**
     * Whether ANY profile currently carries the Owner designation ({@code AGV-037}).
     *
     * <p>🔴 The one-time bootstrap guard reads this INSIDE its transaction. The database's
     * partial unique index ({@code V13}) is what makes the guard safe under concurrency;
     * this makes the refusal a clean business outcome rather than a constraint violation.
     */
    @Query(value = "SELECT count(*) FROM operational_user_profile WHERE owner_designated_at IS NOT NULL",
            nativeQuery = true)
    long countOwners();
}
