import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../shell/AppShell';
import { ACTION_ICON, ACTION_ICON_SIZE, ACTION_ICON_STROKE } from '../shell/icons';
import { Card, EmptyState, Notice, buttonStyle } from '../ui/primitives';
import { formatMoneyForDisplay, hasDiscount } from '../platform/money';
import { formatMoment, formatShortMoment } from '../platform/datetime';
import { ChannelListingComparison, displayComparisonValue } from './ChannelListingComparison';
import { isLongProviderText, readableProviderText } from './providerText';
import { MappingModal } from './MappingModal';
import { PushReviewModal } from './PushReviewModal';
import { ListingRefreshState, useListingRefresh } from './ListingRefreshState';
import { ListingSkuSection } from './ListingSkuSection';
import {
  fetchActivity,
  fetchChannelListing,
  fetchChannels,
  fetchComparison,
  fetchMedia,
} from './channelListingApi';
import type {
  ActivityView,
  CapabilityView,
  ChannelView,
  RefreshResult,
  RefreshState,
  ChannelListing,
  ComparisonRow,
  MediaSetView,
} from './channelListingApi';

/**
 * FRAME 06 AND FRAME 11 — Listing Detail, including the unmapped state.
 *
 * <p>⚠ `LSC-003` — `FRAME 11` IS THIS SAME PAGE WITH NO MAPPING, not a second surface. The
 * pack draws the unmapped detail and its *Create Sellable Product* handoff as a STATE of the
 * detail view, so it is tagged here rather than given a component that would duplicate it.
 *
 * <p>The operational truth view for ONE Listing: what it is, whose shop it is in, whether it
 * is mapped, what Trioloo intends, what the marketplace reports, and what may be done next.
 *
 * <p>🔴 NOT an ecommerce product page. No hero, no marketing image, no oversized type. It is
 * a dense operational surface built from the same tokens as the workspace.
 *
 * <p>⚠ FRAME BOUNDARIES. This page carries the SUMMARY of comparison, orderable SKUs, media
 * and activity, and an entry into each. The deep surfaces belong to Frames 07, 12, 13, 14,
 * 15 and 21 and are deliberately not built here.
 */

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'highlights', label: 'Highlights' },
  { id: 'comparison', label: 'Intended vs reported' },
  { id: 'skus', label: 'Orderable SKUs' },
  { id: 'media', label: 'Media' },
  { id: 'category', label: 'Category & attributes' },
  { id: 'activity', label: 'Activity' },
] as const;

