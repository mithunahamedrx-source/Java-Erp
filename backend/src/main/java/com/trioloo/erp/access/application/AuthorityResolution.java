package com.trioloo.erp.access.application;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Resolves effective permissions from the canonical four-part composition.
 *
 * <p>{@code AGV-018} — <em>Operational User Profile + Assigned Roles + Scope Assignments +
 * Permission Overrides</em>. Permissions belong primarily to ROLES; overrides exist for
 * exceptional situations and are never the primary administration method.
 *
 * <p>Pure logic with no framework and no I/O, so the precedence rules below are unit
 * testable without a database.
 *
 * <p><strong>Scope</strong> is the fourth component and is deliberately NOT applied here.
 * {@code AGV-024} says scope bounds authority and never grants it, and {@code AGV 10.3}
 * records that scope is designed for growth and is <em>not active today</em>. Activating it
 * needs the dimension extensibility {@code GAP-098} still tracks. Because scope can only
 * ever NARROW a result, omitting it cannot widen authority — the resolution below is the
 * safe superset, and adding scope later removes permissions rather than adding them.
 */
public final class AuthorityResolution {

    private AuthorityResolution() {
    }

    /** Direction of a permission override ({@code AGV-023}). */
    public enum OverrideDirection { GRANT, REVOKE }

    /**
     * One override as resolution sees it.
     *
     * <p>🔴 There is deliberately no magnitude field. {@code AGV-024} forbids an override
     * carrying a percentage or amount, because {@code BD-275}'s explicit prohibition on
     * per-user discount limits could otherwise return through this mechanism.
     */
    public record PermissionOverride(
            UUID permissionId,
            String permissionCode,
            OverrideDirection direction,
            String status,
            Instant effectiveFrom,
            Instant expiresAt) {

        /**
         * An override participates only while {@code ACTIVE} and inside its validity window.
         *
         * <p>{@code SM-17} gives overrides their own lifecycle; {@code AGV-025} suspends every
         * override into {@code REVIEW_REQUIRED} on a role change, and a suspended override
         * must not keep granting.
         */
        public boolean appliesAt(Instant when) {
            if (!"ACTIVE".equals(status)) {
                return false;
            }
            if (effectiveFrom != null && when.isBefore(effectiveFrom)) {
                return false;
            }
            return expiresAt == null || when.isBefore(expiresAt);
        }
    }

    /**
     * Effective permissions = role-derived permissions, adjusted by active overrides.
     *
     * <p>Precedence, in order:
     * <ol>
     *   <li><strong>Deny by default</strong> ({@code PRM} P3) — nothing is held unless granted.</li>
     *   <li>Role-derived permissions are the primary grant ({@code AGV-018}).</li>
     *   <li>An active {@code GRANT} override adds a permission the roles do not carry.</li>
     *   <li>An active {@code REVOKE} override removes one the roles do carry, and
     *       <strong>REVOKE beats GRANT</strong> when both target the same permission.</li>
     * </ol>
     *
     * <p>REVOKE winning is not an invented precedence — it is the only reading under which
     * {@code AGV-023}'s stated purpose works. That rule exists so <em>"Sales, but this one
     * person may not issue refunds"</em> does not require a whole new role; if a role grant
     * could beat a revoke, the mechanism could never express it. Deny by default points the
     * same way.
     */
    public static Set<String> effectivePermissions(
            Set<String> roleDerivedPermissionCodes,
            Iterable<PermissionOverride> overrides,
            Instant when) {

        Set<String> effective = new HashSet<>(roleDerivedPermissionCodes);
        Set<String> revoked = new HashSet<>();

        for (PermissionOverride override : overrides) {
            if (!override.appliesAt(when)) {
                continue;
            }
            if (override.direction() == OverrideDirection.GRANT) {
                effective.add(override.permissionCode());
            } else {
                revoked.add(override.permissionCode());
            }
        }

        effective.removeAll(revoked);
        return Set.copyOf(effective);
    }

    /**
     * Effective permissions for an actor who may carry the Owner designation
     * ({@code AGV-037}).
     *
     * <p>🔴 OWNER SATURATES THE COMPOSITION. {@code AGV-033} — <em>"the Owner holds every
     * authority"</em> — so an Owner's effective set IS the entire current permission
     * catalogue, whatever it happens to contain at this moment.
     *
     * <p>🔴 THE CATALOGUE IS READ, NEVER COPIED. Nothing snapshots the permission list
     * against the Owner, so a permission added by a later migration is held immediately and
     * automatically. That is what {@code AGV-039} demands: were Owner authority materialised
     * as override rows, it would be an override bundle — reachable, revocable and drifting —
     * and the designation would stop being a designation.
     *
     * <p>⚠ Roles and overrides are deliberately NOT consulted for an Owner. A REVOKE override
     * cannot narrow Owner authority, because {@code AGV-039} keeps the designation outside
     * the override mechanism entirely; letting one bite here would make Owner revocable by
     * ordinary permission administration, which {@code AGV-038} forbids.
     */
    public static Set<String> effectivePermissions(
            Set<String> roleDerivedPermissionCodes,
            Iterable<PermissionOverride> overrides,
            Instant when,
            boolean owner,
            Set<String> entirePermissionCatalogue) {

        if (owner) {
            return Set.copyOf(entirePermissionCatalogue);
        }
        return effectivePermissions(roleDerivedPermissionCodes, overrides, when);
    }
}
