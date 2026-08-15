package com.trioloo.erp.product.application.channel;

import com.trioloo.erp.product.domain.ListingFieldKey;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Resolves the adapter serving a channel type, {@code PRD-194} / {@code API-062}.
 *
 * <p>Adapters register themselves as Spring beans implementing {@link ChannelAdapterPort}.
 * Marketplace Integration owns those implementations; Product owns only this lookup.
 *
 * <p>⚠ NO ADAPTER SHIPS IN THIS RELEASE. That is a deliberate, honest boundary: the
 * application reports {@code MANUAL_REQUIRED} with a plain explanation rather than
 * simulating remote success. Nothing here pretends a marketplace was contacted.
 */
@Component
public class ChannelAdapterRegistry {

    private final Map<String, ChannelAdapterPort> byChannelType = new HashMap<>();

    public ChannelAdapterRegistry(List<ChannelAdapterPort> adapters) {
        for (ChannelAdapterPort adapter : adapters) {
            byChannelType.put(normalise(adapter.channelType()), adapter);
        }
    }

    /** Empty when Marketplace Integration has not yet supplied an adapter for the type. */
    public Optional<ChannelAdapterPort> forChannelType(String channelType) {
        if (channelType == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(byChannelType.get(normalise(channelType)));
    }

    public boolean hasAdapterFor(String channelType) {
        return forChannelType(channelType).isPresent();
    }

    /**
     * Whether an adapter declares that ANY listing fact can be read for one channel instance,
     * {@code API-063} / {@code PRD-125}.
     *
     * <p>🔴 TWO DIFFERENT UNAVAILABILITIES. "No adapter exists" and "an adapter exists but
     * reports nothing readable" have the same effect and completely different causes: the
     * first is waiting on Marketplace Integration, the second is a DECLARED PROPERTY of that
     * shop's connection. Collapsing them would send the operator to the wrong place.
     *
     * <p>🔴 Declared per INSTANCE, never per channel type ({@code PRD-125}): two shops on one
     * marketplace may differ. ⚠ An ABSENT declaration is NO support, never assumed support
     * ({@code API-063}).
     *
     * <p>⚠ PARTIAL IS ENOUGH. One readable fact makes a read worth performing; the facts the
     * adapter cannot read stay {@code NOT_READABLE} afterwards ({@code API-063.c}) rather than
     * preventing the read from happening at all.
     *
     * <p>🔴 {@code PUBLICATION_INTENT} is deliberately EXCLUDED. It is Trioloo's own fact with
     * no reported counterpart, so a channel declaring it readable would not make any listing
     * fact readable back.
     */
    public boolean declaresReadableListingFacts(String channelType, UUID channelInstanceId) {
        Optional<ChannelAdapterPort> adapter = forChannelType(channelType);
        if (adapter.isEmpty()) {
            return false;
        }
        ChannelCapabilityDeclaration declaration = adapter.get().declareCapability(channelInstanceId);
        if (declaration == null) {
            return false;
        }
        return ListingFieldKey.all().stream()
                .filter(key -> !ListingFieldKey.PUBLICATION_INTENT.equals(key))
                .anyMatch(key -> declaration.forField(key).readable());
    }

    /**
     * The single sentence shown where an adapter exists but can read nothing.
     *
     * <p>🔴 Deliberately DIFFERENT from {@link #noAdapterDetail}: it names the adapter as
     * present, so nobody goes looking for a missing integration that is already there.
     */
    public static String nothingReadableDetail(String channelName) {
        return "The marketplace adapter for " + channelName + " reports no readable Listing "
                + "facts, so there is nothing to read back. This is a declared capability of "
                + "this connection, not a missing adapter.";
    }

    /**
     * The single sentence shown wherever a remote act cannot be attempted.
     *
     * <p>🔴 Deliberately specific rather than "Something went wrong" ({@code PRJ-200}). It
     * names the missing capability and the channel, so the operator knows the request was
     * never sent rather than silently lost.
     */
    public static String noAdapterDetail(String channelType, String channelName) {
        return "No marketplace adapter is configured for " + channelName
                + " (channel type " + channelType + "). The request was not sent. "
                + "Outbound and readback operations become available once Marketplace "
                + "Integration supplies an adapter for this channel.";
    }

    private static String normalise(String channelType) {
        return channelType.trim().toLowerCase();
    }
}
