package com.trioloo.erp.access;

import com.trioloo.erp.access.application.AuthorityResolution;
import com.trioloo.erp.access.application.OwnerBootstrapService;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.domain.OwnerDesignationOrigin;
import com.trioloo.erp.access.infrastructure.persistence.UserProfileEntity;
import com.trioloo.erp.access.infrastructure.persistence.UserProfileRepository;
import com.trioloo.erp.access.domain.Actor;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * GAP-120 — the Owner designation, its intrinsic authority, and the one-time bootstrap.
 *
 * <p>🔴 THE CLAIMS UNDER TEST are that Owner is a DESIGNATION and never a role or an override
 * ({@code AGV-037}, {@code AGV-039}), that an Owner holds the ENTIRE catalogue dynamically
 * ({@code AGV-033}), that the first bootstrap is genuinely one-time even under concurrency,
 * and that ordinary startup creates nobody.
 *
 * <p>🔴 THE PROVENANCE CLAIM MATTERS MOST: the first Owner records NO designating Owner,
 * because none existed. A self-designation would be a grant that never happened.
 */
@SpringBootTest
class OwnerBootstrapTest {

    @Autowired
    private OwnerBootstrapService bootstrap;
    @Autowired
    private UserProfileRepository profiles;
    @Autowired
    private UserDetailsService userDetails;
    @Autowired
    private PasswordEncoder passwordEncoder;
    @Autowired
    private JdbcTemplate jdbc;

    private AccessFixtures fixtures;

    private static final String PW = "a-correct-horse-battery-staple";

    @BeforeEach
    void setUp() {
        fixtures = new AccessFixtures(jdbc, passwordEncoder);
        fixtures.clear();
    }

    @AfterEach
    void tearDown() {
        fixtures.clear();
    }

    // =================================================================================
    // AGV-037 / AGV-039 — Owner is a designation, not a role and not an override
    // =================================================================================

    @Test
    @DisplayName("AGV-037 a bootstrapped profile carries the Owner designation")
    void bootstrapCreatesAnOwner() {
        UUID id = bootstrap.bootstrapFirstOwner("TheOwner", "The Owner", PW.toCharArray());

        UserProfileEntity profile = profiles.findById(id).orElseThrow();
        assertThat(profile.isOwner()).isTrue();
        assertThat(profile.getOwnerDesignatedAt()).isNotNull();
        assertThat(profile.getUsername()).isEqualTo("TheOwner");
        assertThat(profile.getFullName()).isEqualTo("The Owner");
    }

    /** ⚠ An ordinary profile is NOT an Owner. The designation is never implied by existing. */
    @Test
    @DisplayName("AGV-037 an ordinary profile is not an Owner")
    void ordinaryProfileIsNotOwner() {
        UUID id = fixtures.createProfile("ordinary", "irrelevant", AccountLifecycleState.ACTIVE);

        assertThat(profiles.findById(id).orElseThrow().isOwner()).isFalse();
        assertThat(profiles.countOwners()).isZero();
    }

    /**
     * 🔴 {@code AGV-039} — THE DESIGNATION IS NOT REACHABLE THROUGH ROLE ASSIGNMENT OR
     * OVERRIDE. The bootstrap must create NO role and NO override; if it did, Owner would be
     * ordinary permission administration and {@code AGV-038} would be unenforceable.
     */
    @Test
    @DisplayName("AGV-039 bootstrap creates no role, no role assignment and no override")
    void ownerIsNotBuiltFromRolesOrOverrides() {
        bootstrap.bootstrapFirstOwner("TheOwner", "The Owner", PW.toCharArray());

        assertThat(jdbc.queryForObject("SELECT count(*) FROM role", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM user_role", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM user_permission_override", Integer.class)).isZero();
    }

    /**
     * 🔴 THE PROVENANCE CLAIM. The first Owner was designated by NOBODY, and the record says
     * so. Recording a self-designation would put a grant in the audit trail that never
     * occurred ({@code AGV-041}).
     */
    @Test
    @DisplayName("AGV-041 the first Owner records no designating Owner, and is marked INITIAL_BOOTSTRAP")
    void firstOwnerProvenanceIsTruthful() {
        UUID id = bootstrap.bootstrapFirstOwner("TheOwner", "The Owner", PW.toCharArray());

        UserProfileEntity profile = profiles.findById(id).orElseThrow();
        assertThat(profile.getOwnerDesignationOrigin()).isEqualTo(OwnerDesignationOrigin.INITIAL_BOOTSTRAP);
        /* 🔴 NOT self-designated. */
        assertThat(profile.getOwnerDesignatedBy()).isNull();
        assertThat(profile.getOwnerDesignatedBy()).isNotEqualTo(id);
    }

