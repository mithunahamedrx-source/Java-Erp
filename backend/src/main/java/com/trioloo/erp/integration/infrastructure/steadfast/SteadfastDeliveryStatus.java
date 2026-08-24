package com.trioloo.erp.integration.infrastructure.steadfast;

import com.trioloo.erp.delivery.domain.ShipmentState;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Translates Steadfast's {@code delivery_status} into {@code SM-4} — {@code BR-005}, {@code OM §4.3}.
 *
 * <p>🔴 THE TRANSLATION LIVES IN THE ADAPTER AND NOWHERE ELSE. {@code BR-005} — channel-specific
 * logic exists only in adapters, and no downstream stage may contain channel-conditional behaviour.
 * This is the courier's counterpart to {@code DarazChannelOrderProvider}'s {@code SM-1} mapping.
 *
 * <p>🔴 ELEVEN PROVIDER VALUES EXIST AND ONLY FOUR ARE MAPPED. The other seven are REFUSED, each
 * for a stated reason. ⚠ That is not caution for its own sake: {@code DLV-025} makes the courier
 * system of record for outcome, so a wrong translation writes a false outcome into the ERP and
 * {@code SYS-034} forbids treating an unknown as a value.
 *
 * <p>✅ NOTHING IS LOST BY REFUSING. The raw provider word is retained as received
 * ({@code DLV-037}, {@code AUD-009}, {@code SYS-046}) and remains visible, so an unmapped status
 * shows the operator exactly what the courier said rather than a state Trioloo invented.
 */
public final class SteadfastDeliveryStatus {

    /**
     * The four translations that are unambiguous.
     *
     * <p>⚠ {@code in_review} → {@code BOOKED}, not {@code AWAITING_PICKUP}. The provider defines it
     * as <em>"order placed, under review"</em>, which says the consignment exists with the courier
     * and says nothing about a pickup being scheduled. Claiming {@code AWAITING_PICKUP} would
     * assert a fact the provider did not report.
     *
     * <p>⚠ THE {@code _approval_pending} VARIANTS MAP TO THE SAME STATE AS THEIR SETTLED FORMS, AND
     * THAT IS DELIBERATE. The provider's own definitions differ only in whether its BALANCE has
     * been updated — <em>"delivered, awaiting admin approval"</em> versus <em>"delivered and
     * balance updated"</em>. 🔴 That distinction is the courier's ACCOUNTING, not the parcel's
     * physical movement, and {@code SM-4}'s subject is the movement ({@code E-037}). ✅ The money
     * side is {@code SM-5}'s, where {@code BR-035} already keeps collection and receipt apart.
     */
    private static final Map<String, ShipmentState> MAPPED = Map.of(
            "in_review", ShipmentState.BOOKED,
            "delivered", ShipmentState.DELIVERED,
            "delivered_approval_pending", ShipmentState.DELIVERED,
            "cancelled", ShipmentState.CANCELLED,
            "cancelled_approval_pending", ShipmentState.CANCELLED);

    /**
     * Why each unmapped value is unmapped. Keyed by the provider's word.
     *
     * <p>🔴 A REFUSAL WITH A REASON IS EVIDENCE; A SILENT GAP IS A BUG WAITING TO BE "FIXED" BY
     * SOMEBODY GUESSING. Anyone tempted to add one of these has to read the reason first.
     */
    private static final Map<String, String> REFUSED = Map.of(
            "pending",
            "The provider defines it as 'not yet delivered or cancelled', which spans IN_TRANSIT, "
                    + "AT_HUB and OUT_FOR_DELIVERY at once. SM-4 is finer than the provider "
                    + "reports, and picking one would assert a position the courier did not give "
                    + "(SYS-034).",

            "hold",
            "SM-4 has no hold state. ON_HOLD belongs to SM-1 and is an ORDER-level act by whoever "
                    + "placed it (BR-151) - not a courier report about a parcel. Mapping a courier "
                    + "hold onto the Order machine would let a third party move Trioloo's own "
                    + "lifecycle.",

            "unknown",
            "The provider itself says unknown and directs the merchant to contact support. "
                    + "SYS-034 - unknown is not a value, and it is certainly not LOST: DLV-027 "
                    + "admits LOST only on the courier's OFFICIAL confirmation that a parcel "
                    + "cannot be delivered or recovered, and DLV-028 forbids an elapsed-time "
                    + "threshold standing in for one.",

            "unknown_approval_pending",
            "As 'unknown', and awaiting the provider's own support intervention.",

            "partial_delivered",
            "PARTIAL DELIVERY DOES NOT EXIST IN THIS ARCHITECTURE. BD-442 removed "
                    + "PARTIALLY_DELIVERED from SM-1, withdrew BR-025, and BR-158/BR-159 fix one "
                    + "order as one parcel per attempt. The courier can report something the "
                    + "business has decided cannot happen - see GAP-140.",

            "partial_delivered_approval_pending",
            "As 'partial_delivered' - see GAP-140.");

    private SteadfastDeliveryStatus() {
    }

    /**
     * @return the {@code SM-4} state, or empty where no honest translation exists.
     */
    public static Optional<ShipmentState> toShipmentState(String providerStatus) {
        if (providerStatus == null || providerStatus.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(MAPPED.get(normalise(providerStatus)));
    }

    /**
     * The recorded reason a known provider value is not translated, where one exists.
     *
     * <p>⚠ An empty result for a value that is also unmapped means the provider has sent something
     * outside its own published vocabulary — which is a different and more interesting fact than a
     * deliberate refusal, and the caller should log it as such.
     */
    public static Optional<String> refusalReason(String providerStatus) {
        if (providerStatus == null || providerStatus.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(REFUSED.get(normalise(providerStatus)));
    }

    /** ✅ Every value the provider publishes, mapped or refused. */
    public static boolean isPublishedValue(String providerStatus) {
        String key = normalise(providerStatus);
        return MAPPED.containsKey(key) || REFUSED.containsKey(key);
    }

    private static String normalise(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }
}
