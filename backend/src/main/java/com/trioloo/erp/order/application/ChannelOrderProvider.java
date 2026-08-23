package com.trioloo.erp.order.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface ChannelOrderProvider {

    String channelType();

    Page listOrders(UUID channelInstanceId, Instant createdAfter, Instant createdBefore,
                    int offset, int limit);

    record Page(int countTotal, int count, List<ChannelOrderSnapshot> orders) {
        public Page {
            orders = orders == null ? List.of() : List.copyOf(orders);
        }
    }
}
