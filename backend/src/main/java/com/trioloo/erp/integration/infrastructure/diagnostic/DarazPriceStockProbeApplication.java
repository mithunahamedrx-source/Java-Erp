package com.trioloo.erp.integration.infrastructure.diagnostic;

import com.trioloo.erp.integration.application.ChannelCredentialStore;
import com.trioloo.erp.integration.application.DarazPriceStockProbe;
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
 * The explicitly scoped context the price and stock write probe runs in.
 *
 * <p>🔴 IT SCANS NOTHING AND NAMES ITS DEPENDENCIES, for the reason {@code DarazListingShapeApplication}
 * already records: {@code WebApplicationType.NONE} stops Tomcat but NOT component scanning, and a
 * scanned start pulls in the servlet security graph this command has no use for.
 *
 * <p>🔴 THE IMPORT LIST IS THE PROBE'S BLAST RADIUS, AND IT IS DELIBERATELY SHORT. No listing
 * writer, no operation recorder, no adapter, no scheduler and no controller is named here — so
 * there is no bean in this context that COULD mutate a listing, a product or an inventory row,
 * whatever the probe were asked to do.
 *
 * <p>⚠ Read-only repositories reach it through {@code @EnableJpaRepositories}; the probe uses four
 * of them and calls only finders.
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
        DarazPriceStockProbe.class,
        DarazPriceStockProbeRunner.class,
})
public class DarazPriceStockProbeApplication {
}
