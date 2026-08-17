package com.trioloo.erp.integration.infrastructure;

import com.trioloo.erp.integration.application.ChannelConnectionPort;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionEntity;
import com.trioloo.erp.integration.infrastructure.persistence.ChannelConnectionRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Reads the connection condition from what authorisation actually recorded.
 *
 * <p>🔴 THE CONDITION IS REPORTED, NEVER COMPUTED. This adapter returns what a real
 * authorisation or a real observation last wrote, and nothing else. It does not contact a
 * marketplace, does not infer a condition from a shop fact, and does not refresh anything
 * because a page was opened ({@code SCS-042.a}).
 *
 * <p>⚠ Once a provider adapter exists it will observe the remote side and write through the
 * same record; this class needs no change for that, and nothing above it does either — which
 * is the whole point of {@link ChannelConnectionPort}.
 */
@Component
public class StoredChannelConnectionAdapter implements ChannelConnectionPort {

    private final ChannelConnectionRepository connections;

    public StoredChannelConnectionAdapter(ChannelConnectionRepository connections) {
        this.connections = connections;
    }

    @Override
    @Transactional(readOnly = true)
    public ConnectionProjection read(UUID channelInstanceId) {
        return connections.findById(channelInstanceId)
                .map(StoredChannelConnectionAdapter::project)
                /*
                  🔴 Never authorised is an ANSWER, not a missing row. SCS-043 defines
                  NOT_CONNECTED as exactly this, so absence needs no stored placeholder.
                */
                .orElseGet(ConnectionProjection::neverAuthorised);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, ConnectionProjection> read(Collection<UUID> channelInstanceIds) {
        Map<UUID, ConnectionProjection> result = new HashMap<>();
        if (channelInstanceIds.isEmpty()) {
            return result;
        }
        List<ChannelConnectionEntity> stored = connections.findByChannelInstanceIdIn(channelInstanceIds);
        for (ChannelConnectionEntity entity : stored) {
            result.put(entity.getChannelInstanceId(), project(entity));
        }
        /* ⚠ Every requested id gets an entry, so no caller has to interpret a gap. */
        for (UUID id : channelInstanceIds) {
            result.putIfAbsent(id, ConnectionProjection.neverAuthorised());
        }
        return result;
    }

    private static ConnectionProjection project(ChannelConnectionEntity entity) {
        return new ConnectionProjection(entity.getState(), entity.getLastCheckedAt());
    }
}
