package com.trioloo.erp;

import com.trioloo.erp.access.infrastructure.bootstrap.OwnerBootstrapApplication;
import com.trioloo.erp.access.infrastructure.bootstrap.OwnerBootstrapRunner;
import com.trioloo.erp.integration.infrastructure.diagnostic.DarazListingShapeApplication;
import com.trioloo.erp.integration.infrastructure.diagnostic.DarazListingShapeRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Trioloo ERP backend entry point.
 *
 * <p>One deployable backend against one authoritative PostgreSQL database, with hard
 * internal module boundaries and no microservices in V1 ({@code TEC-002}).
 *
 * <p>Business modules are added under {@code com.trioloo.erp.<module>} in later bounded
 * steps, each with the four layers fixed by {@code PRJ-030}: {@code domain},
 * {@code application}, {@code infrastructure}, {@code api}. Dependency direction is
 * inward ({@code PRJ-021}) and {@code domain} imports no framework.
 *
 * <p>No business module exists yet. This is the application foundation only.
 */
@SpringBootApplication
public class TriolooErpApplication {

    public static void main(String[] args) {
        /*
          🔴 The one-time Owner bootstrap runs in a SEPARATE, EXPLICITLY SCOPED CONTEXT — not
          this one with the web server switched off. WebApplicationType.NONE stops Tomcat but
          NOT component scanning, so this class's scan still pulled in AuthController and the
          servlet SecurityConfig, and the command died on an AuthenticationConfiguration that
          only a servlet context provides. OwnerBootstrapApplication scans nothing and names
          its dependencies (GAP-120).
          ⚠ AN ORDINARY START IS COMPLETELY UNAFFECTED and still loads the full web
          application: Spring Security, AuthenticationManager, AuthController and all.
        */
        if (OwnerBootstrapRunner.isBootstrapInvocation(args)) {
            SpringApplication bootstrap = new SpringApplication(OwnerBootstrapApplication.class);
            bootstrap.setWebApplicationType(WebApplicationType.NONE);
            bootstrap.run(args);
            return;
        }
        /*
          🔴 THE DARAZ SHAPE PROBE RUNS IN ITS OWN SCOPED CONTEXT, for exactly the reason above.
          A first attempt reused THIS class with the web server switched off and died on
          AuthenticationConfiguration, because NONE stops Tomcat but not component scanning.
          DarazListingShapeApplication scans nothing and names its dependencies.
          ⚠ An ordinary start is unaffected: without the argument the runner returns immediately.
        */
        if (DarazListingShapeRunner.isProbeInvocation(args)) {
            SpringApplication probe = new SpringApplication(DarazListingShapeApplication.class);
            probe.setWebApplicationType(WebApplicationType.NONE);
            probe.run(args);
            return;
        }

        SpringApplication.run(TriolooErpApplication.class, args);
    }
}
