package com.trioloo.erp.access;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.domain.Actor;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.WebApplicationContext;

/**
 * Behavioural security verification: actor resolution, CSRF, session fixation and the
 * 401/403 distinction.
 *
 * <p>These are proven by exercising the real filter chain, not by asserting that a
 * configuration method was called.
 */
@SpringBootTest
@Import(SecurityBehaviourTest.TestOnlyProbeEndpoints.class)
class SecurityBehaviourTest {

    /**
     * TEST-SCOPE ONLY probe endpoints.
     *
     * <p>🔴 Declared inside this test class, so they exist only while this test runs and are
     * never packaged or reachable in production. They carry no business meaning — they exist
     * because proving "authenticated but forbidden" and "state-changing request without CSRF"
     * requires endpoints of those shapes, and inventing business endpoints to test security
     * would be worse.
     */
    @TestConfiguration
    static class TestOnlyProbeEndpoints {

        @RestController
        static class ProbeController {

            private final CurrentActor currentActor;

            ProbeController(CurrentActor currentActor) {
                this.currentActor = currentActor;
            }

            /** Resolves the actor exactly as a future business write would. */
            @GetMapping("/test-probe/actor")
            String actor() {
                Actor actor = currentActor.require();
                return actor.id() + "|" + actor.username() + "|" + actor.permissions().size();
            }

            /** Requires a permission no fixture grants unless the test grants it. */
            @GetMapping("/test-probe/needs-permission")
            @PreAuthorize("hasAuthority('probe.execute')")
            String needsPermission() {
                return "allowed";
            }

            /** A state-changing endpoint, for CSRF verification. */
            @PostMapping("/test-probe/state-change")
            String stateChange() {
                return "changed";
            }
        }
    }

    @Autowired
    private WebApplicationContext context;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private MockMvc mvc;
    private AccessFixtures fixtures;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        fixtures = new AccessFixtures(jdbc, passwordEncoder);
        fixtures.clear();
    }

    private MvcResult login(MockHttpSession session, String username, String password) throws Exception {
        var request = post("/api/auth/login")
                .with(csrf())
                .contentType("application/json")
                .content("{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password));
        if (session != null) {
            request = request.session(session);
        }
        return mvc.perform(request).andReturn();
    }

    // -------------------------------------------------- CurrentActor / actor resolution

    /**
     * An authenticated request resolves the exact {@code E-077} identity that future writes
     * will attribute to ({@code AGV-001}) — not a name, not a reconstruction from a log.
     */
    @Test
    void authenticatedRequestResolvesTheCanonicalActorIdentity() throws Exception {
        UUID id = fixtures.createProfile("rakib", "correct-horse", AccountLifecycleState.ACTIVE);
        MockHttpSession session = (MockHttpSession) login(null, "rakib", "correct-horse")
                .getRequest().getSession(false);

        MvcResult probe = mvc.perform(get("/test-probe/actor").session(session))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(probe.getResponse().getContentAsString()).startsWith(id + "|rakib|");
    }

    /** No session, no actor. The port reports absence rather than inventing an identity. */
    @Test
    void unauthenticatedRequestResolvesNoActor() throws Exception {
        mvc.perform(get("/test-probe/actor")).andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------- 401 vs 403

    /** Unauthenticated is 401 — "who are you", not "you may not". */
    @Test
    void unauthenticatedProtectedRequestIs401() throws Exception {
        mvc.perform(get("/test-probe/needs-permission")).andExpect(status().isUnauthorized());
    }

    /**
     * Authenticated but lacking the permission is 403 — semantically distinct from 401 and
     * from pretending the resource does not exist.
     */
    @Test
    void authenticatedWithoutThePermissionIs403() throws Exception {
        fixtures.createProfile("plain", "correct-horse", AccountLifecycleState.ACTIVE);
        MockHttpSession session = (MockHttpSession) login(null, "plain", "correct-horse")
                .getRequest().getSession(false);

        mvc.perform(get("/test-probe/needs-permission").session(session))
                .andExpect(status().isForbidden());
    }

    /** With the permission granted through a role, the same request succeeds. */
    @Test
    void authenticatedWithThePermissionIsAllowed() throws Exception {
        UUID user = fixtures.createProfile("granted", "correct-horse", AccountLifecycleState.ACTIVE);
        UUID permission = fixtures.createPermission("probe.execute");
        UUID role = fixtures.createRole("PROBE_ROLE");
        fixtures.grantPermissionToRole(role, permission);
        fixtures.assignRole(user, role);

        MockHttpSession session = (MockHttpSession) login(null, "granted", "correct-horse")
                .getRequest().getSession(false);

        mvc.perform(get("/test-probe/needs-permission").session(session))
                .andExpect(status().isOk());
    }

    // -------------------------------------------------- CSRF (behavioural)

    /**
     * An authenticated state-changing request WITHOUT a CSRF token is rejected.
     *
     * <p>This is the test that fails if anyone ever disables CSRF to make the SPA easier.
     */
    @Test
    void authenticatedStateChangingRequestWithoutCsrfIsRejected() throws Exception {
        fixtures.createProfile("rakib", "correct-horse", AccountLifecycleState.ACTIVE);
        MockHttpSession session = (MockHttpSession) login(null, "rakib", "correct-horse")
                .getRequest().getSession(false);

        mvc.perform(post("/test-probe/state-change").session(session))
                .andExpect(status().isForbidden());
    }

    /** The same request WITH a valid CSRF token passes security processing. */
    @Test
    void authenticatedStateChangingRequestWithCsrfSucceeds() throws Exception {
        fixtures.createProfile("rakib", "correct-horse", AccountLifecycleState.ACTIVE);
        MockHttpSession session = (MockHttpSession) login(null, "rakib", "correct-horse")
                .getRequest().getSession(false);

        mvc.perform(post("/test-probe/state-change").session(session).with(csrf()))
                .andExpect(status().isOk());
    }

    /** A safe GET needs no CSRF token — CSRF guards state change, not reads. */
    @Test
    void safeGetRequestNeedsNoCsrfToken() throws Exception {
        UUID id = fixtures.createProfile("rakib", "correct-horse", AccountLifecycleState.ACTIVE);
        MockHttpSession session = (MockHttpSession) login(null, "rakib", "correct-horse")
                .getRequest().getSession(false);

        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk());
        assertThat(id).isNotNull();
    }

    // -------------------------------------------------- Session fixation (behavioural)

    /**
     * Authentication rotates the session identifier.
     *
     * <p>A pre-authentication session id must not survive as the authenticated one, or an
     * attacker who fixed that id beforehand would inherit the authenticated session.
     */
    @Test
    void authenticationRotatesTheSessionIdentifier() throws Exception {
        fixtures.createProfile("rakib", "correct-horse", AccountLifecycleState.ACTIVE);

        // A session that exists before authenticating.
        MockHttpSession preAuthSession = new MockHttpSession();
        String preAuthId = preAuthSession.getId();

        MvcResult result = login(preAuthSession, "rakib", "correct-horse");
        assertThat(result.getResponse().getStatus()).isEqualTo(200);

        var postAuthSession = (MockHttpSession) result.getRequest().getSession(false);
        assertThat(postAuthSession).isNotNull();

        // The security property that matters: the identifier that addressed the session
        // before authentication no longer addresses the authenticated one.
        assertThat(postAuthSession.getId()).isNotEqualTo(preAuthId);
    }
}
