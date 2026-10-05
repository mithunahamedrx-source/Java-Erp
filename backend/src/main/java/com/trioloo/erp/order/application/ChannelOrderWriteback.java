package com.trioloo.erp.order.application;

import com.trioloo.erp.order.domain.CanonicalOrderStatus;

/**
 * Tells a DIRECT channel that Trioloo changed one of its orders (cancel, reopen, confirm).
 *
 * <p>🔴 A MARKETPLACE IS NEVER WRITTEN TO (BR-172, OSC-036) - there is no implementation for Daraz. This exists for
 * the company's own storefront only, whose admin panel must follow the ERP. Each implementation translates the
 * canonical state into that channel's own word (BR-005); the Order module never learns the vocabulary.
 */
public interface ChannelOrderWriteback {

    String channelType();

    /**
     * @throws RuntimeException with an operator-readable message when the channel could not be updated; the caller
     *         reports it and never lets it undo the ERP's own action.
     */
    void publish(String externalOrderId, CanonicalOrderStatus status);
}