    /** 🔴 The database refuses a self-designating or unattributed grant outright. */
    @Test
    @DisplayName("V13 the database refuses an OWNER_GRANT with no designating Owner")
    void databaseRefusesDishonestProvenance() {
        UUID id = fixtures.createProfile("someone", "irrelevant", AccountLifecycleState.ACTIVE);

        assertThatThrownBy(() -> jdbc.update("""
                UPDATE operational_user_profile
                   SET owner_designated_at = now(), owner_designation_origin = 'OWNER_GRANT',
                       owner_designated_by = NULL
                 WHERE id = ?
                """, id))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    // =================================================================================
    // AGV-033 / AGV-037 — intrinsic, dynamic authority
    // =================================================================================

    /**
     * 🔴 AN OWNER WITH ZERO ROLES AND ZERO OVERRIDES HOLDS EVERYTHING. This is the whole
     * point of the designation.
     */
    @Test
    @DisplayName("AGV-033 an Owner with no roles and no overrides holds the entire catalogue")
    void ownerHoldsEntireCatalogue() {
        for (String code : List.of("system.channel-instance.view", "product.stock-item.manage", "a.b.c")) {
            fixtures.createPermission(code);
        }
        bootstrap.bootstrapFirstOwner("TheOwner", "The Owner", PW.toCharArray());

        Actor owner = actor("TheOwner");

        assertThat(owner.permissions())
                .containsExactlyInAnyOrder("system.channel-instance.view", "product.stock-item.manage", "a.b.c");
        assertThat(owner.roleCodes()).isEmpty();
    }

    /**
     * 🔴 DYNAMIC, NOT A SNAPSHOT. A permission introduced later is held immediately, with no
     * backfill — which is exactly why Owner authority is not materialised as override rows.
     */
    @Test
    @DisplayName("AGV-037 a permission added later is held by the Owner automatically")
    void ownerAuthorityFollowsTheCatalogue() {
        fixtures.createPermission("first.permission.view");
        bootstrap.bootstrapFirstOwner("TheOwner", "The Owner", PW.toCharArray());
        assertThat(actor("TheOwner").permissions()).containsExactly("first.permission.view");

        // A later migration introduces a new capability. Nothing touches the Owner.
        fixtures.createPermission("later.permission.manage");

        assertThat(actor("TheOwner").permissions())
                .containsExactlyInAnyOrder("first.permission.view", "later.permission.manage");
    }

    /** ⚠ A non-Owner is unaffected: deny by default still governs everyone else. */
    @Test
    @DisplayName("PRM-003 a non-Owner holds nothing without a grant")
    void nonOwnerHoldsNothing() {
        fixtures.createPermission("system.channel-instance.view");
        fixtures.createProfile("ordinary", "irrelevant", AccountLifecycleState.ACTIVE);

        assertThat(actor("ordinary").permissions()).isEmpty();
    }

    /** 🔴 Pure-logic proof that the saturation path ignores roles and overrides entirely. */
    @Test
    @DisplayName("AGV-039 an override cannot narrow Owner authority")
    void overridesCannotNarrowOwner() {
        Set<String> catalogue = Set.of("a.b.view", "a.b.manage");
        var revokeEverything = List.of(
                new AuthorityResolution.PermissionOverride(null, "a.b.view",
                        AuthorityResolution.OverrideDirection.REVOKE, "ACTIVE", null, null),
                new AuthorityResolution.PermissionOverride(null, "a.b.manage",
                        AuthorityResolution.OverrideDirection.REVOKE, "ACTIVE", null, null));

        Set<String> owner = AuthorityResolution.effectivePermissions(
                Set.of(), revokeEverything, java.time.Instant.now(), true, catalogue);
        Set<String> notOwner = AuthorityResolution.effectivePermissions(
                Set.of("a.b.view"), revokeEverything, java.time.Instant.now(), false, catalogue);

        assertThat(owner).isEqualTo(catalogue);
        assertThat(notOwner).isEmpty();
    }

    // =================================================================================
    // The one-time guard
    // =================================================================================

    @Test
    @DisplayName("GAP-120 a second bootstrap is refused and changes nothing")
    void secondBootstrapIsRefused() {
        UUID first = bootstrap.bootstrapFirstOwner("TheOwner", "The Owner", PW.toCharArray());

        assertThatThrownBy(() -> bootstrap.bootstrapFirstOwner("Another", "Another Person", PW.toCharArray()))
                .isInstanceOf(OwnerBootstrapService.BootstrapRefusedException.class)
                .hasMessageContaining("an Owner already exists");

        assertThat(profiles.countOwners()).isEqualTo(1);
        assertThat(profiles.count()).isEqualTo(1);
        assertThat(profiles.findById(first).orElseThrow().getUsername()).isEqualTo("TheOwner");
        assertThat(profiles.findByUsername("Another")).isEmpty();
    }

    /**
     * 🔴 CONCURRENCY. Two simultaneous bootstraps must not both succeed. The database's
     * partial unique index is the authority; no external lock service exists ({@code TEC-065}).
     */
    @Test
    @DisplayName("GAP-120 concurrent bootstraps produce at most one Owner")
    void concurrentBootstrapsProduceOneOwner() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(4);
        try {
            List<Callable<Boolean>> attempts = List.of(
                    attempt("owner-a"), attempt("owner-b"), attempt("owner-c"), attempt("owner-d"));
            List<Future<Boolean>> results = pool.invokeAll(attempts);
            long succeeded = results.stream().filter(f -> {
                try {
                    return f.get();
                } catch (Exception e) {
                    return false;
                }
            }).count();

            assertThat(succeeded).isLessThanOrEqualTo(1);
            assertThat(profiles.countOwners()).isLessThanOrEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    /** Resolves an identity exactly as authentication does, then projects the canonical Actor. */
    private Actor actor(String username) {
        return ((com.trioloo.erp.access.infrastructure.security.AccessUserDetails)
                userDetails.loadUserByUsername(username)).toActor();
    }

    private Callable<Boolean> attempt(String username) {
        return () -> {
            try {
                bootstrap.bootstrapFirstOwner(username, "Concurrent " + username, PW.toCharArray());
                return true;
            } catch (Exception e) {
                return false;
            }
        };
    }

    // =================================================================================
    // Credential, lifecycle and validation
    // =================================================================================

    /** 🔴 The stored value is a DelegatingPasswordEncoder hash — never the plaintext. */
    @Test
    @DisplayName("the password is hashed through the application encoder and never stored plainly")
    void passwordIsHashed() {
        UUID id = bootstrap.bootstrapFirstOwner("TheOwner", "The Owner", PW.toCharArray());

        String stored = jdbc.queryForObject(
                "SELECT password_hash FROM user_credential WHERE user_id = ?", String.class, id);
        assertThat(stored).isNotNull().doesNotContain(PW).startsWith("{");
        assertThat(passwordEncoder.matches(PW, stored)).isTrue();
    }

    /**
     * ⚠ The canonical lifecycle is reused: {@code INVITED} becomes {@code ACTIVE} on the
     * first successful sign-in. Stamping an activation that has not happened would fabricate
     * an attribution ({@code AGV-001}).
     */
    @Test
    @DisplayName("AGV-001 the bootstrapped Owner is INVITED with no fabricated activation")
    void ownerStartsInvited() {
        UUID id = bootstrap.bootstrapFirstOwner("TheOwner", "The Owner", PW.toCharArray());

        UserProfileEntity profile = profiles.findById(id).orElseThrow();
        assertThat(profile.getLifecycleState()).isEqualTo(AccountLifecycleState.INVITED);
        assertThat(profile.getActivatedAt()).isNull();
    }

    @Test
    @DisplayName("validation refuses a blank username, full name or password, creating nothing")
    void validationRefusesIncompleteInput() {
        assertThatThrownBy(() -> bootstrap.bootstrapFirstOwner("  ", "The Owner", PW.toCharArray()))
                .isInstanceOf(OwnerBootstrapService.BootstrapRefusedException.class);
        assertThatThrownBy(() -> bootstrap.bootstrapFirstOwner("TheOwner", " ", PW.toCharArray()))
                .isInstanceOf(OwnerBootstrapService.BootstrapRefusedException.class);
        assertThatThrownBy(() -> bootstrap.bootstrapFirstOwner("TheOwner", "The Owner", "   ".toCharArray()))
                .isInstanceOf(OwnerBootstrapService.BootstrapRefusedException.class);
        assertThatThrownBy(() -> bootstrap.bootstrapFirstOwner("TheOwner", "The Owner", new char[0]))
                .isInstanceOf(OwnerBootstrapService.BootstrapRefusedException.class);

        assertThat(profiles.count()).isZero();
        assertThat(profiles.countOwners()).isZero();
    }

    /** 🔴 ATOMICITY — a refused bootstrap leaves no half-built privileged account. */
    @Test
    @DisplayName("a duplicate username is refused and leaves no partial account")
    void duplicateUsernameLeavesNothingBehind() {
        fixtures.createProfile("TheOwner", "irrelevant", AccountLifecycleState.ACTIVE);
        long profilesBefore = profiles.count();

        assertThatThrownBy(() -> bootstrap.bootstrapFirstOwner("TheOwner", "The Owner", PW.toCharArray()))
                .isInstanceOf(OwnerBootstrapService.BootstrapRefusedException.class);

        assertThat(profiles.count()).isEqualTo(profilesBefore);
        assertThat(profiles.countOwners()).isZero();
    }
}
