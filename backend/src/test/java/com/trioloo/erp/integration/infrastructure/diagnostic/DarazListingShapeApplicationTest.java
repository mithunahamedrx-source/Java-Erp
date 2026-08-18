package com.trioloo.erp.integration.infrastructure.diagnostic;

import com.trioloo.erp.integration.application.DarazListingShapeDiagnostic;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The probe's own context — the test that would have caught the v14f failure.
 *
 * <p>🔴 THIS EXISTS BECAUSE A CONTEXT THAT CANNOT START IS A BUG NO UNIT TEST SEES. The first
 * wiring reused {@code TriolooErpApplication} with {@code WebApplicationType.NONE}, which stops
 * Tomcat but NOT component scanning — so the command pulled in {@code AuthController} and the
 * servlet {@code SecurityConfig} and died on an {@code AuthenticationConfiguration} that only a
 * servlet context provides. ⚠ It failed in PRODUCTION, on the first real invocation, because every
 * existing test booted the FULL application context and therefore proved nothing about the
 * command's own.
 *
 * <p>✅ {@code classes = DarazListingShapeApplication.class} boots exactly what the command boots.
 * If a dependency is ever added to the probe and not named in the scoped {@code @Import}, this
 * fails here rather than on a production terminal.
 */
@SpringBootTest(
        classes = DarazListingShapeApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
class DarazListingShapeApplicationTest {

    @Autowired ApplicationContext context;
    @Autowired DarazListingShapeRunner runner;
    @Autowired DarazListingShapeDiagnostic diagnostic;

    @Test
    @DisplayName("🔴 the scoped command context starts, with the probe wired")
    void contextStarts() {
        assertThat(context).isNotNull();
        assertThat(runner).isNotNull();
        assertThat(diagnostic).isNotNull();
    }

    /**
     * 🔴 THE EXACT BEAN THE v14f ATTEMPT DIED ON. Its absence is the point: the command
     * authenticates nobody, and pulling in web security is what broke it.
     */
    @Test
    @DisplayName("🔴 no web-security or controller bean is present in the command context")
    void carriesNoWebSecurity() {
        assertThat(context.getBeanNamesForType(
                org.springframework.security.config.annotation.authentication.configuration
                        .AuthenticationConfiguration.class)).isEmpty();
        assertThat(context.containsBeanDefinition("authController")).isFalse();
        assertThat(context.containsBeanDefinition("securityConfig")).isFalse();
    }

    /** ⚠ It scans nothing, so unrelated modules cannot drift into the command by accident. */
    @Test
    @DisplayName("the command context stays small and names its dependencies")
    void staysScoped() {
        assertThat(context.containsBeanDefinition("channelListingController")).isFalse();
        assertThat(context.containsBeanDefinition("darazCallbackController")).isFalse();
        assertThat(context.containsBeanDefinition("darazChannelAdapter")).isFalse();
    }

    /** 🔴 The runner is present but inert: no COMMAND argument was supplied to this context. */
    @Test
    @DisplayName("starting the context does not run the probe")
    void contextStartDoesNotProbe() {
        /* Reaching this assertion at all proves it: the runner ran during startup and returned
           immediately. Had it probed, it would have called System.exit and killed the JVM. */
        assertThat(DarazListingShapeRunner.isProbeInvocation(new String[]{})).isFalse();
    }
}
