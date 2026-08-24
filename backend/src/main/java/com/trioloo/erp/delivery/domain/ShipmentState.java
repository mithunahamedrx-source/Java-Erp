package com.trioloo.erp.delivery.domain;

import java.util.Locale;
import java.util.Set;

/**
 * {@code SM-4} Shipment — the fourteen ratified states.
 *
 * <p>🔴 THE LIST IS {@code DLV-024}'s, VERBATIM, AND NOTHING IS ADDED. {@code SM-4} is owned by
 * {@code STATE_MACHINE_ARCHITECTURE.md}; this enum spells its states so code can name them, and
 * it defines none.
 *
 * <p>🔴 {@code SM-4}'s AUTHORITY IS EXTERNAL ({@code DLV-025}) — the courier is system of record
 * for tracking and outcome. ⚠ Trioloo therefore RECORDS what it has been told and never computes
 * a state it was not told.
 *
 * <p>🔴 {@code LOST} IS ENTERED ONLY ON THE COURIER'S OFFICIAL CONFIRMATION, AND NO ELAPSED-TIME
 * THRESHOLD EXISTS ({@code DLV-027}, {@code DLV-028}). ⚠ A shipment that has stopped moving is
 * DELAYED until the courier completes its own investigation. {@code DLV-029} records the absence
 * of a threshold as a stated business fact rather than a gap — so no timer may invent one.
 */
public enum ShipmentState {

    /** Created in the ERP, not yet handed to the courier. No consignment exists. */
    CREATED,
    /** Accepted by the courier; a consignment id and tracking code exist. */
    BOOKED,
    AWAITING_PICKUP,
    PICKED_UP,
    IN_TRANSIT,
    AT_HUB,
    OUT_FOR_DELIVERY,
    /** ⚠ Recoverable, NOT terminal ({@code DLV-026}). {@code DLV §9} describes what exits it. */
    DELIVERY_ATTEMPTED,
    DELIVERED,
    RETURNING,
    RETURNED_TO_WAREHOUSE,
    LOST,
    DAMAGED,
    CANCELLED;

    /**
     * The states in which a shipment is still live.
     *
     * <p>🔴 THIS IS WHAT MAKES {@code BR-023} SATISFIABLE WITHOUT BREAKING {@code BD-442}.
     * An order has at most one ACTIVE shipment — but successive shipments across fulfilment
     * attempts remain normal, and an RTO'd parcel re-sent IS a second shipment. ⚠ Concurrency is
     * withdrawn; multiplicity is not. A shipment that has left these states frees the order to
     * carry another.
     */
    private static final Set<ShipmentState> SETTLED = Set.of(
            DELIVERED, RETURNED_TO_WAREHOUSE, LOST, DAMAGED, CANCELLED);

    public boolean isActive() {
        return !SETTLED.contains(this);
    }

    /**
     * Resolves a stored name, refusing to guess.
     *
     * <p>🔴 IT DOES NOT TRANSLATE A COURIER'S WORD. {@code STF-011} records that no Steadfast
     * {@code delivery_status} value has ever been observed, so no mapping exists; {@code BR-005}
     * and {@code OM §4.3} put that translation in the adapter once the vocabulary is known, and
     * {@code BR-007} / {@code SYS-034} forbid coercing an unknown value into a canonical state.
     */
    public static ShipmentState resolve(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
