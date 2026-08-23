package com.trioloo.erp.order.application;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The ratified Order MVP codes, pinned character for character.
 *
 * <p>🔴 THE STRINGS ARE THE CONTRACT. {@code PRM-091} names them and {@code PRM-089.f} forbids
 * implementation coining one, so a typo here is not a cosmetic defect — it is a permission that
 * was never ratified, which {@code PRM-003} denies and which would lock every holder out.
 */
class OrderPermissionsTest {

    @Test
    @DisplayName("🔴 both ratified codes exist with their exact PRM-091 spelling")
    void codesMatchTheRatifiedNames() {
        assertThat(OrderPermissions.CHANNEL_ORDER_VIEW).isEqualTo("order.channel-order.view");
        assertThat(OrderPermissions.CHANNEL_ORDER_SYNC).isEqualTo("order.channel-order.sync");
    }

    /** 🔴 {@code PRM-089.a} — the first segment is the OWNING MODULE, and it is Order Management. */
    @Test
    @DisplayName("🔴 every code carries three segments and the `order` module segment")
    void codesFollowTheNamingConvention() {
        for (String code : declaredCodes()) {
            assertThat(code.split("\\.")).as(code).hasSize(3);
            assertThat(code).as(code).startsWith("order.");
            assertThat(code).as(code).isLowerCase();
        }
    }

    /** 🔴 {@code PRM-089.c} — no wildcard exists, in any segment. */
    @Test
    @DisplayName("🔴 no wildcard appears in any segment")
    void noWildcardExists() {
        for (String code : declaredCodes()) {
            assertThat(code).as(code).doesNotContain("*");
        }
    }

    /**
     * 🔴 EVERY CONSTANT HERE IS RATIFIED BY NAME, AND THE COUNT IS THE TRIPWIRE.
     * {@code PRM-089.b} states the shape is not a generator, so a constant appearing here without
     * a `PRM-` rule behind it is an INVENTED capability — which {@code PRM-089.f} forbids outright.
     *
     * <p>⚠ AMENDED 2026-08-24, AND THE TRIPWIRE DID ITS JOB. This asserted exactly TWO while
     * {@code PRM-091} was the only rule. {@code PRM-093} then ratified {@code order.order.create}
     * on the product owner's decision, and the test FAILED until the ratified set was updated here
     * — which is precisely the moment it exists to create. ✅ It is widened to the new ratified
     * set, never loosened into a range.
     */
    @Test
    @DisplayName("🔴 exactly the ratified codes exist — no capability was invented alongside them")
    void onlyTheRatifiedCodesExist() {
        assertThat(declaredCodes())
                .containsExactlyInAnyOrder(
                        "order.channel-order.view",   // PRM-091
                        "order.channel-order.sync",   // PRM-091
                        "order.order.create");        // PRM-093
    }

    private static List<String> declaredCodes() {
        List<String> codes = new ArrayList<>();
        for (Field field : OrderPermissions.class.getDeclaredFields()) {
            if (Modifier.isStatic(field.getModifiers()) && field.getType() == String.class) {
                try {
                    codes.add((String) field.get(null));
                } catch (IllegalAccessException e) {
                    throw new AssertionError(e);
                }
            }
        }
        return codes;
    }
}
