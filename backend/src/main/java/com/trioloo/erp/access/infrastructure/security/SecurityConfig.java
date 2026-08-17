package com.trioloo.erp.access.infrastructure.security;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.session.SessionFixationProtectionStrategy;
import org.springframework.http.HttpMethod;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Technical enforcement layer over canonical permissions.
 *
 * <p>🔴 Spring Security owns none of the business meaning here. Roles, permissions, Owner
 * and Administrator authority, approval rules and account lifecycle are owned by
 * {@code PERMISSION_ARCHITECTURE.md} and {@code ACCESS_GOVERNANCE_ARCHITECTURE.md}; this
 * class consumes them ({@code PRM} P4 — enforcement is server-side and universal).
 *
 * <p><strong>Mechanism: server-side session with a cookie.</strong> Chosen over JWT because
 * the frozen architecture requires authority that can be withdrawn immediately — a
 * {@code SUSPENDED} or {@code DISABLED} profile must lose access at once ({@code PRM} 7.1),
 * and {@code AGV-025} suspends overrides into review on a role change. A stateless bearer
 * token remains valid until it expires, so revocation would need a server-side deny list —
 * a session store by another name, with worse failure modes. React is not a reason to
 * choose JWT ({@code TEC-090} places the frontend and backend in one ERP system).
 */
@Configuration
@EnableMethodSecurity
@Import(CredentialEncodingConfiguration.class)
public class SecurityConfig {

    /*
      ⚠ The PasswordEncoder bean moved to CredentialEncodingConfiguration. Hashing is not a
      web concern, and the non-web first-Owner bootstrap command must use the SAME encoder as
      the login path — one credential model, one authority. This class still consumes it
      through the AuthenticationManager exactly as before.
    */

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        // CSRF token in a cookie the SPA can read and echo back as X-XSRF-TOKEN.
        // CSRF stays ENABLED for every state-changing request - it is not disabled to make
        // React convenient.
        CookieCsrfTokenRepository csrfRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();

        http
            // Resolves the bean named corsConfigurationSource below. Taking it as a
            // constructor parameter would clash with Spring MVC's own
            // mvcHandlerMappingIntrospector, which also implements the type.
            .cors(Customizer.withDefaults())
            .csrf(c -> c.csrfTokenRepository(csrfRepository).csrfTokenRequestHandler(csrfHandler))
            .sessionManagement(s -> s
                    .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                    // Session fixation: a brand-new session id is issued on authentication,
                    // so a pre-authentication id cannot be replayed afterwards.
                    .sessionFixation(fixation -> fixation.newSession()))
            .authorizeHttpRequests(auth -> auth
                    // Reachable unauthenticated, by necessity: you cannot log in through a
                    // gate that requires being logged in. Only these three.
                    .requestMatchers("/api/auth/login", "/api/auth/csrf").permitAll()

                    /*
                      🔴 THE PROVIDER'S CALLBACK, WHICH CANNOT CARRY AN ERP SESSION BY RIGHT. Daraz
                      redirects the seller's browser here from its own site; requiring authentication
                      would make the flow depend on a cookie surviving a cross-site redirect, which
                      the unratified SameSite policy could silently change.
                      ✅ THE ONE-TIME STATE IS THE AUTHORISATION: it was issued to an actor holding
                      integration.channel-connection.authorize, is bound to exactly one shop, expires,
                      and is consumable once (TEC-120). Without it this route does nothing at all.
                    */
                    .requestMatchers(HttpMethod.GET, "/api/integration/daraz/callback").permitAll()
                    // Liveness/readiness only. It exposes no business data and is required
                    // for deployment probes; management endpoints are limited to health in
                    // application.yml.
                    .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                    // 🔴 Everything else, including every future business endpoint, requires
                    // authentication. Deny by default (PRM P3) - there is no broad permitAll.
                    .anyRequest().authenticated())
            // Unauthenticated -> 401. Distinct from authenticated-but-forbidden, which
            // Spring Security answers 403. No implementation detail is disclosed either way.
            .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
            // No HTTP Basic: the ERP login UX is the JSON endpoint, and a Basic prompt
            // would bypass it. No Spring form login and no Spring logout handler either -
            // both are replaced by explicit endpoints in AuthController so that the
            // INVITED -> ACTIVE transition happens in one deliberate, transactional place.
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())
            .logout(logout -> logout.disable());

        return http.build();
    }

    /**
     * CORS for the local Vite dev server only.
     *
     * <p>The allowed origin comes from configuration and defaults to the local Vite port.
     * 🔴 There is no wildcard: credentials are allowed, so a wildcard origin would be both
     * rejected by browsers and wrong. A deployment sets {@code app.cors.allowed-origins} to
     * its real origin.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins:http://localhost:5173}") List<String> allowedOrigins) {

        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN", "Accept"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
