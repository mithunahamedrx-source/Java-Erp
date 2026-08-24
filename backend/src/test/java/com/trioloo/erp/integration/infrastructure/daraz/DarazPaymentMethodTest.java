package com.trioloo.erp.integration.infrastructure.daraz;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The Daraz payment-method translation — {@code BR-005}.
 *
 * <p>⚠ EVERY VALUE BELOW WAS READ FROM PRODUCTION on 2026-08-24, not imagined. A translation built
 * against invented tokens would pass here and miss every real one.
 */
@DisplayName("Daraz payment method")
class DarazPaymentMethodTest {

    @Test
    @DisplayName("translates the brands the product owner named")
    void translatesTheNamedBrands() {
        // ✅ The owner's decision, 2026-08-24. `GNBKASH_TOKEN_EBANK` and `MIXEDCARD` are the
        // provider's internal tokens and mean nothing to an operator.
        assertThat(DarazPaymentMethod.forDisplay("GNBKASH_TOKEN_EBANK")).isEqualTo("bKash");
        assertThat(DarazPaymentMethod.forDisplay("MIXEDCARD")).isEqualTo("Card");
    }

    @Test
    @DisplayName("translates a wallet whose token names its brand outright")
    void translatesNagad() {
        // ⚠ Translated by the SAME test as bKash: the token names the brand, so reading it is
        // transcription rather than interpretation.
        assertThat(DarazPaymentMethod.forDisplay("WALLET_NAGADBD")).isEqualTo("Nagad");
    }

    @Test
    @DisplayName("🔴 refuses to name a bank instalment product")
    void refusesToNameAnInstalmentProduct() {
        /*
          🔴 THE LINE THIS CLASS DRAWS. `EASTERN_BANK_MANUAL_IPP` and
          `LANKABANGLA_FINANCE_MANUAL_IPP` encode a bank's INSTALMENT PRODUCT, not a brand. What to
          call one on an operator's screen — and whether an instalment plan should read differently
          from an outright card payment at all — is a business decision.

          ⚠ SYS-034: the raw value stands so the operator sees what the channel said rather than a
          label Trioloo invented.
        */
        assertThat(DarazPaymentMethod.readable("EASTERN_BANK_MANUAL_IPP")).isEmpty();
        assertThat(DarazPaymentMethod.forDisplay("EASTERN_BANK_MANUAL_IPP"))
                .isEqualTo("EASTERN_BANK_MANUAL_IPP");
        assertThat(DarazPaymentMethod.readable("LANKABANGLA_FINANCE_MANUAL_IPP")).isEmpty();
    }

    @Test
    @DisplayName("leaves an unknown token exactly as the channel sent it")
    void leavesAnUnknownTokenAlone() {
        // ⚠ A token nobody has mapped is shown, not blanked. An empty payment method reads as
        // "none recorded", which is a different and wrong fact (BR-134).
        assertThat(DarazPaymentMethod.forDisplay("SOME_NEW_WALLET_2027"))
                .isEqualTo("SOME_NEW_WALLET_2027");
    }

    @Test
    @DisplayName("treats absence as absence")
    void treatsAbsenceAsAbsence() {
        assertThat(DarazPaymentMethod.forDisplay(null)).isNull();
        assertThat(DarazPaymentMethod.forDisplay("   ")).isNull();
    }

    @Test
    @DisplayName("is case- and whitespace-tolerant")
    void toleratesFormatting() {
        assertThat(DarazPaymentMethod.forDisplay("  gnbkash_token_ebank  ")).isEqualTo("bKash");
    }
}
