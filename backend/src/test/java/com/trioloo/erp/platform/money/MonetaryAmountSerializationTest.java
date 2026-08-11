package com.trioloo.erp.platform.money;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.json.JsonTest;
import tools.jackson.databind.ObjectMapper;

/**
 * Proves the {@code TEC-015} wire contract at RUNTIME, not merely that the annotation
 * compiles.
 *
 * <p>{@code TEC-015} calls this "the single most likely place for {@code DB-037} to be
 * violated in practice": Jackson serialises {@code BigDecimal} as a JSON number by default,
 * and JavaScript parses every JSON number as an IEEE-754 double, so an exact amount would
 * silently lose exactness on the round trip.
 *
 * <p>This matters more than usual on this stack. Spring Boot 4.1 resolves Jackson 3
 * ({@code tools.jackson.databind}) for databind while annotations remain at
 * {@code com.fasterxml.jackson.annotation} 2.x. That the annotation compiles proves
 * nothing about whether Jackson 3 honours it; only serialising does.
 *
 * <p>Uses a Jackson-only slice, so it needs no database.
 */
@JsonTest
class MonetaryAmountSerializationTest {

    @Autowired
    private ObjectMapper objectMapper;

    /** A response DTO shaped the way every future money-carrying DTO must be. */
    record MoneyCarryingResponse(@MonetaryAmount BigDecimal saleAmount, String currency) {}

    /** An identical DTO WITHOUT the annotation, to prove the default really is the unsafe one. */
    record UnannotatedResponse(BigDecimal saleAmount) {}

    @Test
    void annotatedMonetaryAmountIsSerialisedAsJsonString() {
        var payload = new MoneyCarryingResponse(new BigDecimal("842300.55"), "BDT");

        String json = objectMapper.writeValueAsString(payload);

        // The exact-decimal contract: a QUOTED value, never a bare JSON number.
        assertThat(json).contains("\"saleAmount\":\"842300.55\"");
        assertThat(json).doesNotContain("\"saleAmount\":842300.55");

        // TEC-017 - currency travels with every monetary value, even with one V1 currency.
        assertThat(json).contains("\"currency\":\"BDT\"");
    }

    /** Trailing zeros are part of the value. 2.50 must not arrive as 2.5. */
    @Test
    void scaleIsPreservedOnTheWire() {
        var payload = new MoneyCarryingResponse(new BigDecimal("2.50"), "BDT");

        assertThat(objectMapper.writeValueAsString(payload)).contains("\"saleAmount\":\"2.50\"");
    }

    /** A string on the wire deserialises back to an exactly equal BigDecimal. */
    @Test
    void roundTripPreservesExactValue() {
        var original = new BigDecimal("842300.55");

        String json = objectMapper.writeValueAsString(new MoneyCarryingResponse(original, "BDT"));
        MoneyCarryingResponse back = objectMapper.readValue(json, MoneyCarryingResponse.class);

        // TEC-014 - BigDecimal equality uses compareTo, never equals.
        assertThat(back.saleAmount()).usingComparator(BigDecimal::compareTo).isEqualTo(original);
    }

    /**
     * Guards the reason the annotation exists. If this ever fails, Jackson's default became
     * safe on its own and the annotation could be reconsidered - but until then, an
     * unannotated BigDecimal really does go out as a bare JSON number.
     */
    @Test
    void unannotatedBigDecimalDemonstratesTheUnsafeDefault() {
        var json = objectMapper.writeValueAsString(new UnannotatedResponse(new BigDecimal("842300.55")));

        assertThat(json).contains("\"saleAmount\":842300.55");
    }
}
