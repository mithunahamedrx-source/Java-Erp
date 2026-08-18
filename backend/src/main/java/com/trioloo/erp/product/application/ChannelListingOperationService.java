package com.trioloo.erp.product.application;

import com.trioloo.erp.access.application.ActorDirectory;
import com.trioloo.erp.access.application.CurrentActor;
import com.trioloo.erp.access.domain.Actor;
import com.trioloo.erp.product.application.channel.ChannelAdapterPort;
import com.trioloo.erp.product.application.channel.ChannelAdapterRegistry;
import com.trioloo.erp.product.application.channel.DiscoveryPage;
import com.trioloo.erp.product.application.channel.OutboundListingPayload;
import com.trioloo.erp.product.application.channel.OutboundResult;
import com.trioloo.erp.product.application.channel.ReportedListingSnapshot;
import com.trioloo.erp.product.application.channel.ReportedSkuSnapshot;
import com.trioloo.erp.product.domain.ActivityKind;
import com.trioloo.erp.product.domain.ListingFieldKey;
import com.trioloo.erp.product.domain.LocalLifecycle;
import com.trioloo.erp.product.domain.OperationDirection;
import com.trioloo.erp.product.domain.OperationKind;
import com.trioloo.erp.product.domain.OperationOutcome;
import com.trioloo.erp.product.domain.SyncState;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelInstanceRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingActivityEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingActivityRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingAttributeEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingAttributeRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingOperationBatchEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingOperationBatchRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingOperationEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingOperationRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingReportedMediaEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingReportedMediaRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingRepository;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingSkuEntity;
import com.trioloo.erp.product.infrastructure.persistence.ChannelListingSkuRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Every act that CONTACTS a channel, {@code PRD-186}.
 *
 * <p>🔴 The push/save boundary lives here. {@link ChannelListingCommandService} records
 * intent and has no adapter dependency at all; this service is the only place an outbound
 * attempt is made ({@code PRD-185}, {@code API-064.a}).
 *
 * <p>🔴 {@code PRD-196.a} — outbound acts require {@code product.channel-listing.publish} and
 * inbound acts require {@code product.channel-listing.sync}. MANAGE NEVER IMPLIES PUBLISH: an
 * operator who may edit intent is not thereby authorised to change what customers see.
 *
 * <p>🔴 {@code INV-108.1} — a batch is NOT atomic across an external party. Partial success is
 * the NORMAL outcome, and each member's result is settled and retained independently
 * ({@code INV-107.1}, {@code INV-107.2}).
 *
 * <p>⚠ NO ADAPTER SHIPS IN THIS RELEASE. Where none is registered the operation settles as
 * {@code MANUAL_REQUIRED} with a truthful reason ({@code SYS-025}). Nothing here ever
 * simulates remote success.
 */
@Service
public class ChannelListingOperationService {

    /**
     * ⚠ {@code PRJ-210} — an OPERATIONAL log, never an audit or business record. The business
     * facts a discovery run produces are the batch, the per-listing operations and the activity
     * entries; this only makes a completed run visible to whoever is watching the service.
     *
     * <p>🔴 NOTHING THE PROVIDER SAID IS EVER LOGGED — no title, price, stock figure, item id,
     * seller SKU, image reference, token or signed URI. Counts and Trioloo's own identifiers only.
     */
    private static final Logger log = LoggerFactory.getLogger(ChannelListingOperationService.class);

    private static final String SOURCE_CHANNEL = "CHANNEL";

    private final ChannelListingRepository listings;
    private final ChannelListingSkuRepository skus;
    private final ChannelListingAttributeRepository attributes;
    private final ChannelListingReportedMediaRepository reportedMedia;
    private final ChannelListingOperationRepository operations;
    private final ChannelListingOperationBatchRepository batches;
    private final ChannelListingActivityRepository activities;
    private final ChannelInstanceRepository channels;
    private final ChannelListingMediaService media;
    private final ChannelListingQueryService queries;
    private final ChannelAdapterRegistry adapters;
    private final ActorDirectory directory;
    private final CurrentActor currentActor;
    private final Clock clock;

    public ChannelListingOperationService(ChannelListingRepository listings,
                                          ChannelListingSkuRepository skus,
                                          ChannelListingAttributeRepository attributes,
                                          ChannelListingReportedMediaRepository reportedMedia,
                                          ChannelListingOperationRepository operations,
                                          ChannelListingOperationBatchRepository batches,
                                          ChannelListingActivityRepository activities,
                                          ChannelInstanceRepository channels,
                                          ChannelListingMediaService media,
                                          ChannelListingQueryService queries,
                                          ChannelAdapterRegistry adapters,
                                          ActorDirectory directory,
                                          CurrentActor currentActor,
                                          Clock clock) {
        this.listings = listings;
        this.skus = skus;
        this.attributes = attributes;
        this.reportedMedia = reportedMedia;
        this.operations = operations;
        this.batches = batches;
        this.activities = activities;
        this.channels = channels;
        this.media = media;
        this.queries = queries;
        this.adapters = adapters;
        this.directory = directory;
        this.currentActor = currentActor;
        this.clock = clock;
    }

    // =================================================================================
    // Requesting an operation
    // =================================================================================

    /**
     * Requests one remote act against an EXPLICIT selection, {@code PRD-186}.
     *
     * <p>🔴 {@code INV-108.4} — the scope is exactly what was selected. A batch NEVER expands
     * itself to sibling listings that happen to share a Sellable Product ({@code PRD-187.b}).
     */
    @Transactional
    public UUID request(OperationKind kind, List<UUID> listingIds, String scopeDescription) {
        Actor actor = kind.isOutbound()
                ? requirePermission(ProductPermissions.CHANNEL_LISTING_PUBLISH)
                : requirePermission(ProductPermissions.CHANNEL_LISTING_SYNC);
        if (listingIds == null || listingIds.isEmpty()) {
            throw new ChannelListingValidationException("listingIds",
                    "Select at least one Listing.");
        }
        Instant now = Instant.now(clock);
        ChannelListingOperationBatchEntity batch = batches.save(
                new ChannelListingOperationBatchEntity(UUID.randomUUID(), kind,
                        scopeDescription, actor.id(), now));

        for (UUID listingId : listingIds) {
            runOne(kind, listingId, batch.getId(), actor.id(), now);
        }
        batch.complete(Instant.now(clock));
        batches.save(batch);
        return batch.getId();
    }

