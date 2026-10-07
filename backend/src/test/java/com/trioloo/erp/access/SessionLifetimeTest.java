package com.trioloo.erp.access;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.trioloo.erp.access.domain.AccountLifecycleState;
import com.trioloo.erp.access.infrastructure.security.AccessUserDetails;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Owner decision, 2026-10-06: once signed in, a person stays signed in until THEY sign out - across idle time,
 * a closed browser and a deployment restart - and a signed-out, suspended or disabled account still ends it.
 */
@SpringBootTest
class SessionLifetimeTest {

    @Autowired private WebApplicationContext context;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private com.trioloo.erp.access.infrastructure.security.ActiveAccountFilter activeAccount;

    private MockMvc mvc;
    private AccessFixtures fixtures;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(SecurityMockMvcConfigurers.springSecurity()).build();
        fixtures = new AccessFixtures(jdbc, passwordEncoder);
        fixtures.clear();
    }

    private MockHttpSession login(String username, String password) throws Exception {
        var result = mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
                .content("{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password))).andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return (MockHttpSession) result.getRequest().getSession(false);
    }

    @Test
    @DisplayName("A signed-in session has no idle timeout; an anonymous one keeps the container default")
    void signedInSessionNeverExpires() throws Exception {
        fixtures.createProfile("steady", "correct-horse", AccountLifecycleState.ACTIVE);
        MockHttpSession session = login("steady", "correct-horse");
        assertThat(session.getMaxInactiveInterval()).isEqualTo(-1);

        // An unauthenticated visit mints a session too; it must NOT be permanent.
        MockHttpSession anonymous = (MockHttpSession) mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized())
                .andReturn().getRequest().getSession(false);
        if (anonymous != null) {
            assertThat(anonymous.getMaxInactiveInterval()).isNotEqualTo(-1);
        }
    }

    @Test
    @DisplayName("The session stays valid request after request until the person signs out")
    void staysSignedInUntilLogout() throws Exception {
        fixtures.createProfile("steady2", "correct-horse", AccountLifecycleState.ACTIVE);
        MockHttpSession session = login("steady2", "correct-horse");
        for (int i = 0; i < 3; i++) {
            mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk());
        }
        mvc.perform(post("/api/auth/logout").with(csrf()).session(session)).andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("🔴 A session never outlives its account: suspending the person ends it on the next request")
    void suspendedAccountEndsItsSession() throws Exception {
        UUID id = fixtures.createProfile("soon-suspended", "correct-horse", AccountLifecycleState.ACTIVE);
        MockHttpSession session = login("soon-suspended", "correct-horse");
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk());

        jdbc.update("UPDATE operational_user_profile SET lifecycle_state = 'SUSPENDED' WHERE id = ?", id);
        // The answer is cached for a few seconds; wait it out by clearing it, as the passage of time would.
        java.lang.reflect.Method forget = activeAccount.getClass().getDeclaredMethod("forget");
        forget.setAccessible(true);
        forget.invoke(activeAccount);

        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("🔴 What a signed-in person may do stays current: an Owner sees a capability added after they signed in, without signing in again")
    void authorityIsReReadForALongLivedSession() throws Exception {
        UUID id = fixtures.createProfile("long-lived-owner", "correct-horse", AccountLifecycleState.ACTIVE);
        jdbc.update("UPDATE operational_user_profile SET owner_designated_at = now(), owner_designation_origin = 'INITIAL_BOOTSTRAP' WHERE id = ?", id);
        MockHttpSession session = login("long-lived-owner", "correct-horse");
        String before = mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(before).doesNotContain("test.later.capability");

        jdbc.update("INSERT INTO permission (id, code, description) VALUES (gen_random_uuid(), 'test.later.capability', 'Added after sign-in')");
        try {
            java.lang.reflect.Method forget = activeAccount.getClass().getDeclaredMethod("forget");
            forget.setAccessible(true);
            forget.invoke(activeAccount);
            String after = mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            assertThat(after).contains("test.later.capability");
        } finally {
            jdbc.update("DELETE FROM permission WHERE code = 'test.later.capability'");
        }
    }

    @Test
    @DisplayName("The authenticated context can be written to disk and read back, so a restart keeps people signed in")
    void authenticatedContextSurvivesSerialisation() throws Exception {
        var principal = new AccessUserDetails(UUID.randomUUID(), "serial", "Serial User", "{noop}x",
                AccountLifecycleState.ACTIVE, Set.of("Owner"), Set.of("order.channel-order.view", "product.stock-item.manage"));
        SecurityContext original = new SecurityContextImpl(new UsernamePasswordAuthenticationToken(principal, null,
                principal.getAuthorities()));

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ObjectOutputStream out = new ObjectOutputStream(bytes)) {
            out.writeObject(original);
        }
        try (ObjectInputStream in = new ObjectInputStream(new ByteArrayInputStream(bytes.toByteArray()))) {
            SecurityContext restored = (SecurityContext) in.readObject();
            assertThat(restored.getAuthentication().getName()).isEqualTo("serial");
            assertThat(restored.getAuthentication().getAuthorities())
                    .extracting(Object::toString).contains("order.channel-order.view", "product.stock-item.manage");
        }
    }
}
