package com.trioloo.erp.integration.application;

/**
 * The Integration-owned {@code PRM-090} capability code.
 *
 * <p>⚠ {@code PRM-090.b} — the owning module differs from the other three DELIBERATELY: the
 * shop record is System's ({@code DM-084.b}) and the authorisation is Integration's
 * ({@code API-069}). {@code PRM-089.a} makes that visible in the code itself.
 */
public final class IntegrationPermissions {

    /**
     * {@code PRM-090} — initiate and re-initiate external authorisation for a Channel
     * Instance ({@code API-069.a}).
     *
     * <p>🔴 Grants no ordinary shop metadata management, and is never implied by it.
     */
    public static final String CHANNEL_CONNECTION_AUTHORIZE = "integration.channel-connection.authorize";

    private IntegrationPermissions() {
    }
}