    /**
     * Re-requests only the members a retry may legitimately target, {@code PRD-186.d}.
     *
     * <p>🔴 {@code MANUAL_REQUIRED} and {@code DIVERGED} members are deliberately EXCLUDED —
     * a person must decide those outcomes before anything is sent again. Retrying them would
     * silently overwrite a decision nobody made.
     */
    @Transactional
    public UUID retryFailed(UUID batchId) {
        ChannelListingOperationBatchEntity source = batches.findById(batchId)
                .orElseThrow(() -> new ChannelListingValidationException("batchId",
                        "No operation batch with id " + batchId + "."));
        List<UUID> retryable = operations
                .findByBatchIdAndOutcome(batchId, OperationOutcome.FAILED).stream()
                .map(ChannelListingOperationEntity::getChannelListingId)
                .distinct()
                .toList();
        if (retryable.isEmpty()) {
            throw new ChannelListingValidationException(
                    "Nothing in this batch can be retried. Only failed operations may be "
                            + "retried; items needing manual attention must be resolved first.");
        }
        return request(source.getOperationKind(), retryable,
                "Retry of failed members of batch " + batchId);
    }

    /**
     * Enumerates a channel's ACTIVE listings, {@code PRD-175}.
     *
     * <p>🔴 {@code PRD-177} — a listing that a run did NOT return is left exactly as it was.
     * Absence is never, by itself, a deletion, a withdrawal or a status change. When the
     * adapter reports the run INCOMPLETE that guarantee matters most ({@code API-066.b}).
     */
    @Transactional
    public DiscoveryOutcome discover(UUID channelInstanceId) {
        Actor actor = requirePermission(ProductPermissions.CHANNEL_LISTING_SYNC);
        Instant now = Instant.now(clock);
        ChannelInstanceEntity channel = channels.findById(channelInstanceId)
                .orElseThrow(() -> new ChannelListingValidationException("channelInstanceId",
                        "No registered Channel Instance " + channelInstanceId + "."));
        ChannelListingOperationBatchEntity batch = batches.save(
                new ChannelListingOperationBatchEntity(UUID.randomUUID(), OperationKind.DISCOVER,
                        "Discovery on " + channel.getName(), actor.id(), now));

        Optional<ChannelAdapterPort> adapter = adapters.forChannelType(channel.getChannelType());
        if (adapter.isEmpty()) {
            return new DiscoveryOutcome(batch.getId(), 0, 0, false,
                    ChannelAdapterRegistry.noAdapterDetail(channel.getChannelType(),
                            channel.getName()));
        }

        int seen = 0;
        int created = 0;
        boolean complete = true;
        String incompleteReason = null;
        String cursor = null;
        do {
            DiscoveryPage page = adapter.get().discoverActive(channelInstanceId, cursor);
            for (ReportedListingSnapshot snapshot : page.listings()) {
                seen++;
                ChannelListingEntity known = listings
                        .findByChannelInstanceIdAndExternalListingIdIgnoreCase(
                                channelInstanceId, snapshot.externalListingId())
                        .orElse(null);
                boolean newlyRecorded = known == null;
                ChannelListingEntity listing;
                if (newlyRecorded) {
                    // PRD-178 — a newly discovered listing is UNMAPPED, which is a first-class
                    // state. It is never auto-mapped and never creates a Sellable Product.
                    listing = new ChannelListingEntity(UUID.randomUUID(), channelInstanceId,
                            snapshot.externalListingId(), LocalLifecycle.PUBLISHED,
                            actor.id(), now);
                    listings.save(listing);
                    created++;
                } else {
                    listing = known;
                }
                /*
                  🔴 PRD-186.a — ONE OPERATION RECORD PER LISTING PER REQUESTED REMOTE ACT, and
                  `discover` is one of the five kinds the rule names explicitly. Without this the
                  run's only trace is an aggregate, which is exactly what PRD-186.b forbids:
                  per-listing results are retained individually and never collapsed.

                  ⚠ The record is opened BEFORE the snapshot is applied so the activity that
                  application produces can name the operation that caused it.
                */
                ChannelListingOperationEntity operation = operations.save(
                        new ChannelListingOperationEntity(UUID.randomUUID(), listing.getId(),
                                batch.getId(), OperationKind.DISCOVER,
                                OperationDirection.INBOUND, actor.id(), now));

                applySnapshot(listing, snapshot, actor.id(), now, operation.getId(), batch.getId());
                listing.recordSeenInDiscovery(now);
                listings.save(listing);

                /*
                  🔴 THE ENTITY'S OWN settle, DELIBERATELY NOT THIS CLASS'S. The private
                  settle(…) below also writes the listing's sync state and last-sync time, and
                  INV-107.4 keeps those a DIFFERENT fact from an operation's outcome. What sync
                  state a successfully read, still-UNMAPPED listing carries is not ratified, so
                  recording the attempt must not silently decide it.

                  ⚠ Counts only. The detail is operator-facing text and never carries a title,
                  price, stock figure, item id or seller SKU.
                */
                String detail = (newlyRecorded
                        ? "Discovered and newly recorded as UNMAPPED. "
                        : "Reported values re-read on a Listing already known. ")
                        + reportedShape(snapshot);
                operation.settle(OperationOutcome.SUCCEEDED, detail,
                        channel.getChannelType(), Instant.now(clock));
                operations.save(operation);

                /*
                  ✅ PRD-186.f — DISCOVERY IS ONE OF THE EVENTS THE HISTORY MUST BE ABLE TO
                  CARRY. Without this entry FRAME 21 shows a Listing that simply appeared, with
                  no record of the run that found it.

                  ⚠ It does NOT replace the CHANNEL_EVENT beside it. That entry says what the
                  MARKETPLACE reported; this one says what TRIOLOO asked for and what came of it
                  (PRD-186.e). Both are kept.
                */
                recordOperationActivity(operation, OperationOutcome.SUCCEEDED, detail,
                        actor.id(), batch.getId(), now);
            }
            if (!page.complete()) {
                complete = false;
                incompleteReason = page.incompleteReason();
                break;
            }
            cursor = page.hasMore() ? page.nextCursor() : null;
        } while (cursor != null);

        batch.complete(Instant.now(clock));
        batches.save(batch);
        /*
          ⚠ PRJ-210's "useful operation context". The first live pull produced NO application log
          line at all, so a run that touched a real marketplace left nothing an operator could
          read. Identifiers and counts only — see the field's note.
        */
        log.info("Discovery batch {} on channel instance {}: {} listing(s) returned, {} newly "
                        + "recorded, complete={}{}",
                batch.getId(), channelInstanceId, seen, created, complete,
                incompleteReason == null ? "" : ", incomplete because: " + incompleteReason);
        return new DiscoveryOutcome(batch.getId(), seen, created, complete, incompleteReason);
    }

