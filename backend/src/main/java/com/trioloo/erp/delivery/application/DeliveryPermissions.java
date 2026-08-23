package com.trioloo.erp.delivery.application;

/**
 * The ratified courier and shipment capability codes.
 *
 * <p>🔴 NOT INVENTED HERE. {@code PRM-092} names all four and {@code PRM-089} fixes the
 * {@code <owning-module>.<resource>.<action>} shape. Implementation may never coin a permission
 * code ({@code PRM-089.f}), and {@code PRM-003} denies what was never granted.
 *
 * <p>🔴 BOOK, TRACK AND CANCEL ARE A SET, NEVER A LADDER ({@code PRM-092.b}). Booking spends money
 * and dispatches a rider; tracking is a read; cancelling withdraws a commitment already made to a
 * third party. ⚠ Holding one never implies another.
 */
public final class DeliveryPermissions {

    /**
     * {@code PRM-092} — book a consignment with the courier.
     *
     * <p>🔴 It grants no tracking, no cancellation, no Order state change and no payment act.
     */
    public static final String SHIPMENT_BOOK = "delivery.shipment.book";

    /** {@code PRM-092} — read and refresh courier tracking, and record tracking events. */
    public static final String SHIPMENT_TRACK = "delivery.shipment.track";

    /**
     * {@code PRM-092} — cancel a booked consignment.
     *
     * <p>🔴 IT DOES NOT CANCEL THE ORDER ({@code PRM-092.c}). Cancelling a consignment and
     * cancelling an Order are different acts with different consequences and different authority
     * ({@code OM §6.4}, {@code SM-4} versus {@code SM-1}). ⚠ A code that quietly did both would
     * let a courier-desk operator cancel a sale.
     */
    public static final String SHIPMENT_CANCEL = "delivery.shipment.cancel";

    /**
     * {@code PRM-092} — read the courier's remittance feed.
     *
     * <p>🔴 THE MODULE SEGMENT IS {@code payment}, NOT {@code delivery}, AND THAT IS NOT A TYPO.
     * {@code PAY-022} and {@code DLV §23} both place {@code E-042} Remittance Batch with PAYMENT,
     * and {@code PRM-089.a} requires the OWNING module to name the code.
     *
     * <p>🔴 IT IS A READ AND NOTHING MORE ({@code PRM-092.d}). {@code BR-035} — money reported by
     * an intermediary is not money received by Trioloo — and {@code SM-5}'s
     * {@code COLLECTED_BY_INTERMEDIARY → RECEIVED} is MANUAL because a courier statement is not
     * receipt ({@code PAY-070}, {@code PAY-072}, {@code SMA-079}).
     */
    public static final String COURIER_REMITTANCE_VIEW = "payment.courier-remittance.view";

    private DeliveryPermissions() {
    }
}
