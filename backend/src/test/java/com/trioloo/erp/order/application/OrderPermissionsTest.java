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
     * 🔴 MVP MEANS TWO. {@code PRM-091.c} keeps probe, incremental poll and backfill on ONE sync
     * code, and {@code PRM-089.b} states the shape is not a generator — so a third constant
     * appearing here is an invented capability until `PRM-` ratifies it.
     */
    @Test
    @DisplayName("🔴 exactly two codes exist — no capability was invented alongside them")
    void onlyTheMvpCodesExist() {
        assertThat(declaredCodes()).hasSize(2);
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