    /**
     * A COUNT-ONLY description of what the channel returned for one listing.
     *
     * <p>🔴 It exists to keep provider values out of {@code detail}. An operation's detail is
     * read by operators and exported; a title or a price belongs on the listing's reported side,
     * not duplicated into an operation record.
     */
    private static String reportedShape(ReportedListingSnapshot snapshot) {
        int skuCount = snapshot.skus() == null ? 0 : snapshot.skus().size();
        int attributeCount = snapshot.attributes() == null ? 0 : snapshot.attributes().size();
        return skuCount + (skuCount == 1 ? " orderable SKU and " : " orderable SKUs and ")
                + attributeCount + (attributeCount == 1 ? " attribute" : " attributes")
                + " reported.";
    }

    // =================================================================================
    // Running one member
    // =================================================================================

    private void runOne(OperationKind kind, UUID listingId, UUID batchId, UUID actorId,
                        Instant now) {
        ChannelListingEntity listing = listings.findById(listingId)
                .orElseThrow(() -> new ChannelListingNotFoundException(listingId));
        ChannelListingOperationEntity operation = operations.save(
                new ChannelListingOperationEntity(UUID.randomUUID(), listingId, batchId, kind,
                        kind.isOutbound() ? OperationDirection.OUTBOUND : OperationDirection.INBOUND,
                        actorId, now));

        ChannelInstanceEntity channel = channels.findById(listing.getChannelInstanceId())
                .orElseThrow(() -> new ChannelListingValidationException("channel_instance",
                        "The Channel Instance for this Listing is missing."));
        Optional<ChannelAdapterPort> adapter = adapters.forChannelType(channel.getChannelType());

        if (adapter.isEmpty()) {
            // 🔴 The honest boundary. There is no adapter, so nothing was sent and nothing was
            // read. Reporting SUCCEEDED here would be a lie the operator could not detect.
            settle(operation, listing, OperationOutcome.MANUAL_REQUIRED,
                    ChannelAdapterRegistry.noAdapterDetail(channel.getChannelType(),
                            channel.getName()),
                    null, SyncState.MANUAL_REQUIRED, actorId, batchId);
            return;
        }

        try {
            switch (kind) {
                case REFRESH -> runRefresh(operation, listing, channel, adapter.get(), actorId,
                        batchId, now);
                case PUSH_UPDATE -> runOutbound(operation, listing, adapter.get()
                        .pushUpdate(channel.getId(), payloadFor(listing)), actorId, batchId, now);
                case PUBLISH_CREATE -> runOutbound(operation, listing, adapter.get()
                        .publishCreate(channel.getId(), payloadFor(listing)), actorId, batchId, now);
                case WITHDRAW -> runOutbound(operation, listing, adapter.get()
                        .withdraw(channel.getId(), listing.getExternalListingId()), actorId,
                        batchId, now);
                case DISCOVER -> throw new ChannelListingValidationException(
                        "Discovery targets a channel, not a Listing selection.");
            }
        } catch (ChannelListingValidationException e) {
            throw e;
        } catch (RuntimeException e) {
            // PRJ-200 / SYS-032 — the operator is told what actually went wrong. The
            // exception is settled onto THIS member only; siblings are unaffected
            // (INV-107.2).
            settle(operation, listing, OperationOutcome.FAILED,
                    e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage(),
                    null, SyncState.FAILED, actorId, batchId);
        }
    }

    private void runRefresh(ChannelListingOperationEntity operation, ChannelListingEntity listing,
                            ChannelInstanceEntity channel, ChannelAdapterPort adapter,
                            UUID actorId, UUID batchId, Instant now) {
        if (listing.getExternalListingId() == null) {
            settle(operation, listing, OperationOutcome.MANUAL_REQUIRED,
                    "This Listing has not been published yet, so the channel has nothing to "
                            + "read back.", null, SyncState.MANUAL_REQUIRED, actorId, batchId);
            return;
        }
        Optional<ReportedListingSnapshot> snapshot =
                adapter.readListing(channel.getId(), listing.getExternalListingId());
        if (snapshot.isEmpty()) {
            // 🔴 PRD-177 — the channel did not return it. That is NOT a deletion and NOT a
            // withdrawal. Nothing about the listing is changed; a person is asked to look.
            settle(operation, listing, OperationOutcome.MANUAL_REQUIRED,
                    "The channel did not return this Listing. Nothing has been changed — "
                            + "absence is not a deletion.", null, SyncState.MANUAL_REQUIRED,
                    actorId, batchId);
            return;
        }
        applySnapshot(listing, snapshot.get(), actorId, now, operation.getId(), batchId);
        listings.save(listing);
        /*
          🔴 A SUCCESSFUL READ IS NOT AGREEMENT. Settling every successful refresh as
          {@code SYNCED} would announce that Trioloo and the marketplace agree, when what
          actually happened is that the marketplace was reachable. A read may discover that
          the channel now reports a price the ERP never intended.

          🔴 The standing position is therefore DERIVED from the comparison the read produced
          ({@code INV-107.4} — the operation outcome and the sync state are different facts).
          ⚠ Divergence is judged on READABLE facts only: a value the channel did not return
          proves nothing about whether it matches ({@code API-063.c}).
        */
        boolean diverged = queries.comparisonRows(listing,
                        attributes.findByChannelListingIdOrderByPositionAsc(listing.getId()))
                .stream()
                .anyMatch(r -> ListingViews.ComparisonRow.DIVERGED.equals(r.state()));
        settle(operation, listing, OperationOutcome.SUCCEEDED,
                diverged
                        ? "Channel values re-read. The channel reports values that differ from "
                                + "ERP intent."
                        : "Channel values re-read.",
                null, diverged ? SyncState.DIVERGED : SyncState.SYNCED, actorId, batchId);
    }

