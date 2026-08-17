package com.trioloo.erp.system.application;

/**
 * The System-owned {@code PRM-090} capability codes.
 *
 * <p>🔴 TRANSCRIBED, NOT COINED. {@code PRM-090} names them and {@code PRM-089} fixes the
 * {@code <owning-module>.<resource>.<action>} shape. {@code PRM-089.f} — implementation may
 * never invent a permission code.
 *
 * <p>🔴 {@code PRM-090.a} — THE THREE ARE INDEPENDENT, and so is Integration's fourth
 * ({@link com.trioloo.erp.integration.application.IntegrationPermissions#CHANNEL_CONNECTION_AUTHORIZE}).
 * MANAGE NEVER IMPLIES LIFECYCLE, and neither implies AUTHORIZE. Editing a shop's display
 * name and authorising it against a marketplace are different acts, rarely by the same person.
 */
public final class SystemPermissions {

    /** {@code PRM-090} — view Shops & Channels and its non-secret facts. Grants no change. */
    public static final String CHANNEL_INSTANCE_VIEW = "system.channel-instance.view";

    /**
     * {@code PRM-090} — create and update MUTABLE LOCAL Channel Instance metadata.
     *
     * <p>🔴 Confers no lifecycle authority and no authorisation authority. It also confers no
     * authority over remote-derived facts: {@code INV-16.5} makes the bound account and its
     * link unwritable by any operator holding any capability.
     */
    public static final String CHANNEL_INSTANCE_MANAGE = "system.channel-instance.manage";

    /**
     * {@code PRM-090} — configuration lifecycle transitions ({@code SYS-108}).
     *
     * <p>{@code SCS-051} — {@code Activate} is the only transition in this release.
     */
    public static final String CHANNEL_INSTANCE_LIFECYCLE = "system.channel-instance.lifecycle";

    private SystemPermissions() {
    }
}
