package com.trioloo.erp.integration.infrastructure.diagnostic;

import com.trioloo.erp.integration.application.ChannelCredentialStore;
import com.trioloo.erp.integration.application.DarazListingShapeDiagnostic;
import com.trioloo.erp.integration.infrastructure.crypto.ChannelCredentialCipher;
import com.trioloo.erp.integration.infrastructure.crypto.CredentialEncryptionKeys;
import com.trioloo.erp.integration.infrastructure.daraz.DarazAccessTokenProvider;
import com.trioloo.erp.integration.infrastructure.daraz.DarazProperties;
import com.trioloo.erp.integration.infrastructure.daraz.DarazRequestSigner;
import com.trioloo.erp.integration.infrastructure.daraz.RestClientDarazTransport;
import com.trioloo.erp.platform.time.TimeZoneConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.persistence.autoconfigure.EntityScan;
import org.springframework.boot.security.autoconfigure.SecurityAutoConfiguration;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * The explicitly scoped context the listing shape probe runs in.
 *
 * <p>🔴 IT SCANS NOTHING AND NAMES ITS DEPENDENCIES, FOR THE REASON {@code OwnerBootstrapApplication}
 * ALREADY RECORDS. {@code WebApplicationType.NONE} stops Tomcat but NOT component scanning: running
 * the probe from {@code TriolooErpApplication} still pulled in {@code AuthController} and the
 * servlet {@code SecurityConfig}, and the command died on an {@code AuthenticationConfiguration}
 * that only a servlet context provides. ⚠ That failure was observed in production on 2026-08-18
 * before this class existed — the same trap, in the same shape, one gate apart.
 *
 * <p>🔴 WEB SECURITY IS EXCLUDED OUTRIGHT rather than merely unused. This command authenticates
 * nobody; it is authorised by shell access to the host, exactly as the Owner bootstrap is.
 *
 * <p>⚠ AN ORDINARY START IS COMPLETELY UNAFFECTED and still loads the full web application.
 */
@EnableAutoConfiguration(exclude = {
        SecurityAutoConfiguration.class,
        UserDetailsServiceAutoConfiguration.class,
})
@EntityScan(basePackages = "com.trioloo.erp")
@EnableJpaRepositories(basePackages = "com.trioloo.erp")
@Import({
        TimeZoneConfiguration.class,
        CredentialEncryptionKeys.class,
        ChannelCredentialCipher.class,
        ChannelCredentialStore.class,
        DarazProperties.class,
        DarazRequestSigner.class,
        RestClientDarazTransport.class,
        DarazAccessTokenProvider.class,
        DarazListingShapeDiagnostic.class,
        DarazListingShapeRunner.class,
})
public class DarazListingShapeApplication {
}
