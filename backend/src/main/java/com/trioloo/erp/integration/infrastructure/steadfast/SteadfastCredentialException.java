package com.trioloo.erp.integration.infrastructure.steadfast;

/**
 * The Steadfast merchant credential itself was refused.
 *
 * <p>🔴 THIS IS RAISED FROM {@code /get_balance} AND FROM NOWHERE ELSE ({@code STF-007.e}). Every
 * other endpoint answers {@code 401} for reasons that have nothing to do with the credential — a
 * consignment belonging to another merchant, an invoice that exists nowhere — so raising this from
 * a status read would report a healthy integration as broken, or drive a credential rotation
 * because one parcel could not be found.
 *
 * <p>⚠ The key does not expire ({@code STF-003.a}), so this means it is WRONG or has been ROTATED
 * in the provider's panel. It never means "expired, retry after refresh": there is no refresh.
 */
public class SteadfastCredentialException extends RuntimeException {
    public SteadfastCredentialException(String message) {
        super(message);
    }
}