    // =================================================================================
    // One listing, refreshed on its own — FRAME 16
    // =================================================================================

    /**
     * Re-reads ONE listing and reports what that achieved, {@code PRD-189.c}.
     *
     * <p>🔴 REFRESH READS THE MARKETPLACE AND NEVER WRITES TO IT. It updates the REPORTED side
     * and nothing else: no intended value, no mapping, no publication intent and no unsent
     * condition is touched ({@code PRD-181.a}, {@code PRD-185.c}).
     *
     * <p>🔴 THE PRECONDITIONS REFUSE BEFORE ANYTHING IS RECORDED. A listing with no remote
     * identity and a channel with no adapter are both reasons the act CANNOT BE ATTEMPTED, and
     * an operation row for an attempt that never happened would be a lie the operator could
     * not detect. Contrast the batch path, where a selected member settles
     * {@code MANUAL_REQUIRED} because the member WAS part of a requested run.
     *
     * <p>⚠ {@code INV-108.4} — exactly this listing, on exactly its own channel and shop. No
     * sibling listing, no sibling shop, no channel-wide pull.
     */
    @Transactional
    public RefreshResultView refreshOne(UUID listingId) {
        Actor actor = requirePermission(ProductPermissions.CHANNEL_LISTING_SYNC);
        ChannelListingEntity listing = listings.findById(listingId)
                .orElseThrow(() -> new ChannelListingNotFoundException(listingId));
        ChannelInstanceEntity channel = channels.findById(listing.getChannelInstanceId())
                .orElseThrow(() -> new ChannelListingValidationException("channel_instance",
                        "The Channel Instance for this Listing is missing."));

        // 🔴 PRD-188.b — nothing was ever published, so the channel has nothing to read back.
        //    No identifier is invented to make the request possible.
        if (listing.getExternalListingId() == null) {
            throw new ChannelListingValidationException("external_listing_id",
                    "This Listing has not been published yet, so the channel has nothing to "
                            + "read back.");
        }
        if (adapters.forChannelType(channel.getChannelType()).isEmpty()) {
            throw new ChannelListingValidationException("adapter",
                    ChannelAdapterRegistry.noAdapterDetail(channel.getChannelType(),
                            channel.getName()));
        }
        /*
          🔴 A DIFFERENT UNAVAILABILITY, AND IT IS NAMED SEPARATELY. An adapter that exists but
          declares no readable listing fact has nothing to read back, and calling that "no
          adapter configured" would send the operator to look for an integration that is
          already there.

          ⚠ PARTIAL CAPABILITY DOES NOT BLOCK. One readable fact makes the read worth doing;
          the rest stay NOT_READABLE afterwards ({@code API-063.c}) rather than preventing the
          read from happening at all.

          🔴 It is checked BEFORE anything is recorded and the adapter is never called, so no
          operation describes a request that was never made.
        */
        if (!adapters.declaresReadableListingFacts(channel.getChannelType(), channel.getId())) {
            throw new ChannelListingValidationException("adapter_capability",
                    ChannelAdapterRegistry.nothingReadableDetail(channel.getName()));
        }
        /*
          🔴 ONE AT A TIME, PER LISTING. Repeated clicks must not become two concurrent reads
          of the same listing, whose results would land in an order nobody chose. ⚠ It is
          scoped to THIS listing: refreshing a different one is unaffected.
        */
        if (!operations.findByChannelListingIdAndOperationKindAndOutcomeIn(listingId,
                OperationKind.REFRESH,
                List.of(OperationOutcome.REQUESTED, OperationOutcome.IN_PROGRESS)).isEmpty()) {
            throw new ChannelListingValidationException("refresh",
                    "A refresh of this Listing is already running. Wait for it to finish.");
        }

        Instant startedAt = Instant.now(clock);
        // 🔴 Captured BEFORE the read, so "changed" is measured against what we actually held
        //    rather than assumed from the adapter having returned something.
        Map<String, String> before = readableReported(listing);

        ChannelListingOperationBatchEntity batch = batches.save(
                new ChannelListingOperationBatchEntity(UUID.randomUUID(), OperationKind.REFRESH,
                        "Refresh of " + listing.getIntendedTitle(), actor.id(), startedAt));
        runOne(OperationKind.REFRESH, listingId, batch.getId(), actor.id(), startedAt);
        batch.complete(Instant.now(clock));
        batches.save(batch);

        ChannelListingOperationEntity operation = operations
                .findTop50ByChannelListingIdOrderByRequestedAtDesc(listingId).getFirst();
        return result(listing, channel, operation, before, startedAt);
    }

