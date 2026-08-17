package com.trioloo.erp.access;

import com.trioloo.erp.access.application.OwnerBootstrapService;
import com.trioloo.erp.access.infrastructure.bootstrap.OwnerBootstrapApplication;
import com.trioloo.erp.access.infrastructure.bootstrap.OwnerBootstrapRunner;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE REGRESSION TEST FOR THE PRODUCTION FAILURE.
 *
 * <p>🔴 WHAT BROKE, AND WHY NOTHING CAUGHT IT. The bootstrap command ran the MAIN
 * {@code @SpringBootApplication} with the web type set to {@code NONE}. That stops Tomcat but
 * NOT component scanning, so {@code AuthController} and the servlet {@code SecurityConfig}
 * were still created, and {@code SecurityConfig.authenticationManager(…)} required an
 * {@code AuthenticationConfiguration} that only a servlet context contributes. The context
 * refresh was cancelled and the command died BEFORE reading a password — while every existing
 * test passed, because they all called {@link OwnerBootstrapService} inside a fully-wired
 * {@code @SpringBootTest} web context that has those beans.
 *
 * <p>🔴 THIS TEST BOOTS THE REAL BOOTSTRAP CONTEXT, exactly as production does, and asserts
 * what must NOT be in it. A unit test of the service could never have caught this; only
 * starting the actual launch mode can.
 */
class OwnerBootstrapContextTest {

    private ConfigurableApplicationContext bootstrapContext() {
        return new SpringApplicationBuilder(OwnerBootstrapApplication.class)
                .web(WebApplicationType.NONE)
                .run();
    }

    /**
     * 🔴 THE CLAIM THAT FAILED IN PRODUCTION: the context starts at all.
     */
    @Test
    @DisplayName("the bootstrap context starts in NON-WEB mode without web security")
    void bootstrapContextStarts() {
        try (ConfigurableApplicationContext context = bootstrapContext()) {
            assertThat(context.isActive()).isTrue();
            /* The command's own collaborators must be present and usable. */
            assertThat(context.getBean(OwnerBootstrapService.class)).isNotNull();
            assertThat(context.getBean(OwnerBootstrapRunner.class)).isNotNull();
            assertThat(context.getBean(PasswordEncoder.class)).isNotNull();
        }
    }

    /** 🔴 Not a servlet context — so no Tomcat, and no port to collide with the service. */
    @Test
    @DisplayName("the bootstrap context starts no web server")
    void noWebServerIsStarted() {
        try (ConfigurableApplicationContext context = bootstrapContext()) {
            assertThat(context)
                    .isNotInstanceOf(org.springframework.boot.web.server.context.WebServerApplicationContext.class);
            assertThat(context.getBeanNamesForType(
                    org.springframework.boot.web.server.WebServerFactory.class)).isEmpty();
        }
    }

    /**
     * 🔴 THE EXACT BEANS THAT BROKE IT. If any of these reappears in the bootstrap context,
     * the command is one refactor away from dying in production again.
     */
    @Test
    @DisplayName("the bootstrap context instantiates no controller and no web security infrastructure")
    void noWebInfrastructureIsLoaded() {
        try (ConfigurableApplicationContext context = bootstrapContext()) {
            assertThat(context.containsBeanDefinition("authController")).isFalse();
            assertThat(context.containsBeanDefinition("securityConfig")).isFalse();
            assertThat(context.getBeanNamesForType(
                    org.springframework.security.authentication.AuthenticationManager.class)).isEmpty();
            assertThat(context.getBeanNamesForType(
                    org.springframework.security.config.annotation.authentication.configuration
                            .AuthenticationConfiguration.class)).isEmpty();
            /* No REST surface of any kind reached this context. */
            assertThat(context.getBeanNamesForAnnotation(
                    org.springframework.web.bind.annotation.RestController.class)).isEmpty();
        }
    }

    /**
     * ⚠ The runner is reached and performs real work: it validates its inputs and refuses
     * before touching the database. This is the boundary the production failure never got to.
     */
    @Test
    @DisplayName("the bootstrap service is reachable and validates inside the real context")
    void serviceIsReachableAndValidates() {
        try (ConfigurableApplicationContext context = bootstrapContext()) {
            OwnerBootstrapService service = context.getBean(OwnerBootstrapService.class);

            assertThatThrownBy(() -> service.bootstrapFirstOwner("  ", "Nobody", "pw".toCharArray()))
                    .isInstanceOf(OwnerBootstrapService.BootstrapRefusedException.class);
        }
    }

    /**
     * 🔴 ONE CREDENTIAL MODEL. A hash produced in the bootstrap context must verify against
     * the encoder the login path uses — otherwise a bootstrapped Owner could never sign in.
     */
    @Test
    @DisplayName("the bootstrap context uses the same canonical password encoder as login")
    void oneCredentialModel() {
        String hash;
        try (ConfigurableApplicationContext context = bootstrapContext()) {
            hash = context.getBean(PasswordEncoder.class).encode("a-shared-secret-value");
        }
        assertThat(hash).startsWith("{bcrypt}");

        /* The web application's encoder, from the same single bean definition. */
        PasswordEncoder webEncoder = new com.trioloo.erp.access.infrastructure.security
                .CredentialEncodingConfiguration().passwordEncoder();
        assertThat(webEncoder.matches("a-shared-secret-value", hash)).isTrue();
    }

    /** ⚠ The command really does end the process rather than lingering as a service. */
    @Test
    @DisplayName("the bootstrap context closes cleanly")
    void contextClosesCleanly() {
        ConfigurableApplicationContext context = bootstrapContext();
        UUID.randomUUID();
        context.close();
        assertThat(context.isActive()).isFalse();
    }
}
