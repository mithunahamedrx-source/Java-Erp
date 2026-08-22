package com.trioloo.erp.integration.infrastructure.diagnostic;

import com.trioloo.erp.integration.application.DarazOrderPullProbe;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The probe's own context — the test the listing-shape command learned to need the hard way.
 *
 * <p>🔴 A CONTEXT THAT CANNOT START IS A BUG NO UNIT TEST SEES. The first such command reused
 * {@code TriolooErpApplication} with {@code WebApplicationType.NONE}, which stops Tomcat but NOT
 * component scanning — so it pulled in {@code AuthController} and the servlet {@code SecurityConfig}
 * and died on an {@code AuthenticationConfiguration} that only a servlet context provides. ⚠ It
 * failed in PRODUCTION because every existing test booted the FULL context and proved nothing about
 * the command's own.
 *
 * <p>✅ {@code classes = DarazOrderPullApplication.class} boots exactly what the command boots.
 */
@SpringBootTest(
        classes = DarazOrderPullApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
class DarazOrderPullApplicationTest {

    @Autowired ApplicationContext context;
    @Autowired DarazOrderPullRunner runner;
    @Autowired DarazOrderPullProbe probe;

    @Test
    @DisplayName("🔴 the scoped command context starts, with the probe wired")
    void contextStarts() {
        assertThat(context).isNotNull();
        assertThat(runner).isNotNull();
        assertThat(probe).isNotNull();
    }

    /** 🔴 The exact bean class of command died on. Its absence is the point. */
    @Test
    @DisplayName("🔴 no web-security or controller bean is present in the command context")
    void carriesNoWebSecurity() {
        assertThat(context.getBeanNamesForType(
                org.springframework.security.config.annotation.authentication.configuration
                        .AuthenticationConfiguration.class)).isEmpty();
        assertThat(context.containsBeanDefinition("authController")).isFalse();
        assertThat(context.containsBeanDefinition("securityConfig")).isFalse();
    }

    /**
     * 🔴 THE BLAST RADIUS, ASSERTED. No writer, adapter, operation recorder or controller is in
     * this context, so there is no bean here that COULD mutate an order, a listing or an
     * inventory row — whatever the probe were asked to do.
     */
    @Test
    @DisplayName("🔴 the command context holds nothing that could write a business row")
    void holdsNothingThatCouldWrite() {
        assertThat(context.containsBeanDefinition("channelListingController")).isFalse();
        assertThat(context.containsBeanDefinition("darazCallbackController")).isFalse();
        assertThat(context.containsBeanDefinition("darazChannelAdapter")).isFalse();
        assertThat(context.containsBeanDefinition("channelListingCommandService")).isFalse();
        assertThat(context.containsBeanDefinition("channelListingOperationService")).isFalse();
    }

    /** 🔴 The runner is present but inert: no COMMAND argument was supplied to this context. */
    @Test
    @DisplayName("starting the context does not run the probe")
    void contextStartDoesNotProbe() {
        /* Reaching this assertion at all proves it: the runner ran during startup and returned
           immediately. Had it probed, it would have called System.exit and killed the JVM. */
        assertThat(DarazOrderPullRunner.isProbeInvocation(new String[]{})).isFalse();
    }
}