    /**
     * Composes the provider-neutral result, {@code API-062.d}.
     *
     * <p>🔴 The comparison is recomputed from the listing's CURRENT state, so what the surface
     * shows after a refresh and what the comparison surface shows are the same derivation.
     */
    private RefreshResultView result(ChannelListingEntity listing, ChannelInstanceEntity channel,
                                     ChannelListingOperationEntity operation,
                                     Map<String, String> before, Instant startedAt) {
        List<ListingViews.ComparisonRow> rows = queries.comparisonRows(listing,
                attributes.findByChannelListingIdOrderByPositionAsc(listing.getId()));
        Map<String, String> after = readableReported(listing);

        /*
          🔴 CHANGED means a READABLE reported value MOVED. A fact that became unreadable, or
          was unreadable throughout, is not a change in what the channel says — it is the
          absence of an answer, and {@code API-063.c} keeps those apart.
        */
        List<String> changed = rows.stream()
                .filter(r -> !java.util.Objects.equals(before.get(r.fieldKey()),
                        after.get(r.fieldKey())))
                .filter(r -> after.get(r.fieldKey()) != null)
                .map(ListingViews.ComparisonRow::label)
                .toList();
        List<String> manual = rows.stream()
                .filter(r -> ListingViews.ComparisonRow.MANUAL_REQUIRED.equals(r.state()))
                .map(ListingViews.ComparisonRow::label)
                .toList();

        String state = switch (operation.getOutcome()) {
            case SUCCEEDED -> changed.isEmpty()
                    ? RefreshResultView.STATE_COMPLETED_NO_CHANGE
                    : RefreshResultView.STATE_COMPLETED_CHANGED;
            case FAILED -> RefreshResultView.STATE_FAILED;
            default -> RefreshResultView.STATE_MANUAL_REQUIRED;
        };
        return new RefreshResultView(listing.getId(), operation.getId(),
                listing.getIntendedTitle(), channel.getName(),
                operation.getOutcome().name(), state, operation.getDetail(),
                startedAt, operation.getCompletedAt(), changed, manual,
                (int) rows.stream().filter(r -> !r.reportedReadable()).count(),
                (int) rows.stream()
                        .filter(r -> ListingViews.ComparisonRow.DIVERGED.equals(r.state())).count(),
                // 🔴 PRD-185.c — carried out so the surface can show that refreshing did NOT
                //    clear it. An inbound read never satisfies an outbound obligation.
                listing.hasUnsentLocalChanges(),
                listing.getSyncState() == null ? null : listing.getSyncState().name());
    }

    /**
     * The READABLE reported value of every comparable fact, keyed by field.
     *
     * <p>🔴 An unreadable fact maps to {@code null} deliberately: it is ABSENT, and comparing
     * absence to absence must not read as "unchanged data" nor absence to a value as a change
     * in what the channel reports.
     */
    private Map<String, String> readableReported(ChannelListingEntity listing) {
        Map<String, String> values = new LinkedHashMap<>();
        for (ListingViews.ComparisonRow row : queries.comparisonRows(listing,
                attributes.findByChannelListingIdOrderByPositionAsc(listing.getId()))) {
            values.put(row.fieldKey(), row.reportedReadable() ? row.reportedValue() : null);
        }
        return values;
    }

    private void runOutbound(ChannelListingOperationEntity operation, ChannelListingEntity listing,
                             OutboundResult result, UUID actorId, UUID batchId, Instant now) {
        if (result.outcome() == OperationOutcome.SUCCEEDED) {
            if (result.assignedExternalListingId() != null) {
                // PRD-188.c / DB-046 — mirrored exactly as the channel issued it.
                listing.assignExternalListingId(result.assignedExternalListingId(), now);
            }
            listing.recordSuccessfulPush(now);
        }
        listings.save(listing);
        settle(operation, listing, result.outcome(), result.detail(), result.provenance(),
                syncStateFor(result.outcome()), actorId, batchId);
    }

    /**
     * Settles ONE member and its listing's standing position.
     *
     * <p>🔴 {@code INV-107.4} — the operation outcome and the listing sync state are DIFFERENT
     * facts and are written separately. The operation is an attempt with a result; the sync
     * state is where the listing now stands relative to the channel.
     */
    private void settle(ChannelListingOperationEntity operation, ChannelListingEntity listing,
                        OperationOutcome outcome, String detail, String provenance,
                        SyncState syncState, UUID actorId, UUID batchId) {
        Instant now = Instant.now(clock);
        operation.settle(outcome, detail, provenance, now);
        operations.save(operation);
        listing.applySyncState(syncState, now);
        listings.save(listing);
        recordOperationActivity(operation, outcome, detail, actorId, batchId, now);
    }

    /**
     * The {@code OPERATION} entry for one settled act, {@code PRD-186.e} / {@code PRD-186.f}.
     *
     * <p>✅ THE THIRD KIND OF RECORD — a REQUESTED ACT WITH AN OUTCOME, which is neither a
     * before/after field change nor an unsolicited channel event. {@code PRD-186.f} lists
     * DISCOVERY among the events the history must be able to carry.
     *
     * <p>🔴 THE ACTOR IS THE REQUESTING OPERATOR, and that is the established semantic here, not
     * a new one: a person asked for this act. ⚠ It is the exact opposite of a
     * {@code CHANNEL_EVENT}, where the marketplace acted and the actor is NULL — the two kinds
     * answer different questions and are never merged.
     *
     * <p>🔴 THE SUMMARY CARRIES NO PROVIDER VALUE. It is built from the operation's own kind and
     * outcome plus the operator-facing detail, which callers keep free of titles, identifiers,
     * SKUs, prices and stock figures.
     */
    private void recordOperationActivity(ChannelListingOperationEntity operation,
                                         OperationOutcome outcome, String detail,
                                         UUID actorId, UUID batchId, Instant now) {
        activities.save(new ChannelListingActivityEntity(UUID.randomUUID(),
                operation.getChannelListingId(), ActivityKind.OPERATION,
                operation.getOperationKind() + " — " + outcome + (detail == null ? "" : ": " + detail),
                SOURCE_CHANNEL, actorId, now)
                .withOperation(operation.getId(), batchId));
    }

    private static SyncState syncStateFor(OperationOutcome outcome) {
        return switch (outcome) {
            case SUCCEEDED -> SyncState.SYNCED;
            case FAILED -> SyncState.FAILED;
            case MANUAL_REQUIRED -> SyncState.MANUAL_REQUIRED;
            case DIVERGED -> SyncState.DIVERGED;
            case REQUESTED, IN_PROGRESS -> SyncState.IN_PROGRESS;
        };
    }

