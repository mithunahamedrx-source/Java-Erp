package com.trioloo.erp.access;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import jakarta.servlet.http.HttpSession;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.web.context.WebApplicationContext;

/**
 * Authentication, account lifecycle, current-actor resolution and permission enforcement,
 * proven against the real PostgreSQL database and the real security filter chain.
 */
@SpringBootTest
class AuthenticationAndAuthorityTest {

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

    private MvcResult login(String username, String password) throws Exception {
        return mvc.perform(post("/api/auth/login")
                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType("application/json")
                        .content("{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password)))
                .andReturn();
    }

    // ---------------------------------------------------------------- A. Authentication

    @Test
    void validLoginSucceedsAndResolvesTheCanonicalIdentity() throws Exception {
        UUID id = fixtures.createProfile("rakib", "correct-horse", AccountLifecycleState.ACTIVE);

        MvcResult result = login("rakib", "correct-horse");

        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        // The response resolves the exact E-077 profile id - identity is never inferred later.
        assertThat(result.getResponse().getContentAsString()).contains(id.toString());
    }

    @Test
    void invalidPasswordFails() throws Exception {
        fixtures.createProfile("rakib", "correct-horse", AccountLifecycleState.ACTIVE);
        assertThat(login("rakib", "wrong").getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void unknownUsernameFailsIdenticallyToAWrongPassword() throws Exception {
        fixtures.createProfile("rakib", "correct-horse", AccountLifecycleState.ACTIVE);

        MvcResult unknown = login("nobody", "whatever");
        MvcResult wrongPassword = login("rakib", "wrong");

        // Identical status and identical empty body: the endpoint cannot be used to
        // discover whether an account exists.
        assertThat(unknown.getResponse().getStatus()).isEqualTo(wrongPassword.getResponse().getStatus());
        assertThat(unknown.getResponse().getContentAsString())
                .isEqualTo(wrongPassword.getResponse().getContentAsString());
    }

    @Test
    void unauthenticatedAccessToAProtectedEndpointIsRejected() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutInvalidatesTheSession() throws Exception {
        fixtures.createProfile("rakib", "correct-horse", AccountLifecycleState.ACTIVE);
        HttpSession session = login("rakib", "correct-horse").getRequest().getSession(false);

        mvc.perform(post("/api/auth/logout")
                        .session((org.springframework.mock.web.MockHttpSession) session)
                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isNoContent());

        // The invalidated session no longer authenticates.
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------------- B. Lifecycle

    @Test
    void invitedProfileBecomesActiveOnFirstSuccessfulSignIn() throws Exception {
        UUID id = fixtures.createProfile("newcomer", "letmein-now", AccountLifecycleState.INVITED);
        assertThat(fixtures.lifecycleStateOf(id)).isEqualTo("INVITED");

        assertThat(login("newcomer", "letmein-now").getResponse().getStatus()).isEqualTo(200);

        assertThat(fixtures.lifecycleStateOf(id)).isEqualTo("ACTIVE");
    }

    @Test
    void failedSignInDoesNotActivateAnInvitedProfile() throws Exception {
        UUID id = fixtures.createProfile("newcomer", "letmein-now", AccountLifecycleState.INVITED);

        assertThat(login("newcomer", "wrong").getResponse().getStatus()).isEqualTo(401);

        assertThat(fixtures.lifecycleStateOf(id)).isEqualTo("INVITED");
    }

    @Test
    void activationHappensOnceAndIsNotRepeated() throws Exception {
        UUID id = fixtures.createProfile("newcomer", "letmein-now", AccountLifecycleState.INVITED);

        login("newcomer", "letmein-now");
        String firstActivation = jdbc.queryForObject(
                "SELECT activated_at::text FROM operational_user_profile WHERE id = ?", String.class, id);

        login("newcomer", "letmein-now");
        String secondActivation = jdbc.queryForObject(
                "SELECT activated_at::text FROM operational_user_profile WHERE id = ?", String.class, id);

        assertThat(secondActivation).isEqualTo(firstActivation);
    }

    @Test
    void suspendedProfileCannotAuthenticate() throws Exception {
        fixtures.createProfile("paused", "correct-horse", AccountLifecycleState.SUSPENDED);
        assertThat(login("paused", "correct-horse").getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void disabledProfileCannotAuthenticate() throws Exception {
        fixtures.createProfile("departed", "correct-horse", AccountLifecycleState.DISABLED);
        assertThat(login("departed", "correct-horse").getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void expiredInvitationCannotAuthenticate() throws Exception {
        fixtures.createProfile("lapsed", "correct-horse", AccountLifecycleState.EXPIRED);
        assertThat(login("lapsed", "correct-horse").getResponse().getStatus()).isEqualTo(401);
    }

    // ---------------------------------------------------------------- D. Permissions

    @Test
    void rolePermissionResolvesToTheActor() throws Exception {
        UUID user = fixtures.createProfile("agent", "correct-horse", AccountLifecycleState.ACTIVE);
        UUID permission = fixtures.createPermission("order.verify");
        UUID role = fixtures.createRole("CALL_CENTRE_AGENT");
        fixtures.grantPermissionToRole(role, permission);
        fixtures.assignRole(user, role);

        MvcResult result = login("agent", "correct-horse");

        assertThat(result.getResponse().getContentAsString()).contains("order.verify");
    }

    /**
     * 🔴 AGV 13.4 - Administrator is a ROLE, not a mode. Holding the title grants nothing on
     * its own. This is the test that would fail if anyone reintroduced hasRole("ADMIN").
     */
    @Test
    void administratorTitleGrantsNoPermissionByItself() throws Exception {
        UUID user = fixtures.createProfile("admin-user", "correct-horse", AccountLifecycleState.ACTIVE);
        UUID administrator = fixtures.createRole("ADMINISTRATOR");
        fixtures.createPermission("payment.write_off");
        fixtures.assignRole(user, administrator);

        MvcResult result = login("admin-user", "correct-horse");
        String body = result.getResponse().getContentAsString();

        // The title is present...
        assertThat(body).contains("ADMINISTRATOR");
        // ...and the permission it was never granted is absent. Deny by default holds.
        assertThat(body).doesNotContain("payment.write_off");
    }

    /** AGV-023 - a REVOKE override removes a role-derived permission for one person. */
    @Test
    void revokeOverrideRemovesARoleDerivedPermission() throws Exception {
        UUID user = fixtures.createProfile("sales", "correct-horse", AccountLifecycleState.ACTIVE);
        UUID refund = fixtures.createPermission("payment.refund");
        UUID role = fixtures.createRole("SALES");
        fixtures.grantPermissionToRole(role, refund);
        fixtures.assignRole(user, role);
        fixtures.addOverride(user, refund, "REVOKE", user);

        MvcResult result = login("sales", "correct-horse");

        assertThat(result.getResponse().getContentAsString()).doesNotContain("payment.refund");
    }

    @Test
    void userWithNoRolesHoldsNoPermissions() throws Exception {
        fixtures.createProfile("plain", "correct-horse", AccountLifecycleState.ACTIVE);

        MvcResult result = login("plain", "correct-horse");

        assertThat(result.getResponse().getContentAsString()).contains("\"permissions\":[]");
    }

    // ---------------------------------------------------------------- F. Bootstrap

    /**
     * 🔴 Production startup creates no identity at all. GAP-120/121/122 stay open, and no
     * default Owner, Administrator or demo credential is seeded by a migration.
     */
    @Test
    void startupSeedsNoIdentityWhatsoever() {
        fixtures.clear();
        Integer profiles = jdbc.queryForObject("SELECT count(*) FROM operational_user_profile", Integer.class);
        Integer credentials = jdbc.queryForObject("SELECT count(*) FROM user_credential", Integer.class);

        assertThat(profiles).isZero();
        assertThat(credentials).isZero();
    }

    /** No credential is ever stored in plaintext. */
    @Test
    void credentialsAreStoredHashed() {
        fixtures.createProfile("rakib", "correct-horse", AccountLifecycleState.ACTIVE);

        String stored = jdbc.queryForObject("SELECT password_hash FROM user_credential", String.class);

        assertThat(stored).isNotNull().doesNotContain("correct-horse").startsWith("{bcrypt}");
    }
}
