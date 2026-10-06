package com.trioloo.erp.notification.application;

import com.trioloo.erp.order.application.OrderPermissions;

/**
 * The notification types of the first slice, each DECLARING its own category, priority and whether it can be silenced
 * ({@code NOT-014}: the three are independent axes and none is derived from another).
 *
 * <p>The audience is a capability, never a role name ({@code PRM-004}): a type reaches the people who hold the
 * permission to act on its subject, and the Owner holds every authority ({@code AGV-033}).
 *
 * <p>⚠ None is mandatory in this slice: every one here informs rather than guards. The mandatory examples the
 * architecture names (security, marketplace sync failure) arrive as Ongoing Conditions, which are always visible.
 */
public enum NotificationType {

    /** A new marketplace / website order arrived. */
    NEW_ORDER("INFORMATION", "NORMAL", false, OrderPermissions.CHANNEL_ORDER_VIEW),

    /** The courier reports a delivery attempt that did not hand the parcel over. */
    DELIVERY_FAILED("INFORMATION", "HIGH", false, OrderPermissions.CHANNEL_ORDER_VIEW),

    /** A parcel is coming back, or has come back, to the warehouse - someone must receive it. */
    RETURN_ARRIVED("INFORMATION", "HIGH", false, OrderPermissions.CHANNEL_ORDER_VIEW);

    private final String category;
    private final String priority;
    private final boolean mandatory;
    private final String audiencePermission;

    NotificationType(String category, String priority, boolean mandatory, String audiencePermission) {
        this.category = category;
        this.priority = priority;
        this.mandatory = mandatory;
        this.audiencePermission = audiencePermission;
    }

    public String category() { return category; }
    public String priority() { return priority; }
    public boolean mandatory() { return mandatory; }
    public String audiencePermission() { return audiencePermission; }
}