    // =================================================================================
    // Inbound readback
    // =================================================================================

    /**
     * Writes the REPORTED side of a listing from what the adapter observed.
     *
     * <p>🔴 {@code PRD-181.a} — NO intended value is touched. Overwriting intent would destroy
     * the operator's unsent edit and make {@code DIVERGED} undetectable, which is the whole
     * reason the pair model exists ({@code INV-59.9}).
     */
    private void applySnapshot(ChannelListingEntity listing, ReportedListingSnapshot snapshot,
                               UUID actorId, Instant now, UUID operationId, UUID batchId) {
        listing.applyReportedContent(
                snapshot.title(), snapshot.titleReadable(),
                snapshot.description(), snapshot.descriptionReadable(),
                snapshot.salePrice(), snapshot.salePriceReadable(),
                snapshot.promotionPrice(), snapshot.promotionPriceReadable(),
                snapshot.promotionStartsAt(), snapshot.promotionEndsAt(),
                snapshot.promotionWindowReadable(),
                snapshot.stock(), snapshot.stockReadable(),
                snapshot.channelCategory(), snapshot.channelCategoryReadable());
        if (snapshot.listingStatus() != null) {
            // PRD-177.b — only a status the channel EXPLICITLY reported ever lands here.
            if (listing.getListingStatus() != snapshot.listingStatus()) {
                /*
                  🔴 THE ACTOR STAYS NULL, AND THAT IS THE SCHEMA'S OWN RULE: "NULL actor means
                  the marketplace or the scheduler acted, not a person" (V6). The operator asked
                  for the run; they did NOT set this status, and naming them here would attribute
                  a marketplace fact to a person (PRJ-124, PRJ-130).

                  ✅ PRD-186.f — the run that OBSERVED it is a different question, and the
                  history must be able to carry batch membership. The operation and batch are
                  therefore linked, which is what makes "which run reported this" answerable.
                */
                activities.save(new ChannelListingActivityEntity(UUID.randomUUID(),
                        listing.getId(), ActivityKind.CHANNEL_EVENT,
                        "Channel reported status " + snapshot.listingStatus() + ".",
                        SOURCE_CHANNEL, null, now)
                        .withOperation(operationId, batchId));
            }
            listing.applyReportedStatus(snapshot.listingStatus());
        }
        applyReportedSkus(listing.getId(), snapshot.skus(), actorId, now);
        applyReportedAttributes(listing.getId(), snapshot.attributes(), now);
        applyReportedMedia(listing.getId(), snapshot.mediaReferences(), now);
    }

    private void applyReportedSkus(UUID listingId, List<ReportedSkuSnapshot> reported,
                                   UUID actorId, Instant now) {
        if (reported == null || reported.isEmpty()) {
            return;
        }
        List<ChannelListingSkuEntity> existing =
                skus.findByChannelListingIdOrderByPositionAsc(listingId);
        Map<String, ChannelListingSkuEntity> byChannelSku = new HashMap<>();
        for (ChannelListingSkuEntity sku : existing) {
            if (sku.getChannelSku() != null) {
                byChannelSku.put(sku.getChannelSku().toLowerCase(java.util.Locale.ROOT), sku);
            }
        }
        int position = 0;
        for (ReportedSkuSnapshot snapshot : reported) {
            ChannelListingSkuEntity sku = snapshot.channelSku() == null ? null
                    : byChannelSku.get(snapshot.channelSku().toLowerCase(java.util.Locale.ROOT));
            if (sku == null && existing.size() == 1 && reported.size() == 1) {
                // The single-SKU case: the listing's one orderable unit simply learns its
                // channel SKU. This is identity resolution, not the fuzzy mapping PRD-179.b
                // forbids — the mapping to a Sellable Product is untouched.
                sku = existing.getFirst();
                sku.setChannelSku(snapshot.channelSku());
            }
            if (sku == null) {
                // PRD-190.b — a variation the channel reports that the ERP did not know about
                // appears as a new UNMAPPED orderable unit.
                sku = new ChannelListingSkuEntity(UUID.randomUUID(), listingId,
                        snapshot.channelSku(), position, actorId, now);
            }
            /*
              🔴 SYS-034 - an unreadable reported price stays unreadable. It never becomes
              zero, and the promotion never borrows the Sale Price when only one was returned.

              🔴 PRD-199.g - a channel that reported NO promotion has not reported that there
              is none. The window's readable flag carries that distinction, and the intended
              side is never touched here (PRD-181.a).
            */
            sku.applyReported(snapshot.salePrice(), snapshot.salePriceReadable(),
                    snapshot.promotionPrice(), snapshot.promotionPriceReadable(),
                    snapshot.promotionStartsAt(), snapshot.promotionEndsAt(),
                    snapshot.promotionWindowReadable(),
                    snapshot.stock(), snapshot.stockReadable(), snapshot.variationLabel());
            sku.setPosition(position++);
            sku.touch(actorId, now);
            skus.save(sku);
        }
        // ⚠ SKUs the channel did not report are deliberately LEFT ALONE. PRD-177's
        // absence-is-not-deletion guarantee applies to orderable units too.
    }

    private void applyReportedAttributes(UUID listingId, Map<String, String> reported,
                                         Instant now) {
        if (reported == null || reported.isEmpty()) {
            return;
        }
        int next = attributes.findByChannelListingIdOrderByPositionAsc(listingId).size();
        for (Map.Entry<String, String> entry : reported.entrySet()) {
            Optional<ChannelListingAttributeEntity> found = attributes
                    .findByChannelListingIdAndAttributeKey(listingId, entry.getKey());
            ChannelListingAttributeEntity attribute;
            if (found.isPresent()) {
                attribute = found.get();
            } else {
                // PRD-192 — an attribute the channel reports that the ERP did not know about
                // is recorded with a reported value and NO intent. Inventing intent from an
                // observation is exactly what PRD-181.a forbids.
                attribute = new ChannelListingAttributeEntity(UUID.randomUUID(), listingId,
                        entry.getKey(), null, next++);
            }
            /*
              🔴 READABLE MEANS "WE HAVE THE VALUE", NOT "ALWAYS". An adapter reports a null
              value for an attribute it saw but could not record — too long for this column, for
              instance. Marking that readable would assert an empty value the channel never sent.
            */
            attribute.applyReported(entry.getValue(), entry.getValue() != null);
            attributes.save(attribute);
        }
    }

