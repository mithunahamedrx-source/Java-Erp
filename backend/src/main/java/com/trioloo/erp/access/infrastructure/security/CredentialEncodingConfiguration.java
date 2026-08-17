package com.trioloo.erp.access.infrastructure.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * The ONE credential-hashing authority for the whole system.
 *
 * <p>🔴 EXTRACTED FROM {@code SecurityConfig} DELIBERATELY. Password hashing is not a web
 * concern: the HTTP login path and the non-web first-Owner bootstrap command must produce and
 * verify the SAME format, or a bootstrapped Owner could not sign in. Leaving the encoder
 * inside the servlet security configuration made it unreachable from a non-web context, and
 * the only alternatives would have been to start a web context for a command that needs none,
 * or to declare a second encoder — which is a second credential model by another name.
 *
 * <p>🔴 THERE IS EXACTLY ONE {@link PasswordEncoder} BEAN IN THE APPLICATION, and both modes
 * import this class to get it. No bootstrap-specific hashing, no duplicated bcrypt settings,
 * no separate credential format ({@code AGV 2.2}, {@code PRM 2.2}).
 */
@Configuration
public class CredentialEncodingConfiguration {

    /**
     * Delegating encoder: hashes with bcrypt and can still verify older prefixed formats.
     * Plaintext is never stored.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
