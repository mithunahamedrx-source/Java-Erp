package com.trioloo.erp.access.infrastructure.bootstrap;

import com.trioloo.erp.access.application.OwnerBootstrapService;
import com.trioloo.erp.access.infrastructure.security.CredentialEncodingConfiguration;
import com.trioloo.erp.platform.time.TimeZoneConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * The application context for the first-Owner bootstrap command, and nothing else.
 *
 * <p>🔴 THIS EXISTS BECAUSE {@code WebApplicationType.NONE} IS NOT ISOLATION. Turning the web
 * type off stops Tomcat but does NOT stop component scanning: the main
 * {@code @SpringBootApplication} still scanned {@code AuthController} and {@code SecurityConfig},
 * and {@code SecurityConfig.authenticationManager(…)} needs an {@code AuthenticationConfiguration}
 * that only a servlet context contributes. The command therefore died during context refresh,
 * before it could read a password or create anything.
 *
 * <p>🔴 IT DECLARES ITS DEPENDENCIES EXPLICITLY AND SCANS NOTHING. There is no
 * {@code @ComponentScan} here, so no controller, filter chain or web-security bean can be
 * dragged in by proximity ever again.
 *
 * <p><strong>Loaded:</strong> the datasource, JPA and the entity/repository model, the
 * transaction manager, the canonical {@link CredentialEncodingConfiguration} encoder, the
 * business {@code Clock}, {@link OwnerBootstrapService} and {@link OwnerBootstrapRunner}.
 *
 * <p><strong>Deliberately NOT loaded:</strong> HTTP controllers · the servlet security filter
 * chain · {@code AuthenticationManager} · {@code AuthController} · Tomcat · Spring MVC · any
 * API infrastructure. 🔴 A command that creates one database row needs none of it, and
 * loading it was the defect.
 *
 * <p>⚠ THE NORMAL APPLICATION IS UNTOUCHED. {@code TriolooErpApplication} still starts the
 * full web application with all of the above; this class is reachable only through the
 * explicit {@code bootstrap-owner} argument.
 */
@EnableAutoConfiguration(exclude = {
        /*
          🔴 Web security auto-configuration is excluded outright rather than merely unused.
          This command authenticates nobody — it is authorised by shell access to the host —
          so leaving it available would only invite something to depend on it again.
        */
        SecurityAutoConfiguration.class,
        UserDetailsServiceAutoConfiguration.class,
})
@EntityScan(basePackages = "com.trioloo.erp")
@EnableJpaRepositories(basePackages = "com.trioloo.erp")
@Import({
        CredentialEncodingConfiguration.class,
        TimeZoneConfiguration.class,
        OwnerBootstrapService.class,
        OwnerBootstrapRunner.class,
})
public class OwnerBootstrapApplication {
}