    private void applyReportedMedia(UUID listingId, List<String> references, Instant now) {
        if (references == null) {
            // 🔴 SYS-034 — the adapter did not report media at all. That is NOT "the channel
            // has no media", so the previously reported set is left exactly as it was.
            return;
        }
        reportedMedia.deleteByChannelListingId(listingId);
        int position = 0;
        for (String reference : references) {
            // PRD-182.b — mirrored external references, never E-105 Media Assets.
            reportedMedia.save(new ChannelListingReportedMediaEntity(UUID.randomUUID(), listingId,
                    reference, position++, now));
        }
    }

    // =================================================================================
    // Outbound payload
    // =================================================================================

    /**
     * Builds what the adapter is asked to send, {@code PRD-171}.
     *
     * <p>🔴 {@code PRD-170} / {@code PRD-171.a} — the media carried here is the EFFECTIVE
     * intended set: the listing's own override if it has one, otherwise the mapped Sellable
     * Product's master media. The fallback is resolved at send time and never materialised
     * as a copy.
     */
    private OutboundListingPayload payloadFor(ChannelListingEntity listing) {
        List<ChannelListingSkuEntity> owned =
                skus.findByChannelListingIdOrderByPositionAsc(listing.getId());
        Map<String, String> attributeValues = new LinkedHashMap<>();
        for (ChannelListingAttributeEntity attribute
                : attributes.findByChannelListingIdOrderByPositionAsc(listing.getId())) {
            if (attribute.getIntendedValue() != null) {
                attributeValues.put(attribute.getAttributeKey(), attribute.getIntendedValue());
            }
        }
        List<OutboundListingPayload.OutboundSku> outboundSkus = owned.stream()
                .sorted(Comparator.comparingInt(ChannelListingSkuEntity::getPosition))
                .map(s -> new OutboundListingPayload.OutboundSku(s.getChannelSku(),
                        s.getSalePrice(), s.getPromotionPrice(), s.getPromotionStartsAt(),
                        s.getPromotionEndsAt(), s.getPublishedMarketplaceStock()))
                .toList();
        return new OutboundListingPayload(listing.getId(), listing.getExternalListingId(),
                listing.getIntendedTitle(), listing.getIntendedDescription(),
                listing.getSalePrice(), listing.getPromotionPrice(),
                listing.getPromotionStartsAt(), listing.getPromotionEndsAt(),
                listing.getPublishedMarketplaceStock(),
                listing.getIntendedChannelCategoryRef(), attributeValues,
                media.effectiveMediaReferences(listing), outboundSkus,
                listing.getPublicationIntent());
    }

    // =================================================================================
    // Reads
    // =================================================================================

    /**
     * One batch and its DERIVED aggregate, {@code INV-108.2}.
     *
     * <p>🔴 The tally is computed by grouping members. No succeeded/failed counter is stored
     * ({@code DB-001}).
     */
    @Transactional(readOnly = true)
    public ListingViews.BatchView batch(UUID batchId) {
        requirePermission(ProductPermissions.CHANNEL_LISTING_VIEW);
        ChannelListingOperationBatchEntity batch = batches.findById(batchId)
                .orElseThrow(() -> new ChannelListingValidationException("batchId",
                        "No operation batch with id " + batchId + "."));
        return batchSummary(batch);
    }

    /** The members of a batch, server-paginated ({@code PRD-174.c}). */
    @Transactional(readOnly = true)
    public Page<ListingViews.OperationView> batchMembers(UUID batchId, OperationOutcome outcome,
                                                         Pageable pageable) {
        requirePermission(ProductPermissions.CHANNEL_LISTING_VIEW);
        Page<ChannelListingOperationEntity> page = outcome == null
                ? operations.findByBatchIdOrderByRequestedAtAsc(batchId, pageable)
                : operations.findByBatchIdAndOutcomeOrderByRequestedAtAsc(batchId, outcome, pageable);
        Map<UUID, ChannelListingEntity> byId = new HashMap<>();
        for (ChannelListingEntity listing : listings.findAllById(
                page.getContent().stream().map(ChannelListingOperationEntity::getChannelListingId)
                        .distinct().toList())) {
            byId.put(listing.getId(), listing);
        }
        Map<UUID, String> channelNames = channelNames(byId.values());
        Map<UUID, String> actorNames = directory.namesOf(page.getContent().stream()
                .map(ChannelListingOperationEntity::getRequestedBy).distinct().toList());
        return page.map(o -> operationView(o, byId.get(o.getChannelListingId()), channelNames,
                actorNames));
    }

    /** A listing's own recent operations, {@code PRD-186.e}. */
    @Transactional(readOnly = true)
    public List<ListingViews.OperationView> operationsFor(UUID listingId) {
        requirePermission(ProductPermissions.CHANNEL_LISTING_VIEW);
        ChannelListingEntity listing = listings.findById(listingId)
                .orElseThrow(() -> new ChannelListingNotFoundException(listingId));
        List<ChannelListingOperationEntity> found =
                operations.findTop50ByChannelListingIdOrderByRequestedAtDesc(listingId);
        Map<UUID, String> channelNames = channelNames(List.of(listing));
        Map<UUID, String> actorNames = directory.namesOf(found.stream()
                .map(ChannelListingOperationEntity::getRequestedBy).distinct().toList());
        return found.stream()
                .map(o -> operationView(o, listing, channelNames, actorNames))
                .toList();
    }

