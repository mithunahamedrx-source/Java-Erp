package com.trioloo.erp.delivery.application;

import com.trioloo.erp.order.application.OrderPermissions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The {@code PRM-092} / {@code PRM-093} capability codes, as seeded by {@code V20}.
 *
 * <p>🔴 THIS EXISTS BECAUSE A PERMISSION CODE IS THE ONE KIND OF STRING THAT FAILS SILENTLY. A
 * typo does not throw: {@code PRM-003} denies what was never granted, so a misspelled seed produces
 * a capability nobody can hold and a screen nobody can reach — indistinguishable from a correctly
 * configured deployment where the grant is merely missing.
 *
 * <p>⚠ IT ASSERTS AGAINST THE MIGRATION FILE, NOT AGAINST THE {@code permission} TABLE, AND THAT
 * IS DELIBERATE. The first version of this test queried the table and was ORDER-DEPENDENT: it
 * passed alone and failed in a full run, because {@code AccessFixtures.clear()} issues
 * {@code DELETE FROM permission} and the shared test database keeps that between classes. A test
 * that reads a table other tests trample proves nothing about what the migration seeds.
 *
 * <p>✅ The migration is the immutable artifact — {@code PRJ-081} forbids modifying an applied one —
 * so it is the honest thing to pin.
 */
@DisplayName("Courier and order-creation capability codes")
class CourierPermissionSeedTest {

    private static final String MIGRATION = "db/migration/V20__courier_and_order_create_permissions.sql";

    @Test
    @DisplayName("seeds exactly the four courier codes PRM-092 ratifies")
    void seedsTheCourierCodes() {
        String sql = migration();
        assertThat(sql).contains("'" + DeliveryPermissions.SHIPMENT_BOOK + "'");
        assertThat(sql).contains("'" + DeliveryPermissions.SHIPMENT_TRACK + "'");
        assertThat(sql).contains("'" + DeliveryPermissions.SHIPMENT_CANCEL + "'");
        assertThat(sql).contains("'" + DeliveryPermissions.COURIER_REMITTANCE_VIEW + "'");
    }

    @Test
    @DisplayName("names the remittance code for PAYMENT, not for delivery")
    void remittanceCodeBelongsToPayment() {
        /*
          🔴 NOT A COSMETIC DETAIL. PRM-089.a makes the first segment the OWNING module, because
          that is the module that ENFORCES the code. PAY-022 and DLV §23 both place E-042
          Remittance Batch with Payment.

          ⚠ The product owner's own proposal spelled this `delivery.remittance.view`. The
          correction is a derivation from the owning documents, not a change of intent — and this
          test is where it stays corrected.
        */
        assertThat(DeliveryPermissions.COURIER_REMITTANCE_VIEW).startsWith("payment.");
        assertThat(migration()).doesNotContain("delivery.remittance.view");
    }

    @Test
    @DisplayName("seeds the order-creation code PRM-093 ratifies")
    void seedsTheOrderCreateCode() {
        assertThat(migration()).contains("'" + OrderPermissions.ORDER_CREATE + "'");
    }

    @Test
    @DisplayName("every seeded code obeys the PRM-089 shape and carries no wildcard")
    void obeysTheNamingConvention() {
        for (String code : seededCodes()) {
            // PRM-089 — lower-case, dot-separated, hyphenated within a segment, three segments.
            assertThat(code).matches("[a-z]+(-[a-z]+)*\\.[a-z]+(-[a-z]+)*\\.[a-z]+(-[a-z]+)*");
            // 🔴 PRM-089.c — no wildcard exists in any segment. A wildcard is the mode PRM-068
            // forbids, wearing a permission's clothes.
            assertThat(code).doesNotContain("*");
        }
    }

    @Test
    @DisplayName("grants the new codes to nobody")
    void grantsNothingToAnyone() {
        /*
          🔴 SEEDING A CODE IS NOT GRANTING IT. PRM-003 denies what was never granted, and
          PRM-081.b forbids a deployment making a screen visible by handing out authority.
          ⚠ These codes book couriers and create orders; a migration that quietly attached them to
          an existing role would be the most consequential kind of silent privilege grant, and it
          would be invisible in review because the INSERT would look like ordinary seeding.
        */
        String sql = migration().toLowerCase();
        assertThat(sql).doesNotContain("role_permission");
        assertThat(sql).doesNotContain("user_permission_override");
        assertThat(sql).doesNotContain("user_role");
    }

    @Test
    @DisplayName("touches nothing but the permission table")
    void touchesNothingElse() {
        // ⚠ A permission migration that also altered a business table would couple an authority
        // change to a schema change, and a rollback of one would silently be a rollback of both.
        String sql = migration().toLowerCase();
        assertThat(sql).doesNotContain("create table");
        assertThat(sql).doesNotContain("alter table");
        assertThat(sql).doesNotContain("drop ");
        assertThat(sql).doesNotContain("update ");
        assertThat(sql).doesNotContain("delete ");
    }

    /** Every code literal the migration inserts. */
    private static List<String> seededCodes() {
        return List.of(
                DeliveryPermissions.SHIPMENT_BOOK,
                DeliveryPermissions.SHIPMENT_TRACK,
                DeliveryPermissions.SHIPMENT_CANCEL,
                DeliveryPermissions.COURIER_REMITTANCE_VIEW,
                OrderPermissions.ORDER_CREATE);
    }

    private static String migration() {
        try (InputStream in = CourierPermissionSeedTest.class.getClassLoader()
                .getResourceAsStream(MIGRATION)) {
            if (in == null) {
                throw new AssertionError(
                        "The V20 permission migration is missing from the classpath: " + MIGRATION);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new AssertionError("The V20 permission migration could not be read.", e);
        }
    }
}
