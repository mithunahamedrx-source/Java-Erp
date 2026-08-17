package com.trioloo.erp.integration.application;

import com.trioloo.erp.integration.domain.ConnectionState;

import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/**
 * The ONE way System reads a connection condition ({@code API-068}, {@code API-069}).
 *
 * <p>🔴 A PORT, NOT A TABLE. The condition is Integration's, and the shop record is System's;
 * this interface is the seam between the two owners. System never queries Integration's
 * persistence and never derives a connection from a shop fact ({@code SCS-040}).
 *
 * <p>🔴 A READ THROUGH THIS PORT MAY FAIL, AND THAT IS A NORMAL OUTCOME. When it does the
 * caller renders the shop in full and states that it does not know the condition
 * ({@code SCS-043.a}, {@code SYS-034}) — it never substitutes a guess, and never blanks out
 * the local record because a remote fact was unreadable ({@code API-069}).
 *
 * <p>🔴 NOTHING SECRET CROSSES THIS BOUNDARY ({@code API-070}, {@code SCS-052}). The
 * projection carries a condition and an observation time; no token, secret, endpoint,
 * provider payload or error code has anywhere to travel.
 */
public interface ChannelConnectionPort {

    /**
     * The condition of one Channel Instance.
     *
     * @throws ConnectionUnavailableException when the condition could not be read
     */
    ConnectionProjection read(UUID channelInstanceId);

    /**
     * The conditions of many, for the workspace.
     *
     * <p>⚠ Every requested id is present in the result: absence of a stored record is itself
     * an answer ({@link ConnectionState#NOT_CONNECTED}), not a missing entry.
     *
     * @throws ConnectionUnavailableException when the conditions could not be read
     */
    Map<UUID, ConnectionProjection> read(Collection<UUID> channelInstanceIds);

    /**
     * One shop's condition, and when it was last ACTUALLY observed.
     *
     * <p>🔴 {@code SCS-042.a} — {@code lastCheckedAt} is null until a genuine observation has
     * happened. It is never the current time, and a page load never populates it.
     */
    record ConnectionProjection(ConnectionState state, Instant lastCheckedAt) {

        public static ConnectionProjection neverAuthorised() {
            return new ConnectionProjection(ConnectionState.NOT_CONNECTED, null);
        }
    }
}