    private ListingViews.OperationView operationView(ChannelListingOperationEntity operation,
                                                     ChannelListingEntity listing,
                                                     Map<UUID, String> channelNames,
                                                     Map<UUID, String> actorNames) {
        return new ListingViews.OperationView(operation.getId(),
                operation.getChannelListingId(),
                listing == null ? null : listing.getIntendedTitle(),
                listing == null ? null : listing.getExternalListingId(),
                listing == null ? null : channelNames.get(listing.getChannelInstanceId()),
                operation.getBatchId(), operation.getOperationKind(), operation.getOutcome(),
                operation.getDetail(), operation.getAdapterProvenance(),
                actorNames.get(operation.getRequestedBy()),
                operation.getRequestedAt(), operation.getCompletedAt());
    }

    private Map<UUID, String> channelNames(Collection<ChannelListingEntity> owned) {
        List<UUID> ids = owned.stream()
                .map(ChannelListingEntity::getChannelInstanceId).distinct().toList();
        Map<UUID, String> names = new HashMap<>();
        for (ChannelInstanceEntity channel : channels.findAllById(ids)) {
            names.put(channel.getId(), channel.getName());
        }
        return names;
    }

    /**
     * A listing's activity history, {@code PRD-129}.
     *
     * <p>✅ An ACTIVITY log, not an audit log ({@code AUD-001}). It replaces no audit
     * obligation.
     */
    @Transactional(readOnly = true)
    public Page<ListingViews.ActivityView> activity(UUID listingId, ActivityKind kind,
                                                    Pageable pageable) {
        requirePermission(ProductPermissions.CHANNEL_LISTING_VIEW);
        Page<ChannelListingActivityEntity> page = kind == null
                ? activities.findByChannelListingIdOrderByOccurredAtDesc(listingId, pageable)
                : activities.findByChannelListingIdAndEntryKindOrderByOccurredAtDesc(
                        listingId, kind, pageable);
        Map<UUID, String> actorNames = directory.namesOf(page.getContent().stream()
                .map(ChannelListingActivityEntity::getActorId)
                .filter(java.util.Objects::nonNull).distinct().toList());
        // ⚠ A null actor name is CORRECT for a channel event: the marketplace acted, not a
        // person. It is never backfilled with the operator who happened to trigger the run.
        return page.map(a -> new ListingViews.ActivityView(a.getId(), a.getEntryKind(),
                a.getSummary(), a.getFieldKey(), a.getBeforeValue(), a.getAfterValue(),
                a.getSource(), actorName(actorNames, a.getActorId()), a.getOperationId(),
                a.getBatchId(), a.getOccurredAt()));
    }

    /**
     * The display name for an activity's actor, or {@code null} when there is no person to name.
     *
     * <p>🔴 THE NULL CHECK IS THE WHOLE POINT, AND IT IS NOT DEFENSIVE PADDING. A
     * {@code CHANNEL_EVENT} carries a NULL actor by design — the marketplace acted, not a person
     * — and {@code ActorDirectory.namesOf} returns an IMMUTABLE {@code Map.of()} when it is
     * handed no identifiers. ⚠ {@code Map.of().get(null)} THROWS rather than returning null, so
     * a page whose rows ALL have a null actor took the whole endpoint down with a 500.
     *
     * <p>⚠ Every listing detail page hit this in production on 2026-08-18: the first Daraz pull
     * wrote nine channel events and nothing else, so every activity page was all-null-actor.
     *
     * <p>🔴 NO NAME IS INVENTED HERE. "System", "Daraz" or the operator who triggered the run
     * would each assert something the record does not say ({@code PRJ-124}, {@code PRD-186.e}).
     */
    private static String actorName(Map<UUID, String> names, UUID actorId) {
        return actorId == null ? null : names.get(actorId);
    }

    /** Recent batches, newest first. */
    @Transactional(readOnly = true)
    public Page<ListingViews.BatchView> recentBatches(Pageable pageable) {
        requirePermission(ProductPermissions.CHANNEL_LISTING_VIEW);
        return batches.findAllByOrderByRequestedAtDesc(pageable).map(this::batchSummary);
    }

    /**
     * 🔴 {@code INV-108.2} — every count is DERIVED by grouping members at read time. No
     * succeeded/failed counter is stored ({@code DB-001}), so a batch can never disagree
     * with its own members.
     */
    private ListingViews.BatchView batchSummary(ChannelListingOperationBatchEntity batch) {
        Map<OperationOutcome, Long> tally = new EnumMap<>(OperationOutcome.class);
        for (Object[] row : operations.tallyByBatch(batch.getId())) {
            tally.put((OperationOutcome) row[0], (Long) row[1]);
        }
        long total = tally.values().stream().mapToLong(Long::longValue).sum();
        long inFlight = tally.getOrDefault(OperationOutcome.REQUESTED, 0L)
                + tally.getOrDefault(OperationOutcome.IN_PROGRESS, 0L);
        return new ListingViews.BatchView(batch.getId(), batch.getOperationKind(),
                batch.getScopeDescription(), directory.nameOf(batch.getRequestedBy()),
                batch.getRequestedAt(), batch.getCompletedAt(), total,
                tally.getOrDefault(OperationOutcome.SUCCEEDED, 0L),
                tally.getOrDefault(OperationOutcome.FAILED, 0L),
                tally.getOrDefault(OperationOutcome.MANUAL_REQUIRED, 0L),
                tally.getOrDefault(OperationOutcome.DIVERGED, 0L),
                inFlight);
    }

    private Actor requirePermission(String permission) {
        Actor actor = currentActor.require();
        if (!actor.hasPermission(permission)) {
            throw new AccessDeniedByPermissionException(permission);
        }
        return actor;
    }

    /**
     * What a discovery run actually achieved, {@code PRD-175} / {@code API-066.b}.
     *
     * <p>🔴 {@code complete} is reported to the operator verbatim. A truncated run is never
     * presented as a full picture of the channel.
     */
    public record DiscoveryOutcome(UUID batchId, int listingsSeen, int listingsCreated,
                                   boolean complete, String incompleteReason) {
    }
}
