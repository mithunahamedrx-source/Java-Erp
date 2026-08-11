package com.trioloo.erp.access.domain;

import java.util.Collections;
import java.util.Set;
import java.util.UUID;

/**
 * The authenticated actor, as application and domain code sees it.
 *
 * <p>This is the single current-user abstraction required so that future writes — order
 * confirmation, inventory movements, approvals, accounting postings, payroll actions,
 * corrections — can capture actor identity AT WRITE TIME ({@code AGV-001}) without ever
 * reconstructing it from audit logs afterwards.
 *
 * <p>🔴 Framework-free by {@code PRJ-021}: no Spring, no Spring Security, no Jakarta
 * Persistence, no Jackson. Application services receive this inward; nothing downstream
 * touches {@code SecurityContextHolder} or {@code HttpSession}.
 *
 * <p>It deliberately carries no credential, no password hash and no session detail.
 *
 * @param id          the {@code E-077} Operational User Profile identifier — the
 *                    permanent, non-transferable operational identity ({@code AGV-013})
 * @param username    the sign-in identifier
 * @param fullName    display identity
 * @param roleCodes   assigned roles. Roles are an INPUT to permission resolution, never a
 *                    substitute for it ({@code AGV-018}, {@code AGV 13.4})
 * @param permissions the resolved effective permission codes
 */
public record Actor(
        UUID id,
        String username,
        String fullName,
        Set<String> roleCodes,
        Set<String> permissions) {

    public Actor {
        if (id == null || username == null) {
            throw new IllegalArgumentException("An actor always has an identity (AGV-001)");
        }
        roleCodes = roleCodes == null ? Set.of() : Collections.unmodifiableSet(Set.copyOf(roleCodes));
        permissions = permissions == null ? Set.of() : Collections.unmodifiableSet(Set.copyOf(permissions));
    }

    /**
     * Whether this actor holds a permission.
     *
     * <p>🔴 Deny by default ({@code PRM} P3). Holding a role is not holding a permission:
     * {@code AGV 13.4} makes Administrator a role like any other, so an Administrator
     * passes here only for permissions actually granted through canonical configuration.
     */
    public boolean hasPermission(String permissionCode) {
        return permissions.contains(permissionCode);
    }

    /**
     * Whether this actor holds a named title (role code).
     *
     * <p>🔴 Title-bound authority is NOT a permission and must never be treated as one
     * ({@code PRM} P6 — authority to act is not authority to approve). This exists so a
     * future application service can distinguish an Owner/Administrator title-bound
     * decision from an ordinary permission-controlled action without either collapsing
     * into the other.
     */
    public boolean holdsTitle(String roleCode) {
        return roleCodes.contains(roleCode);
    }

    /**
     * Whether this actor is the same person as the given profile.
     *
     * <p>The primitive behind self-approval restrictions: several canonical rules turn on
     * "the approver is not the applier". Whether a specific action permits or forbids
     * self-approval is business architecture and is decided by the owning module, never
     * here.
     */
    public boolean isSamePersonAs(UUID operationalUserProfileId) {
        return id.equals(operationalUserProfileId);
    }
}