export default function ChannelListingDetailPage(): React.JSX.Element {
  const { id } = useParams();
  const { session } = useAuth();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  const mayManage = permissions.includes('product.channel-listing.manage');
  const mayPublish = permissions.includes('product.channel-listing.publish');
  const maySync = permissions.includes('product.channel-listing.sync');

  const [loadedItem, setItem] = useState<ChannelListing | null>(null);
  const [loadedComparison, setComparison] = useState<readonly ComparisonRow[]>([]);
  const [media, setMedia] = useState<MediaSetView | null>(null);
  const [activity, setActivity] = useState<readonly ActivityView[]>([]);
  /*
    🔴 `API-063.a` — WHAT THIS CHANNEL DECLARES IT CAN WRITE. Read separately because capability
    belongs to the CHANNEL INSTANCE, not to one listing (`PRD-125`). ⚠ Without it the surface
    cannot tell "readable" from "pushable" and would offer a push the channel never promised.
  */
  const [capabilities, setCapabilities] = useState<readonly CapabilityView[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** 🔴 Frame 15 — exactly ONE listing, this listing's own channel and shop. */
  const [pushReviewOpen, setPushReviewOpen] = useState(false);
  /** 🔴 Frame 16 — this Listing's inbound read, reported inline on this page. */
  const refresh = useListingRefresh();
  const [active, setActive] = useState<string>('overview');
  // ⚠ Frame 12 opens over the Detail page; the page keeps its scroll and its loaded sections.
  const [mappingOpen, setMappingOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [listing, rows, mediaSet, activityPage, channelList] = await Promise.all([
        fetchChannelListing(id),
        fetchComparison(id),
        fetchMedia(id),
        fetchActivity(id, '', 0, 3),
        /* ⚠ A read. It declares capability; it never changes one. */
        fetchChannels().catch((): readonly ChannelView[] => []),
      ]);
      /*
        ⚠ CAPABILITY IS AN ENHANCEMENT, NOT A PRECONDITION. If the channel list cannot be read
        the page still shows the listing; it simply declares nothing writable, which is the
        fail-closed answer `API-063` already requires.
      */
      setCapabilities(
        channelList.find((c) => c.id === listing.channelInstanceId)?.capabilities ?? [],
      );
      setItem(listing);
      setComparison(rows);
      setMedia(mediaSet);
      setActivity(activityPage.content);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Listing could not be loaded.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const goToSection = (sectionId: string): void => {
    setActive(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ block: 'start' });
  };

  if (error && !loadedItem) {
    return (
      <>
        <PageHeader title="Listing" subtitle="Products · Listings" />
        <Card>
          <EmptyState title="Listing could not be loaded" guidance={error} />
        </Card>
      </>
    );
  }
  if (!loadedItem) {
    return (
      <>
        <PageHeader title="Listing" subtitle="Products · Listings" />
        <Card>
          <EmptyState title="Loading Listing..." guidance="Fetching the current record." />
        </Card>
      </>
    );
  }

  /*
    ⚠ DEVELOPMENT ONLY. `import.meta.env.DEV` is statically false in a production build, so
    this branch, its query parameter and the fixtures it names are stripped entirely by the
    bundler.

    🔴 IT MUTATES NOTHING. The page issues exactly the requests it always issues; this
    substitutes what is RENDERED after they arrive. No listing, SKU, attribute or media row
    in the database is touched to stage a screenshot.
  */
  const staged = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('__devState') === 'comparisonCases';
  /** ⚠ DEVELOPMENT ONLY — renders the Frame 16 states a real adapter would produce. */
  const devRefreshStates = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('__devState') === 'refreshStates';
  /*
    🔴 ONE TRUTH PER RENDER. The fixture stages the comparison AND the same facts wherever
    else this page shows them. Staging only the table produced a page that said Sale Price
    DIVERGED at ৳ 11,200 → ৳ 10,900 in one card and "Not readable from this channel" in the
    card above it — two contradictory claims about a single fact.

    ⚠ The media row's INTENDED count is read from the media set actually loaded, so the
    fixture cannot claim images the Media panel does not show.
  */
  const comparison = staged
    ? devComparisonCases(media?.effective.length ?? 0)
    : loadedComparison;
  const item = staged ? { ...loadedItem, ...DEV_STAGED_FACTS } : loadedItem;

  const title = item.intendedTitle || item.channelReportedTitle || 'Untitled listing';
  const unmapped = item.mappedSkuCount === 0;
  /*
    🔴 THE TWO PRECONDITIONS ARE DIFFERENT FACTS AND ARE NAMED SEPARATELY (`§50`). A Listing
    the channel has never seen has nothing to read back; a channel with no adapter cannot be
    read at all. Where both are true the operator is told both, because fixing one would not
    make the act possible.
  */
  const refreshBlocked = ((): string | null => {
    const reasons: string[] = [];
    if (item.externalListingId === null) {
      reasons.push('This Listing has not been published yet, so the channel has nothing to read back.');
    }
    if (!item.adapterAvailable) {
      reasons.push(`No marketplace adapter is configured for ${item.channelName ?? 'this channel'}.`);
    } else if (item.adapterReadsListings === false) {
      /*
        🔴 A DIFFERENT UNAVAILABILITY, NEVER MERGED WITH THE ONE ABOVE. The adapter is
        present; it DECLARES that it can read nothing. Calling that "no adapter configured"
        would send the operator to look for an integration that is already there.
      */
      reasons.push(`The marketplace adapter for ${item.channelName ?? 'this channel'} reports no readable Listing facts.`);
    }
    return reasons.length === 0 ? null : reasons.join(' ');
  })();

  const RefreshIcon = ACTION_ICON.syncNow;
  const BackIcon = ACTION_ICON.back;
  const EditIcon = ACTION_ICON.edit;
  const PushIcon = ACTION_ICON.push;
  /*
    🔴 UNREADABLE IS NOT EQUAL. Equality may only be concluded from facts the channel
    ACTUALLY RETURNED; a value the adapter could not read proves nothing about whether it
    matches (`SYS-034`, `API-063.c`). The states below are kept apart deliberately, and
    "nothing differs" is reachable ONLY when at least one fact was actually compared and
    every one of them matches.
  */
  const divergedRows = comparison.filter((row) => row.state === 'DIVERGED');
  const manualRows = comparison.filter((row) => row.state === 'MANUAL_REQUIRED');
  // 🔴 COMPARED, not merely readable. A MANUAL_REQUIRED fact came back from the channel but
  // has no trustworthy deterministic basis (`PRD-183.d`), so counting it as agreement would
  // be the same lie as counting an unreadable one.
  const comparedRows = comparison.filter(
    (row) => row.reportedReadable && row.state !== 'MANUAL_REQUIRED',
  );
  const unreadableCount = comparison.filter((row) => !row.reportedReadable).length;
  const attributeRows = comparison.filter((row) => row.fieldKey.startsWith('attribute:'));

  /*
    🔴 The contextual page header for ONE Listing — not a second copy of the workspace
    header. Identity leads; the actions are exactly those the operator may actually perform,
    and there is exactly one dark primary.
  */
  return (
    <>
      <PageHeader
        title={title}
        subtitle={[
          item.channelName ?? item.channelInstance,
          item.externalListingId ?? 'Not published to the channel yet',
          item.skuCount > 1 ? `${item.skuCount} orderable SKUs` : item.skus[0]?.channelSku,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Link data-testid="detail-back" to="/inventory/products/listings" style={headerSecondary}>
              <BackIcon size={ACTION_ICON_SIZE} strokeWidth={ACTION_ICON_STROKE} aria-hidden="true" />
              Back to Listings
            </Link>
            {/*
              🔴 CAPABILITY IS NOT AUTHORITY. Refresh appears for a sync-holder; it is only
              offered when there is a channel identity and an adapter to read with.
            */}
            {/*
              🔴 SHOWN AND DISABLED, NOT HIDDEN. A hidden control states no reason at all, and
              `§40` requires the reason to be reachable rather than mouse-only. This matches
              the row-menu convention, where an unmet PRECONDITION dims with an explanation and
              only an unmet AUTHORITY omits.

              ⚠ `UX-272` is deliberately NOT applied here. That rule keeps the OUTBOUND REVIEW
              reachable when execution is not; Refresh IS the remote operation, so when it
              cannot be performed there is nothing to open.
            */}
            {maySync && (
              <button
                type="button"
                data-testid="detail-refresh"
                disabled={refreshBlocked !== null || refresh.refreshingId === item.id}
                aria-describedby={refreshBlocked ? 'detail-refresh-reason' : undefined}
                onClick={() => void refresh.run(item.id)}
                style={refreshBlocked ? { ...headerSecondary, ...headerDisabled } : headerSecondary}
              >
                <RefreshIcon size={ACTION_ICON_SIZE} strokeWidth={ACTION_ICON_STROKE} aria-hidden="true" />
                Refresh
              </button>
            )}
            {mayManage && (
              <Link data-testid="edit-channel-listing" to={`/inventory/products/listings/${item.id}/edit`} style={headerSecondary}>
                <EditIcon size={ACTION_ICON_SIZE} strokeWidth={ACTION_ICON_STROKE} aria-hidden="true" />
                Edit
              </Link>
            )}
            {/*
              The divergence entry takes the ink outline — strong, but not the primary.
              🔴 Offered only when a READABLE fact actually differs. A listing can carry the
              DIVERGED sync state while nothing readable differs; sending the operator to
              resolve nothing would be worse than not offering it.
            */}
            {divergedRows.length > 0 && (
              <button type="button" data-testid="detail-resolve" onClick={() => goToSection('comparison')} style={{ ...headerSecondary, border: '1.5px solid var(--color-ink)', boxShadow: 'none', fontWeight: 700 }}>
                Resolve divergence
              </button>
            )}
            {/* 🔴 `PRD-196.a` — publish authority only; manage never implies it. */}
            {mayPublish && (
              /*
                🔴 OPENS THE REVIEW; IT DOES NOT PUSH. Frame 15 is the one outbound boundary
                (`UX-271.c`), so the act is reachable only after the operator has seen what
                would be sent.

                🔴 Mapping and adapter capability are no longer a disabled `title` here.
                Both still prevent execution, but they belong in the review's PREFLIGHT where
                each is named in its own dimension with its own remedy — a tooltip could
                carry only one of them, and only to a mouse.
              */
              <button
                type="button"
                data-testid="detail-push"
                onClick={() => setPushReviewOpen(true)}
                style={headerPrimary}
              >
                <PushIcon size={ACTION_ICON_SIZE} strokeWidth={ACTION_ICON_STROKE} aria-hidden="true" />
                {/* 🔴 §17 — the two modes never share wording. */}
                {item.externalListingId ? <>Review &amp; Push</> : <>Review &amp; Publish</>}
              </button>
            )}
          </>
        }
      />

      {maySync && refreshBlocked && (
        /* 🔴 VISIBLE and keyboard-reachable — the disabled action points at this by id. */
        <p
          id="detail-refresh-reason"
          data-testid="detail-refresh-reason"
          style={{ fontSize: '11.5px', lineHeight: 1.6, color: 'var(--color-text-secondary)', margin: '0 0 var(--space-4)' }}
        >
          Refresh unavailable — {refreshBlocked}
        </p>
      )}

      {/* 🔴 Frame 16 — inline, and this page keeps its place and its scroll. */}
      <ListingRefreshState
        state={refresh.state}
        result={refresh.result}
        error={refresh.error}
        listingTitle={title}
        channelName={item.channelName}
        onDismiss={() => { refresh.dismiss(); void load(); }}
        onRetry={() => void refresh.run(item.id)}
      />

      {devRefreshStates && (
        /*
          ⚠ DEVELOPMENT ONLY. `import.meta.env.DEV` is statically false in a production build,
          so this branch, its query parameter and its fixtures are removed by the bundler.

          🔴 IT IS PURE PRESENTATION. No request is issued, no adapter is contacted, no
          operation is recorded and nothing in the database is touched. It renders the Frame 16
          component against fixed props so the states a REAL adapter would produce can be seen
          before one exists — the alternative would be writing fake marketplace facts into dev
          data to stage a screenshot.
        */
        <div data-testid="dev-refresh-states" style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {DEV_UNAVAILABLE_REASONS.map((reason) => (
            <p
              key={reason}
              data-testid="dev-refresh-unavailable"
              style={{ fontSize: '11.5px', lineHeight: 1.6, color: 'var(--color-text-secondary)', margin: 0 }}
            >
              {reason}
            </p>
          ))}
          {DEV_REFRESH_CASES.map((staged, index) => (
            <ListingRefreshState
              key={`${staged.state}-${index}`}
              state={staged.state}
              result={staged.result}
              error={staged.error}
              listingTitle={title}
              channelName={item.channelName}
              onDismiss={() => {}}
              onRetry={() => {}}
            />
          ))}
        </div>
      )}

      <div data-testid="channel-listing-detail" style={{ display: 'grid', gap: 'var(--space-5)' }}>
        {error && (
          /*
            🔴 `RULE 3.3.d.b` — a failed action is a MEANINGFUL operational message and takes
            the `danger` role. ⚠ It was previously rendered in the neutral note treatment,
            which said nothing about whether it had succeeded.
          */
          <Notice tone="danger" title="The action could not be completed" testId="listing-detail-notice">
            {error}
          </Notice>
        )}

        {/* Frame 06 section strip. Each entry moves to the summary section on this page;
            the deeper surfaces are Frames 07, 13, 14 and 21. */}
        <div data-testid="detail-sections" role="tablist" aria-label="Listing sections" style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--color-border-card)' }}>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={active === section.id}
              data-testid={`detail-tab-${section.id}`}
              onClick={() => goToSection(section.id)}
              style={{
                padding: '9px 14px',
                fontSize: '12.5px',
                fontWeight: active === section.id ? 700 : 600,
                color: active === section.id ? 'var(--color-heading-ink)' : 'var(--color-text-muted)',
                background: 'transparent',
                border: 'none',
                borderRadius: 0,
                boxShadow: active === section.id ? 'inset 0 -2px 0 var(--color-ink)' : 'none',
                fontFamily: 'inherit',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 'var(--space-8)', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>
            {/* ------------------------------------------------------------------ A */}
            <Section id="overview" label="Overview" refs={sectionRefs}>
              <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px 24px', margin: 0 }}>
                <Fact label="Intended title" value={item.intendedTitle} missing="Not set locally" />
                {/*
                  ⚠ THE CHANNEL'S OWN TITLE, SHOWN AS RECEIVED. It is the page heading's
                  fallback, but an operator comparing the two needs to see it named as the
                  CHANNEL'S rather than inferred from the heading.
                  🔴 `DZC-026` — `attributes.name` and nothing else. No attribute is
                  substituted for it, in any language.
                */}
                <Fact
                  label="Channel reported title"
                  value={item.reportedTitleReadable ? readableProviderText(item.channelReportedTitle) : null}
                  missing="Not readable from this channel"
                />
                <Fact label="Channel / Shop" value={item.channelName ?? item.channelInstance} />
                <Fact label="Listing status" value={item.listingStatus} missing="No status reported" strong />
                {/* 🔴 `PRD-188.b` — absence is stated, never blank and never faked. */}
                <Fact label="External listing ID" value={item.externalListingId} missing="Not published" mono />
                <Fact label="Publication intent" value={item.publicationIntent} missing="Not set" />
                <Fact label="Sync state" value={item.syncState} />
                <Fact
                  label="Unsent local changes"
                  value={item.hasUnsentLocalChanges ? 'Yes — not sent to the channel' : 'None'}
                />
                <Fact label="Last successful push" value={formatMoment(item.lastSuccessfulPushAt)} missing="Never pushed" />
                <Fact label="Last seen in discovery" value={formatMoment(item.lastSeenInDiscoveryAt)} missing="Not seen in a run" />
              </dl>

              {/*
                ⚠ DESCRIPTION IS THE ONE FACT THE FACT-GRID CANNOT HOLD. It is a paragraph, not
                a value, and a marketplace writes it as HTML — so it gets its own readable pair
                rather than a clipped one-line cell that showed the operator `<ul><li>…`.

                🔴 PRESENTATION ONLY. `readableProviderText` never changes what is stored, and
                the intended side stays exactly what a person authored (`PRD-181.a`).
              */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px 24px', marginTop: '18px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={columnLabel}>Intended description</div>
                  <div data-testid="detail-intended-description" style={descriptionBlock(item.intendedDescription)}>
                    {item.intendedDescription ?? 'Not set locally'}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={columnLabel}>Channel reported description</div>
                  <div
                    data-testid="detail-reported-description"
                    style={{
                      ...descriptionBlock(item.reportedDescriptionReadable ? readableProviderText(item.reportedDescription) : null),
                      color: item.reportedDescriptionReadable ? 'var(--color-text-primary)' : 'var(--color-text-demoted)',
                      fontStyle: item.reportedDescriptionReadable ? 'normal' : 'italic',
                    }}
                  >
                    {item.reportedDescriptionReadable
                      ? readableProviderText(item.reportedDescription) ?? '—'
                      : 'Not readable from this channel'}
                  </div>
                </div>
              </div>
            </Section>

            {/* ------------------------------------------------------------------ B */}
            <Section id="price" label="Price and listing stock" refs={sectionRefs}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
                {/* 🔴 `PRD-199.a` — the NORMAL price, paid whenever no promotion is running. */}
                <Figure
                  testId="detail-sale-price"
                  label="Sale Price — intended"
                  value={formatMoneyForDisplay(item.salePrice)}
                  reportedLabel="Reported"
                  reported={item.reportedSalePriceReadable ? formatMoneyForDisplay(item.reportedSalePrice) : null}
                  readable={item.reportedSalePriceReadable}
                  emphasis={comparison.some((r) => r.fieldKey === 'sale_price' && r.state === 'DIVERGED')}
                  suffix={item.priceIsFrom ? 'lowest across orderable SKUs' : undefined}
                />
                {/*
                  🔴 `PRD-199.b` — the promotion is a SECOND SELLING PRICE, not a discount
                  figure. It is shown beside the base price with the window that governs it,
                  because a promotion price without its window is meaningless.
                */}
                <Figure
                  testId="detail-promotion-price"
                  label="Promotion Price — intended"
                  value={formatMoneyForDisplay(item.promotionPrice)}
                  reportedLabel="Reported"
                  reported={item.reportedPromotionPriceReadable
                    ? formatMoneyForDisplay(item.reportedPromotionPrice) : null}
                  readable={item.reportedPromotionPriceReadable}
                  emphasis={comparison.some((r) => r.fieldKey === 'promotion_price' && r.state === 'DIVERGED')}
                  suffix={promotionSuffix(item)}
                />
                <Figure
                  testId="detail-listing-stock"
                  label="Listing stock — intended"
                  value={item.listingStock}
                  reportedLabel="Reported"
                  reported={item.reportedStockReadable ? item.reportedStock : null}
                  readable={item.reportedStockReadable}
                  emphasis={comparison.some((r) => r.fieldKey === 'listing_stock' && r.state === 'DIVERGED')}
                />
              </div>
              {/* 🔴 `PRD-193` — stated on the page so it can never be read as inventory. */}
              <p style={captionStyle}>
                Listing stock is the quantity this channel is told to offer. It is held on the
                listing and is not derived from warehouse inventory.
              </p>
            </Section>

            {/* ------------------------------------------------------------------ B2 */}
            <Section
              id="highlights"
              label="Highlights"
              refs={sectionRefs}
              meta={
                item.highlights.length === 0
                  ? undefined
                  : item.highlightsAreFallback
                    ? 'From the Sellable Product master set'
                    : 'Authored for this listing'
              }
            >
              {/*
                🔴 `PRD-198.b` — the AUTHORED ORDER is meaningful and is rendered exactly as
                stored. They are never merged into one paragraph and never re-sorted here.
              */}
              {item.highlights.length === 0 ? (
                <p style={{ ...captionStyle, marginTop: 0 }}>
                  No highlights have been authored for this listing, and no master set is
                  available from a mapped Sellable Product.
                </p>
              ) : (
                <ol data-testid="detail-highlights" style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {item.highlights.map((highlight, index) => (
                    <li key={`${index}-${highlight}`} style={{ fontSize: '12.5px', color: 'var(--color-text-primary)', lineHeight: 1.6, overflowWrap: 'anywhere' }}>
                      {highlight}
                    </li>
                  ))}
                </ol>
              )}
            </Section>

            {/* ------------------------------------------------------------------ C */}
            <Section
              id="mapping"
              label="Mapping"
              refs={sectionRefs}
              action={
                mayManage ? (
                  /*
                    🔴 FRAME 12 OWNS THE INTERACTION. Detail states the mapping and hands off;
                    it does not carry a second mapping editor, and it no longer sends the
                    operator to the Edit page merely to change a relationship (§6).
                  */
                  <button
                    type="button"
                    data-testid="detail-change-mapping"
                    onClick={() => setMappingOpen(true)}
                    style={{ ...sectionAction, background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                  >
                    {unmapped ? 'Map to Sellable Product' : 'Change mapping'}
                  </button>
                ) : undefined
              }
            >
              {/*
                🔴 `INV-106.2` — the ORDERABLE SKU is the mapping unit. A multi-SKU listing
                reports its true aggregate rather than pretending to one listing-level mapping.
              */}
              {item.skuCount > 1 ? (
                <div data-testid="detail-mapping-summary" style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>
                  {item.mappedSkuCount} of {item.skuCount} SKUs mapped
                  {item.mappedSkuCount < item.skuCount && (
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {' '}· {item.skuCount - item.mappedSkuCount} unmapped SKU
                      {item.skuCount - item.mappedSkuCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {/*
                    🔴 `PRD-178.d` — PARTIAL IS VALID, and the consequence attaches to the
                    unmapped SKUs alone. Calling the listing mapped because one SKU resolves
                    would be discovered only at push time.
                  */}
                  {item.mappedSkuCount < item.skuCount && (
                    <p style={captionStyle}>
                      Partial mapping is a valid state. The unmapped SKUs cannot push
                      Product-derived ERP values until each one is mapped.
                    </p>
                  )}
                </div>
              ) : unmapped ? (
                <div data-testid="detail-mapping-summary">
                  <span style={dashedChip}>UNMAPPED</span>
                  {/*
                    🔴 `PRD-178.d` — VALID, NOT AN ERROR, and after a first discovery of 3000+
                    records it is the ordinary condition of most listings. The one real
                    consequence is named once, without alarm.
                  */}
                  <p style={captionStyle}>
                    This channel SKU is not linked to a Sellable Product. Keeping the listing
                    unmapped is valid — but Product-derived ERP values cannot be pushed until a
                    mapping exists.
                  </p>
                </div>
              ) : (
                <div data-testid="detail-mapping-summary" style={{ display: 'grid', gridTemplateColumns: '38px minmax(0, 1fr)', gap: '14px', alignItems: 'center', border: '1px solid var(--color-divider-inner)', borderRadius: 'var(--radius-control)', padding: '10px 12px' }}>
                  <div aria-hidden="true" style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-control)', background: 'var(--color-divider-light)' }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {item.sellableName ?? item.mappedSellableSku}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-demoted)', marginTop: '2px', fontFamily: 'var(--font-family-mono)' }}>
                      {item.mappedSellableSku} · Sellable Product
                    </div>
                  </div>
                </div>
              )}
              <p style={captionStyle}>
                Each orderable channel SKU maps to exactly one Sellable Product, or to none while
                unmapped. A variation listing therefore holds one mapping per SKU.
              </p>
            </Section>

            {/* ------------------------------------------------------------------ D */}
            <Section id="category" label="Channel category and attributes" refs={sectionRefs}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Fact
                  label="Marketplace channel category"
                  value={item.intendedChannelCategory}
                  missing="Not set"
                  note="Adapter-owned vocabulary, mirrored as text"
                />
                <Fact label="Sellable Product category" value={item.sellableName ? 'Owned by Products' : null} missing="Not mapped" note="Independent of the channel category" />
              </div>
              {attributeRows.length > 0 ? (
                <div data-testid="detail-attributes" style={{ marginTop: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '12px', paddingBottom: '7px', borderBottom: '1px solid var(--color-divider-inner)' }}>
                    <div style={columnLabel}>Attribute</div>
                    <div style={columnLabel}>Intended</div>
                    <div style={columnLabel}>Reported</div>
                  </div>
                  {attributeRows.map((row) => (
                    <div key={row.fieldKey} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '12px', padding: '9px 0', borderBottom: '1px solid var(--color-divider-light)', fontSize: '12.5px', minWidth: 0 }}>
                      <div style={{ fontWeight: 600, ...clip }}>{row.label}</div>
                      <div style={attributeCell(row.intendedValue)} data-testid={`attribute-intended-${row.fieldKey}`}>
                        {readableProviderText(row.intendedValue) ?? '—'}
                      </div>
                      {/*
                        🔴 `SYS-034` — unreadable is said in words, never shown as empty.
                        ⚠ A readable value is shown through `readableProviderText`: a marketplace
                        writes attributes as HTML, and the raw fragment was rendering as tag soup
                        on one clipped line. Presentation only — the stored value is untouched.
                      */}
                      <div
                        data-testid={`attribute-reported-${row.fieldKey}`}
                        style={{
                          ...attributeCell(row.reportedReadable ? row.reportedValue : null),
                          color: row.reportedReadable ? 'var(--color-text-primary)' : 'var(--color-text-demoted)',
                          fontStyle: row.reportedReadable ? 'normal' : 'italic',
                        }}
                      >
                        {row.reportedReadable
                          ? readableProviderText(row.reportedValue) ?? '—'
                          : 'Not readable from this channel'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={captionStyle}>No channel attributes have been recorded for this listing.</p>
              )}
            </Section>

            {/* ------------------------------------------------------------------ E */}
            <Section
              id="skus"
              label="Variations / Channel SKUs"
              refs={sectionRefs}
              meta={item.skuCount === 1 ? 'One orderable SKU' : `${item.skuCount} orderable SKUs`}
            >
              {/*
                🔴 FRAME 14 — the section body is ONE shared component so single-SKU and
                variation listings cannot drift apart. Detail owns placement; the section owns
                the per-SKU truth, and neither owns a write.
              */}
              <ListingSkuSection
                item={item}
                mayManage={mayManage}
                onMapSku={() => setMappingOpen(true)}
              />
            </Section>
            {/* ------------------------------------------------------------ FRAME 07 */}
            <Section id="comparison" label="Intended vs reported" refs={sectionRefs}>
              <ChannelListingComparison
                item={item}
                rows={comparison}
                capabilities={capabilities}
                mayManage={mayManage}
                mayPublish={mayPublish}
                onResolved={load}
                onCompareMedia={() => goToSection('media')}
              />
            </Section>
          </div>

          {/* --------------------------------------------------------------- sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* F */}
            <Aside id="media" label="Media" refs={sectionRefs}>
              {media && media.effective.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px' }}>
                  {media.effective.slice(0, 4).map((asset, index) => (
                    // 🔴 `RULE 3.15.a` — the canonical neutral block. No placeholder art.
                    <div key={`${asset.storageReference}-${index}`} aria-hidden="true" style={{ aspectRatio: '1', borderRadius: 'var(--radius-control-small)', background: 'var(--color-divider-light)' }} />
                  ))}
                </div>
              ) : (
                <p style={{ ...captionStyle, marginTop: 0 }}>No media is attached to this listing.</p>
              )}
              {media && (
                <p style={captionStyle}>
                  {media.effectiveIsFallback
                    ? `Using Sellable Product media — ${media.effective.length} image${media.effective.length === 1 ? '' : 's'}, no listing override.`
                    : `Listing override — ${media.effective.length} image${media.effective.length === 1 ? '' : 's'}.`}
                </p>
              )}
              {mayManage && (
                <Link data-testid="detail-manage-media" to={`/inventory/products/listings/${item.id}/media`} style={{ ...asideAction, textDecoration: 'none' }}>
                  Manage media
                </Link>
              )}
            </Aside>

            {/* G — the comparison SUMMARY and its entry. Frame 07 owns the full surface. */}
            <Aside id="comparison-summary" label="Intended vs reported" refs={sectionRefs} emphasis={divergedRows.length > 0}>
              {/*
                🔴 THE FOUR STATES, KEPT APART.

                  · a readable fact that differs   → diverged
                  · readable facts that all match  → aligned
                  · a fact the channel did not return → not readable, and NOT equal
                  · nothing readable at all        → nothing to compare

                ⚠ Saying "nothing differs" when every value was unreadable would infer
                equality from absence, which is exactly what `SYS-034` forbids.
              */}
              <p data-testid="detail-comparison-summary" style={{ fontSize: '12.5px', margin: '9px 0 0', lineHeight: 1.6, color: 'var(--color-text-primary)' }}>
                {divergedRows.length > 0
                  ? `${divergedRows.length} fact${divergedRows.length === 1 ? ' differs' : 's differ'} from what the channel reports.`
                  : comparedRows.length === 0
                    ? 'No channel values could be compared.'
                    : `All ${comparedRows.length} compared channel value${comparedRows.length === 1 ? ' matches' : 's match'} ERP intent.`}
              </p>
              {unreadableCount > 0 && (
                <p data-testid="detail-comparison-unreadable" style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', margin: '6px 0 0', lineHeight: 1.5 }}>
                  {unreadableCount} value{unreadableCount === 1 ? ' was' : 's were'} not readable from
                  this channel and {unreadableCount === 1 ? 'was' : 'were'} not compared.
                </p>
              )}
              {manualRows.length > 0 && (
                <p data-testid="detail-comparison-manual" style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', margin: '6px 0 0', lineHeight: 1.5 }}>
                  {manualRows.length} fact{manualRows.length === 1 ? '' : 's'} cannot be compared
                  automatically and {manualRows.length === 1 ? 'needs' : 'need'} a person.
                </p>
              )}
              {/*
                🔴 The listing-level sync state is a SEPARATE fact from the field-by-field
                comparison. Where it says DIVERGED but no readable field differs, both are
                stated rather than one being quietly dropped — and no divergence is invented.
              */}
              {item.syncState === 'DIVERGED' && divergedRows.length === 0 && (
                <p data-testid="detail-comparison-state-note" style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', margin: '6px 0 0', lineHeight: 1.5 }}>
                  The channel marked this listing DIVERGED, but no readable field difference is
                  recorded. Refresh to read the channel again.
                </p>
              )}
              {divergedRows.length > 0 && (
                <div data-testid="detail-diverged-facts" style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '10px' }}>
                  {divergedRows.slice(0, 4).map((row) => (
                    <div key={row.fieldKey} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', minWidth: 0 }}>
                      <span style={{ color: 'var(--color-text-muted)', ...clip }}>{row.label}</span>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {displayComparisonValue(row.fieldKey, row.intendedValue) ?? '—'}
                        {' → '}
                        {displayComparisonValue(row.fieldKey, row.reportedValue) ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Aside>

            {/* H — the latest three. Frame 21 owns the full history. */}
            <Aside id="activity" label="Recent activity" refs={sectionRefs}>
              {activity.length === 0 ? (
                <p style={{ ...captionStyle, marginTop: '9px' }}>Nothing has happened to this listing yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', marginTop: '11px' }}>
                  {activity.map((entry) => (
                    <div key={entry.id}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{entry.summary}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-demoted)', marginTop: '2px' }}>
                        {/* A null actor is CORRECT for a channel event: the marketplace acted. */}
                        {[entry.entryKind, entry.actorName ?? 'Channel', formatShortMoment(entry.occurredAt)].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Frame 21 owns the full history; this aside is its entry point. */}
              <Link
                data-testid="detail-view-activity"
                to={`/inventory/products/listings/${item.id}/activity`}
                style={{ ...asideAction, textDecoration: 'none', marginTop: '11px' }}
              >
                View full activity
              </Link>
            </Aside>

            {!item.adapterAvailable && (
              // 🔴 Honest, and scoped: the page stays fully usable without an adapter.
              <div data-testid="listing-no-adapter" style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', background: 'var(--color-strip)', border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-card-small)', padding: '12px 14px', lineHeight: 1.6 }}>
                No marketplace adapter is configured for this channel. Refresh and Push are
                unavailable until one is supplied. Everything on this page is local ERP data and
                remains editable.
              </div>
            )}
          </div>
        </div>
      </div>

      {pushReviewOpen && item && (
        /*
          🔴 THE SAME COMPONENT the workspace row menu opens. One implementation, so the
          outbound boundary cannot drift between two surfaces.

          ⚠ Closing re-reads nothing. A review that changed no state has nothing to refresh,
          and refetching would imply it did.
        */
        <PushReviewModal listingId={item.id} onClose={() => setPushReviewOpen(false)} />
      )}

      {mappingOpen && item && (
        <MappingModal
          listing={item}
          onClose={() => setMappingOpen(false)}
          /*
            ⚠ Re-reads in place. The section updates immediately and the operator keeps their
            position on a long Detail page (§26) — no browser reload, no scroll reset.
          */
          onMapped={() => void load()}
        />
      )}
    </>
  );
}

// -----------------------------------------------------------------------------------------

function Section({
  id,
  label,
  refs,
  action,
  meta,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly refs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  readonly action?: React.ReactNode;
  readonly meta?: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      id={`listing-${id}`}
      data-testid={`detail-section-${id}`}
      ref={(node) => {
        refs.current[id] = node;
      }}
      style={{ border: '1px solid var(--color-border-card)', borderRadius: 'var(--radius-card-small)', background: 'var(--color-surface)', padding: '16px 18px', minWidth: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <h2 style={{ ...columnLabel, margin: 0 }}>{label}</h2>
        {action}
        {meta && <span style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)' }}>{meta}</span>}
      </div>
      <div style={{ marginTop: '12px', minWidth: 0 }}>{children}</div>
    </section>
  );
}

function Aside({
  id,
  label,
  refs,
  emphasis = false,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly refs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  readonly emphasis?: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      id={`listing-${id}`}
      data-testid={`detail-section-${id}`}
      ref={(node) => {
        refs.current[id] = node;
      }}
      style={{
        // 🔴 The ink border marks a real exception, exactly as the workspace uses it.
        border: emphasis ? '1.5px solid var(--color-ink)' : '1px solid var(--color-border-card)',
        borderRadius: 'var(--radius-card-small)',
        background: 'var(--color-surface)',
        padding: '14px 16px',
        minWidth: 0,
      }}
    >
      <h2 style={{ ...columnLabel, margin: 0, color: emphasis ? 'var(--color-heading-ink)' : 'var(--color-text-demoted)', fontWeight: emphasis ? 800 : 700 }}>
        {label}
      </h2>
      {children}
    </section>
  );
}

/**
 * One operational fact.
 *
 * <p>🔴 An absent value is NAMED — "Not published", "Never pushed", "Not set locally" — never
 * collapsed into a bare dash that hides which kind of absence it is.
 */
function Fact({
  label,
  value,
  missing = '—',
  mono = false,
  strong = false,
  note,
}: {
  readonly label: string;
  readonly value: string | null | undefined;
  readonly missing?: string;
  readonly mono?: boolean;
  readonly strong?: boolean;
  readonly note?: string;
}): React.JSX.Element {
  const present = value !== null && value !== undefined && value !== '';
  return (
    <div style={{ minWidth: 0 }}>
      <dt style={{ fontSize: '11px', color: 'var(--color-text-demoted)', fontWeight: 600 }}>{label}</dt>
      <dd
        style={{
          fontSize: '13px',
          fontWeight: strong ? 700 : 600,
          letterSpacing: strong ? '.04em' : undefined,
          margin: '3px 0 0',
          color: present ? 'var(--color-text-primary)' : 'var(--color-text-demoted)',
          fontFamily: mono && present ? 'var(--font-family-mono)' : 'inherit',
          overflowWrap: 'anywhere',
        }}
      >
        {present ? value : missing}
      </dd>
      {note && <div style={{ fontSize: '11px', color: 'var(--color-placeholder)', marginTop: '3px' }}>{note}</div>}
    </div>
  );
}

/** A headline commercial figure, with its reported counterpart beneath when readable. */
function Figure({
  testId,
  label,
  value,
  reported,
  reportedLabel,
  readable,
  emphasis = false,
  suffix,
}: {
  readonly testId: string;
  readonly label: string;
  readonly value: string | null;
  readonly reported: string | null;
  readonly reportedLabel: string;
  readonly readable: boolean;
  readonly emphasis?: boolean;
  readonly suffix?: string;
}): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      style={{
        border: emphasis ? '1.5px solid var(--color-ink)' : '1px solid var(--color-divider-inner)',
        borderRadius: 'var(--radius-control)',
        padding: '12px 14px',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: '11px', color: 'var(--color-text-demoted)', fontWeight: 600 }}>{label}</div>
      <div className="tabular-nums" style={{ fontSize: '19px', fontWeight: 800, marginTop: '4px', color: 'var(--color-heading-ink)' }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--color-placeholder)', marginTop: '4px' }}>
        {/* 🔴 `SYS-034` — unreadable is not zero and not empty. */}
        {readable ? `${reportedLabel} ${reported ?? '—'}` : 'Not readable from this channel'}
      </div>
      {suffix && <div style={{ fontSize: '11px', color: 'var(--color-placeholder)', marginTop: '2px' }}>{suffix}</div>}
    </div>
  );
}

const columnLabel: React.CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: 'var(--color-text-demoted)',
  fontWeight: 700,
};
const clip: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };

/**
 * An attribute cell: one line when the value is short, a CONTAINED scrolling block when the
 * marketplace wrote a paragraph into it.
 *
 * <p>🔴 CONTAINED, NEVER TRUNCATED — the whole value stays reachable, and the row keeps the
 * height its neighbours have.
 */
function attributeCell(value: string | null): React.CSSProperties {
  return isLongProviderText(readableProviderText(value))
    ? { minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '108px', overflowY: 'auto', lineHeight: 1.5 }
    : clip;
}
const captionStyle: React.CSSProperties = { fontSize: '11.5px', color: 'var(--color-text-demoted)', margin: '10px 0 0', lineHeight: 1.6 };
/**
 * ⚠ DEVELOPMENT ONLY — the Frame 16 states a real adapter would produce.
 *
 * <p>🔴 PRESENTATION FIXTURES, NOT DATA. Nothing here is persisted, requested or compared;
 * they exist so the refreshing, completed and failed states can be inspected while no writable
 * adapter exists. Every value is obviously staged and none of it reaches the database.
 */
const DEV_REFRESH_CASES: readonly {
  readonly state: RefreshState;
  readonly result: RefreshResult | null;
  readonly error: string | null;
}[] = [
  { state: 'REFRESHING', result: null, error: null },
  {
    state: 'COMPLETED_NO_CHANGE',
    error: null,
    result: {
      listingId: 'dev', operationId: 'dev', listingTitle: null, channelName: null,
      outcome: 'SUCCEEDED', state: 'COMPLETED_NO_CHANGE', detail: null,
      startedAt: null, completedAt: null, changedDomains: [], manualRequiredDomains: [],
      notReadableFieldCount: 2, divergedFieldCount: 0, unsentLocalChanges: false,
      syncState: 'SYNCED',
    },
  },
  {
    state: 'COMPLETED_CHANGED',
    error: null,
    result: {
      listingId: 'dev', operationId: 'dev', listingTitle: null, channelName: null,
      outcome: 'SUCCEEDED', state: 'COMPLETED_CHANGED', detail: null,
      startedAt: null, completedAt: null,
      changedDomains: ['Sale Price'], manualRequiredDomains: ['Media order'],
      notReadableFieldCount: 3, divergedFieldCount: 1, unsentLocalChanges: true,
      syncState: 'DIVERGED',
    },
  },
  {
    // ⚠ PARTIAL READABILITY — the read SUCCEEDED; some domains simply had no answer.
    //   `SYS-025` — MANUAL_REQUIRED is a normal outcome, never a failure.
    state: 'COMPLETED_CHANGED',
    error: null,
    result: {
      listingId: 'dev', operationId: 'dev', listingTitle: null, channelName: null,
      outcome: 'SUCCEEDED', state: 'COMPLETED_CHANGED', detail: null,
      startedAt: null, completedAt: null,
      changedDomains: ['Title', 'Sale Price'],
      manualRequiredDomains: ['Media order', 'Promotion window'],
      notReadableFieldCount: 4, divergedFieldCount: 0, unsentLocalChanges: false,
      syncState: 'SYNCED',
    },
  },
  {
    state: 'FAILED',
    error: 'The channel did not respond within the allowed time.',
    result: null,
  },
];

/**
 * ⚠ DEVELOPMENT ONLY — the TWO unavailability reasons, shown together.
 *
 * <p>🔴 They are never merged. "No adapter exists" is waiting on Marketplace Integration;
 * "the adapter reports nothing readable" is a DECLARED PROPERTY of that shop's connection
 * (`API-063`, `PRD-125`). Describing the second as the first sends the operator to look for
 * an integration that is already installed.
 */
const DEV_UNAVAILABLE_REASONS: readonly string[] = [
  'Refresh unavailable — No marketplace adapter is configured for this channel.',
  'Refresh unavailable — The marketplace adapter for this channel reports no readable Listing facts.',
];

const headerSecondary: React.CSSProperties = { ...buttonStyle('secondary', 'page-header'), gap: 'var(--space-2)', textDecoration: 'none' };
const headerPrimary: React.CSSProperties = { ...buttonStyle('primary', 'page-header'), gap: 'var(--space-2)', textDecoration: 'none' };
/**
 * 🔴 The SHARED neutral disabled treatment (`buttonStyle` disabled).
 *
 * <p>A disabled action never keeps a fill or elevation that implies it can be pressed; the
 * reason is carried by visible text the control points at, never by a hover tooltip.
 */
const headerDisabled: React.CSSProperties = buttonStyle('secondary', 'page-header', true);
const sectionAction: React.CSSProperties = { ...buttonStyle('secondary', 'row-action'), height: '28px', padding: '0 11px', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' };
const asideAction: React.CSSProperties = { ...buttonStyle('secondary', 'row-action'), height: '30px', width: '100%', justifyContent: 'center', marginTop: '10px', display: 'inline-flex', alignItems: 'center' };
const dashedChip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', height: '20px', padding: '0 8px', border: '1px dashed var(--color-border-secondary-button)', borderRadius: 'var(--radius-control-small)', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.06em', color: 'var(--color-text-secondary)' };

/**
 * What the Promotion Price card says beneath the figure.
 *
 * <p>🔴 `PRD-199.d` — whether a promotion is IN FORCE is decided by the SERVER from the
 * clock and arrives as `promotionActive`. The browser never re-decides it: a client clock is
 * not authority for what a shop is charging.
 *
 * <p>⚠ "Scheduled" and "running" are different facts and are never collapsed — an operator
 * reading "promotion" beside a price needs to know whether customers are paying it today.
 */
function promotionSuffix(item: ChannelListing): string | undefined {
  if (item.promotionPrice === null) {
    return 'no promotion scheduled';
  }
  if (!hasDiscount(item.salePrice, item.promotionPrice)) {
    // ⚠ A promotion equal to the base price is VALID and offers no reduction (`PRD-199.e`).
    return 'no reduction offered';
  }
  const window = item.promotionStartsAt && item.promotionEndsAt
    ? `${formatMoment(item.promotionStartsAt)} – ${formatMoment(item.promotionEndsAt)}`
    : 'window incomplete';
  return item.promotionActive ? `running · ${window}` : `scheduled · ${window}`;
}

/**
 * ⚠ DEVELOPMENT ONLY — the five comparison conditions in one place, for visual verification.
 *
 * <p>🔴 PRESENTATION DATA ONLY, and stripped from a production build. It exists because the
 * five conditions cannot all be produced on one real listing by clicking: DIVERGED and UNSENT
 * are mutually exclusive on the same record by construction (`PRD-185.d`), and NOT_READABLE
 * depends on an adapter that has not read the channel back.
 *
 * <p>🔴 It is deliberately NOT a seed, NOT a request override and NOT a permission override.
 * Every action rendered against it still calls the real API and is still refused by the real
 * backend, because authority is never a property of what the browser is showing.
 *
 * <p>🔴 It is also NOT an adapter: `adapterAvailable` is deliberately absent from
 * {@link DEV_STAGED_FACTS}, so Push stays honestly unavailable and no push is ever simulated.
 *
 * @param mediaCount the number of images the Media panel is actually showing, so the media
 *     row cannot claim a set the rest of the page does not have.
 */
function devComparisonCases(mediaCount: number): readonly ComparisonRow[] {
  const images = `${mediaCount} image${mediaCount === 1 ? '' : 's'}`;
  return [
    {
      fieldKey: 'title', label: 'Title',
      intendedValue: DEV_STAGED_FACTS.intendedTitle,
      reportedValue: DEV_STAGED_FACTS.channelReportedTitle,
      reportedReadable: true, state: 'ALIGNED', resolvable: false,
    },
    {
      fieldKey: 'sale_price', label: 'Sale Price',
      intendedValue: DEV_STAGED_FACTS.salePrice,
      reportedValue: DEV_STAGED_FACTS.reportedSalePrice,
      reportedReadable: true, state: 'DIVERGED', resolvable: true,
    },
    {
      fieldKey: 'attribute:Screen size', label: 'Screen size',
      intendedValue: '22 in', reportedValue: '21.5 in',
      reportedReadable: true, state: 'DIVERGED', resolvable: true,
    },
    {
      fieldKey: 'attribute:Warranty period', label: 'Warranty period',
      // 🔴 `SYS-034` — the reported value is ABSENT, not empty. It is never rendered as a
      // blank, a dash or a zero, and it is never counted as agreement.
      intendedValue: '12 months', reportedValue: null,
      reportedReadable: false, state: 'NOT_READABLE', resolvable: false,
    },
    {
      fieldKey: 'media', label: 'Media order',
      intendedValue: images,
      reportedValue: mediaCount === 0
        ? 'order not reliably readable'
        : `${images} · order not reliably readable`,
      reportedReadable: true, state: 'MANUAL_REQUIRED', resolvable: false,
    },
    {
      fieldKey: 'listing_stock', label: 'Listing stock',
      // 🔴 `PRD-185.d` — the reported value is still correct for the last push. This is an
      // unsent local edit, NOT a divergence, so Accept Marketplace is not offered.
      intendedValue: DEV_STAGED_FACTS.listingStock,
      reportedValue: DEV_STAGED_FACTS.reportedStock,
      reportedReadable: true, state: 'UNSENT', resolvable: false,
    },
  ];
}

/**
 * ⚠ DEVELOPMENT ONLY — the same staged facts as the listing itself carries them.
 *
 * <p>🔴 Every field here is one the comparison fixture stages AND another card on this page
 * renders independently. Without them the Price card reads `reportedSalePriceReadable: false`
 * from the real record and prints "Not readable from this channel" directly above a table
 * saying the same fact DIVERGED — one page making two incompatible claims.
 *
 * <p>🔴 What is NOT staged is as deliberate as what is: no permission, no `adapterAvailable`,
 * no promotion (the fixture stages none, so the real record keeps answering for it), and
 * nothing is written back. This object exists for one render and dies with it.
 */
const DEV_STAGED_FACTS = {
  intendedTitle: 'Hi-Power 22 Inch IPS Monitor',
  channelReportedTitle: 'Hi-Power 22 Inch IPS Monitor',
  reportedTitleReadable: true,
  salePrice: '11200.00',
  reportedSalePrice: '10900.00',
  reportedSalePriceReadable: true,
  listingStock: '31',
  reportedStock: '18',
  reportedStockReadable: true,
  // ⚠ The stock edit has not been sent, which is exactly what the UNSENT row above says.
  hasUnsentLocalChanges: true,
  syncState: 'DIVERGED',
  divergedFactCount: 2,
} as const satisfies Partial<ChannelListing>;

/**
 * A description block: readable, contained, and never the height of the page.
 *
 * <p>🔴 CONTAINED, NEVER TRUNCATED — a long marketplace description scrolls inside its own box
 * so the whole value stays reachable while the section keeps its shape.
 */
function descriptionBlock(value: string | null): React.CSSProperties {
  return {
    fontSize: '12.5px',
    lineHeight: 1.6,
    marginTop: '4px',
    minWidth: 0,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    ...(isLongProviderText(value)
      ? { maxHeight: '150px', overflowY: 'auto', paddingRight: '6px' }
      : null),
  };
}
