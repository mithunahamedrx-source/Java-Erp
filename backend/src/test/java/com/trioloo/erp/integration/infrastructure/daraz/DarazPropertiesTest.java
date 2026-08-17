package com.trioloo.erp.integration.infrastructure.daraz;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Provider configuration.
 *
 * <p>⚠ The values here are obvious fakes. 🔴 No real App Key or App Secret exists in this
 * repository, and none is needed to prove any of this.
 */
class DarazPropertiesTest {

    private static final String KEY = "000000-test-app-key";
    private static final String SECRET = "test-app-secret-not-a-real-value";
    private static final String REDIRECT = "https://example.test/api/integration/daraz/callback";

    // ------------------------------------------------------------------ configured

    @Test
    @DisplayName("a complete configuration resolves every value")
    void completeConfiguration() {
        DarazProperties.Configured configured =
                new DarazProperties(KEY, SECRET, REDIRECT).require();

        assertThat(configured.appKey()).isEqualTo(KEY);
        assertThat(configured.appSecret()).isEqualTo(SECRET);
        assertThat(configured.redirectUri()).isEqualTo(REDIRECT);
    }

    @Test
    @DisplayName("surrounding whitespace is tolerated")
    void valuesAreTrimmed() {
        DarazProperties.Configured configured =
                new DarazProperties("  " + KEY + " ", " " + SECRET + "  ", " " + REDIRECT + " ").require();

        assertThat(configured.appKey()).isEqualTo(KEY);
        assertThat(configured.redirectUri()).isEqualTo(REDIRECT);
    }

    // ------------------------------------------------------------------ absence

    /**
     * 🔴 THE RULE THAT KEEPS AN UNRELATED ERP RUNNING. Constructing the bean must never throw,
     * or an environment that has nothing to do with Daraz cannot start.
     */
    @Test
    @DisplayName("absent configuration constructs cleanly and is simply reported as unconfigured")
    void absentConfigurationDoesNotThrowOnConstruction() {
        assertThatCode(() -> new DarazProperties("", "", "")).doesNotThrowAnyException();
        assertThatCode(() -> new DarazProperties(null, null, null)).doesNotThrowAnyException();

        assertThat(new DarazProperties("", "", "").isConfigured()).isFalse();
        assertThat(new DarazProperties(KEY, SECRET, REDIRECT).isConfigured()).isTrue();
    }

    @Test
    @DisplayName("each missing value is refused BY NAME, only when configuration is actually needed")
    void missingValuesAreNamed() {
        assertThatThrownBy(() -> new DarazProperties("", SECRET, REDIRECT).require())
                .isInstanceOf(DarazConfigurationException.class)
                .hasMessageContaining("DARAZ_APP_KEY")
                .extracting(e -> ((DarazConfigurationException) e).variableName())
                .isEqualTo("DARAZ_APP_KEY");

        assertThatThrownBy(() -> new DarazProperties(KEY, "", REDIRECT).require())
                .isInstanceOf(DarazConfigurationException.class)
                .hasMessageContaining("DARAZ_APP_SECRET");

        assertThatThrownBy(() -> new DarazProperties(KEY, SECRET, "").require())
                .isInstanceOf(DarazConfigurationException.class)
                .hasMessageContaining("DARAZ_OAUTH_REDIRECT_URI");
    }

    // ------------------------------------------------------------------ redirect validation

    @Test
    @DisplayName("the redirect URI must be absolute and https")
    void redirectMustBeAbsoluteHttps() {
        assertThatThrownBy(() -> new DarazProperties(KEY, SECRET, "/api/callback").require())
                .isInstanceOf(DarazConfigurationException.class)
                .hasMessageContaining("absolute");

        assertThatThrownBy(() -> new DarazProperties(KEY, SECRET, "http://example.test/cb").require())
                .isInstanceOf(DarazConfigurationException.class)
                .hasMessageContaining("https");
    }

    /** ⚠ No production hostname is pinned into Java — that would make the app unrunnable elsewhere. */
    @Test
    @DisplayName("any https host is accepted; no production hostname is hard-coded")
    void noHostnameIsPinned() {
        assertThatCode(() -> new DarazProperties(KEY, SECRET, "https://localhost.test/cb").require())
                .doesNotThrowAnyException();
        assertThatCode(() -> new DarazProperties(KEY, SECRET, "https://anything.example/x/y").require())
                .doesNotThrowAnyException();
    }

    // ------------------------------------------------------------------ secret hygiene

    /** 🔴 A configuration object is exactly the kind of thing that ends up in a debug log. */
    @Test
    @DisplayName("neither the properties nor the resolved configuration ever prints the App Secret")
    void secretIsNeverPrinted() {
        DarazProperties properties = new DarazProperties(KEY, SECRET, REDIRECT);

        assertThat(properties.toString()).doesNotContain(SECRET);
        assertThat(properties.require().toString()).doesNotContain(SECRET).contains("REDACTED");
    }

    @Test
    @DisplayName("no configuration failure quotes any configured value")
    void failuresQuoteNoValues() {
        assertThatThrownBy(() -> new DarazProperties(KEY, SECRET, "http://example.test/cb").require())
                .satisfies(e -> {
                    assertThat(e.getMessage()).doesNotContain(SECRET);
                    assertThat(e.getMessage()).doesNotContain(KEY);
                    assertThat(e.getMessage()).doesNotContain("example.test");
                });
    }
}
