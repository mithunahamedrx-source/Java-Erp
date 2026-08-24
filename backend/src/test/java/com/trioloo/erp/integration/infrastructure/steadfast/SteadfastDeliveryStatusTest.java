package com.trioloo.erp.integration.infrastructure.steadfast;

import com.trioloo.erp.delivery.domain.ShipmentState;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The Steadfast → {@code SM-4} translation — {@code BR-005}, {@code OM §4.3}.
 *
 * <p>🔴 THE REFUSALS ARE THE SUBSTANCE OF THIS TEST, NOT ITS EDGE CASES. Eleven provider values
 * exist and five entries map; the rest are refused with a reason, and each refusal is a rule
 * someone would otherwise break by writing the "obvious" mapping.
 */
@DisplayName("Steadfast delivery status translation")
class SteadfastDeliveryStatusTest {

    /** Every value the provider publishes. */
    private static final List<String> PUBLISHED = List.of(
            "pending", "delivered_approval_pending", "partial_delivered_approval_pending",
            "cancelled_approval_pending", "unknown_approval_pending", "delivered",
            "partial_delivered", "cancelled", "hold", "in_review", "unknown");

    @Test
    @DisplayName("knows every published value, mapped or refused")
    void knowsEveryPublishedValue() {
        // ⚠ If the provider adds a value, this fails and the new one gets a DECISION rather than
        // silently falling through to "untranslated" forever.
        for (String value : PUBLISHED) {
            assertThat(SteadfastDeliveryStatus.isPublishedValue(value)).as(value).isTrue();
        }
    }

    @Test
    @DisplayName("translates in_review to BOOKED, not to AWAITING_PICKUP")
    void inReviewIsBooked() {
        // ⚠ The provider defines it as "order placed, under review" — the consignment exists and
        // nothing was said about a pickup being scheduled. AWAITING_PICKUP would assert a fact the
        // courier did not report (DLV-025 — the courier is system of record).
        assertThat(SteadfastDeliveryStatus.toShipmentState("in_review"))
                .contains(ShipmentState.BOOKED);
    }

    @Test
    @DisplayName("treats an approval-pending outcome as the same physical outcome")
    void approvalPendingIsTheSameMovement() {
        /*
          ⚠ The provider's two forms differ only in whether ITS balance has been updated:
          "delivered, awaiting admin approval" versus "delivered and balance updated".
          🔴 That is the courier's ACCOUNTING, and SM-4's subject is the parcel's physical
          movement (E-037). The money side is SM-5's, where BR-035 already separates collection
          from receipt — so mapping the accounting distinction into SM-4 would put a payment fact
          in a delivery machine.
        */
        assertThat(SteadfastDeliveryStatus.toShipmentState("delivered_approval_pending"))
                .contains(ShipmentState.DELIVERED);
        assertThat(SteadfastDeliveryStatus.toShipmentState("delivered"))
                .contains(ShipmentState.DELIVERED);
        assertThat(SteadfastDeliveryStatus.toShipmentState("cancelled_approval_pending"))
                .contains(ShipmentState.CANCELLED);
    }

    @Test
    @DisplayName("🔴 refuses `pending`, because SM-4 is finer than the provider reports")
    void refusesPending() {
        // "Not yet delivered or cancelled" spans IN_TRANSIT, AT_HUB and OUT_FOR_DELIVERY at once.
        // Choosing one would state a position the courier never gave (SYS-034).
        assertThat(SteadfastDeliveryStatus.toShipmentState("pending")).isEmpty();
        assertThat(SteadfastDeliveryStatus.refusalReason("pending"))
                .get().asString().contains("IN_TRANSIT");
    }

    @Test
    @DisplayName("🔴 refuses `hold`, because SM-4 has no hold and ON_HOLD is the ORDER's")
    void refusesHold() {
        /*
          🔴 THE DANGEROUS MAPPING THIS PREVENTS. ON_HOLD is an SM-1 state placed by whoever
          decided to suspend the order (BR-151). A courier saying "hold" is a fact about a parcel.
          ⚠ Mapping one onto the other would let a third party move Trioloo's own order lifecycle.
        */
        assertThat(SteadfastDeliveryStatus.toShipmentState("hold")).isEmpty();
        assertThat(SteadfastDeliveryStatus.refusalReason("hold"))
                .get().asString().contains("ON_HOLD belongs to SM-1");
    }

    @Test
    @DisplayName("🔴 refuses `unknown`, and never reads it as LOST")
    void refusesUnknownAndNeverInfersLost() {
        /*
          🔴 LOST IS THE MOST EXPENSIVE WRONG ANSWER AVAILABLE HERE — it opens claims and writes
          off goods. DLV-027 admits it ONLY on the courier's official confirmation that a parcel
          cannot be delivered and cannot be recovered, and DLV-028 forbids an elapsed-time
          threshold standing in for that. "unknown" is the provider telling us to call support.
        */
        for (String value : List.of("unknown", "unknown_approval_pending")) {
            assertThat(SteadfastDeliveryStatus.toShipmentState(value)).as(value).isEmpty();
        }
        assertThat(SteadfastDeliveryStatus.refusalReason("unknown"))
                .get().asString().contains("DLV-027");
    }

    @Test
    @DisplayName("🔴 refuses partial delivery, which this architecture withdrew")
    void refusesPartialDelivery() {
        /*
          🔴 THE COURIER CAN REPORT SOMETHING THE BUSINESS DECIDED CANNOT HAPPEN. BD-442 removed
          PARTIALLY_DELIVERED from SM-1, withdrew BR-025, and BR-158/BR-159 fix one order as one
          parcel per attempt. ⚠ Recorded as GAP-140 rather than resolved by mapping it to
          DELIVERED — which would silently report a partial delivery as a complete one.
        */
        for (String value : List.of("partial_delivered", "partial_delivered_approval_pending")) {
            assertThat(SteadfastDeliveryStatus.toShipmentState(value)).as(value).isEmpty();
        }
        assertThat(SteadfastDeliveryStatus.refusalReason("partial_delivered"))
                .get().asString().contains("GAP-140");
    }

    @Test
    @DisplayName("never maps anything to LOST, DAMAGED or RETURNED_TO_WAREHOUSE")
    void neverMapsToTheExpensiveStates() {
        // ⚠ No provider value reaches these, and none should by accident. Each has real financial
        // consequence — claims, write-offs, restocking — and DLV-027 governs LOST specifically.
        List<ShipmentState> reached = PUBLISHED.stream()
                .map(SteadfastDeliveryStatus::toShipmentState)
                .flatMap(java.util.Optional::stream)
                .toList();

        assertThat(reached).doesNotContain(
                ShipmentState.LOST, ShipmentState.DAMAGED, ShipmentState.RETURNED_TO_WAREHOUSE);
    }

    @Test
    @DisplayName("is case- and whitespace-tolerant, and safe on absence")
    void toleratesFormattingAndAbsence() {
        assertThat(SteadfastDeliveryStatus.toShipmentState("  DELIVERED  "))
                .contains(ShipmentState.DELIVERED);
        assertThat(SteadfastDeliveryStatus.toShipmentState(null)).isEmpty();
        assertThat(SteadfastDeliveryStatus.toShipmentState("")).isEmpty();
        // ⚠ An unpublished value is neither mapped nor given a refusal reason — the caller can
        // tell "the provider changed something" from "we decided not to translate this".
        assertThat(SteadfastDeliveryStatus.isPublishedValue("teleported")).isFalse();
        assertThat(SteadfastDeliveryStatus.refusalReason("teleported")).isEmpty();
    }
}
