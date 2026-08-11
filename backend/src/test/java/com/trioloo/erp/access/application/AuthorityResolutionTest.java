package com.trioloo.erp.access.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.trioloo.erp.access.application.AuthorityResolution.OverrideDirection;
import com.trioloo.erp.access.application.AuthorityResolution.PermissionOverride;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/**
 * Override precedence, tested as pure logic with no database.
 *
 * <p>These are the rules {@code AGV-018} and {@code AGV-023} turn on, so they are proven
 * directly rather than inferred from an end-to-end login.
 */
class AuthorityResolutionTest {

    private static final Instant NOW = Instant.parse("2026-08-11T10:00:00Z");

    private static PermissionOverride override(String code, OverrideDirection direction, String status,
                                               Instant from, Instant until) {
        return new PermissionOverride(null, code, direction, status, from, until);
    }

    /** PRM P3 - nothing is held unless granted. */
    @Test
    void denyByDefaultWhenNoRolesAndNoOverrides() {
        assertThat(AuthorityResolution.effectivePermissions(Set.of(), List.of(), NOW)).isEmpty();
    }

    /** AGV-018 - roles are the primary grant. */
    @Test
    void roleDerivedPermissionsAreHeld() {
        assertThat(AuthorityResolution.effectivePermissions(Set.of("order.verify"), List.of(), NOW))
                .containsExactly("order.verify");
    }

    /** AGV-023 - a GRANT override adds what the roles do not carry. */
    @Test
    void activeGrantOverrideAddsPermission() {
        var result = AuthorityResolution.effectivePermissions(
                Set.of("order.verify"),
                List.of(override("payment.refund", OverrideDirection.GRANT, "ACTIVE", null, null)),
                NOW);

        assertThat(result).containsExactlyInAnyOrder("order.verify", "payment.refund");
    }

    /**
     * AGV-023's stated purpose: "Sales, but this one person may not issue refunds" must not
     * require a whole new role.
     */
    @Test
    void activeRevokeOverrideRemovesRoleDerivedPermission() {
        var result = AuthorityResolution.effectivePermissions(
                Set.of("order.verify", "payment.refund"),
                List.of(override("payment.refund", OverrideDirection.REVOKE, "ACTIVE", null, null)),
                NOW);

        assertThat(result).containsExactly("order.verify");
    }

    /** REVOKE beats GRANT on the same permission - deny by default points the same way. */
    @Test
    void revokeBeatsGrantForTheSamePermission() {
        var result = AuthorityResolution.effectivePermissions(
                Set.of(),
                List.of(override("payment.refund", OverrideDirection.GRANT, "ACTIVE", null, null),
                        override("payment.refund", OverrideDirection.REVOKE, "ACTIVE", null, null)),
                NOW);

        assertThat(result).isEmpty();
    }

    /** SM-17 / AGV-025 - a suspended override must not keep granting. */
    @Test
    void overrideUnderReviewDoesNotApply() {
        var result = AuthorityResolution.effectivePermissions(
                Set.of(),
                List.of(override("payment.refund", OverrideDirection.GRANT, "REVIEW_REQUIRED", null, null)),
                NOW);

        assertThat(result).isEmpty();
    }

    /** AGV-022 - a TEMPORARY override automatically becomes inactive on expiry. */
    @Test
    void expiredTemporaryOverrideDoesNotApply() {
        var result = AuthorityResolution.effectivePermissions(
                Set.of(),
                List.of(override("payment.refund", OverrideDirection.GRANT, "ACTIVE",
                        NOW.minusSeconds(7200), NOW.minusSeconds(3600))),
                NOW);

        assertThat(result).isEmpty();
    }

    /** An override that has not yet reached its effective date does not apply. */
    @Test
    void overrideBeforeItsEffectiveDateDoesNotApply() {
        var result = AuthorityResolution.effectivePermissions(
                Set.of(),
                List.of(override("payment.refund", OverrideDirection.GRANT, "ACTIVE",
                        NOW.plusSeconds(3600), null)),
                NOW);

        assertThat(result).isEmpty();
    }

    /** A REMOVED override is gone, not merely inactive. */
    @Test
    void removedOverrideDoesNotRevoke() {
        var result = AuthorityResolution.effectivePermissions(
                Set.of("payment.refund"),
                List.of(override("payment.refund", OverrideDirection.REVOKE, "REMOVED", null, null)),
                NOW);

        assertThat(result).containsExactly("payment.refund");
    }
}
