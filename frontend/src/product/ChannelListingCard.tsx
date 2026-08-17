import { Link } from 'react-router-dom';
import { ActionMenu } from '../ui/Overlay';
import type { MenuAction } from '../ui/Overlay';
import { formatMoneyForDisplay, hasDiscount } from '../platform/money';
import type { ChannelListing, ChannelListingSummary } from './channelListingApi';
import type { SemanticTone } from '../ui/primitives';
import { SYNC_STATE_ROLE, LISTING_STATUS_ROLE, LOCAL_LIFECYCLE_ROLE, semanticRoleOf } from '../design/semanticRole';

/**
 * FRAME 01 — the populated Listings workspace result composition.
 *
 * <p>🔴 `RULE 3.14.a` — §3.3's five semantic pairs carry ORDER semantics and DO NOT extend to
 * integration or publication states. Frame 01 is entirely MONOCHROME: state is carried by
 * typography, weight and border, never by hue.
 *
 * <p>🔴 `RULE 8.4` — no state is carried by colour alone, which is why every carrier here is
 * a mandatory text label.
 *
 * <p>🔴 `UX-038` — the state dimensions stay INDEPENDENT. Frame 01 separates them by column:
 * mapping lives in the Sellable Product column, the channel-owned status and the integration
 * exception live in the State column. They are never merged into one value.
 */

/** The Frame 01 row grid. The list header and every row share it, so columns line up exactly. */
export const LISTING_GRID = '26px 38px minmax(0, 2.4fr) 1.15fr 1.25fr 0.85fr 0.72fr 128px 30px';
const GRID_GAP = '14px';

/** Frame 01 column-label treatment: uppercase, tracked, demoted. */
const COLUMN_LABEL: React.CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: 'var(--color-text-demoted)',
  fontWeight: 700,
};

const SYNC_META: Record<string, string> = {
  PENDING: 'Sync pending',
  IN_PROGRESS: 'Syncing',
  SYNCED: 'Synced',
  FAILED: 'Sync failed',
  MANUAL_REQUIRED: 'Manual required',
  DIVERGED: 'Diverged',
};

/**
 * Frame 02's quiet sync metadata line — "Synced 40m ago", "Discovered 01 Aug".
 *
 * 🔴 A timestamp is NEVER fabricated. Where the server holds no sync or discovery time the
 * bare state word is shown instead, which says what is known and nothing more.
 */
function syncMeta(item: ChannelListing): string {
  const word = SYNC_META[item.syncState] ?? item.syncState;
  if (item.syncState === 'SYNCED' && item.lastSyncAt) {
    return `Synced ${relativeTime(item.lastSyncAt)}`;
  }
  if (!item.lastSyncAt && item.lastSeenInDiscoveryAt) {
    return `Discovered ${shortDate(item.lastSeenInDiscoveryAt)}`;
  }
  return word;
}

/** ⚠ Display only. Coarse by design — an ERP row states recency, not precision. */
function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) {
    return '';
  }
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
}

function shortDate(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

/**
 * 🔴 `PRD-128` — publication INTENT is Trioloo's own decision and is a different fact from
 * the channel-reported listing status. Frame 02 shows it only when it is NOT the ordinary
 * published intent, so the common case carries no chip at all.
 */
function abnormalPublicationIntent(intent: string | null): string | null {
  if (!intent) {
    return null;
  }
  const normalised = intent.trim().toUpperCase();
  return normalised === 'PUBLISH' || normalised === 'PUBLISHED' ? null : normalised;
}

/**
 * The five ratified summary facts, in the Frame 01 treatment.
 *
 * <p>🔴 Counted by the DATABASE over the authorised filtered set (`UX-044`). The browser never
 * counts a 3000+ corpus (`PRD-174.b`).
 *
 * <p>🔴 `UX-037.g` — no count whose basis is undefined is exposed, which is why there is
 * deliberately no "last sync" or "non-active" tile.
 */
export function ChannelListingSummaryStrip({
  summary,
}: {
  readonly summary: ChannelListingSummary | null;
}): React.JSX.Element {
  const cards = [
    ['total-listings', 'Total Listings', summary?.totalListings],
    ['unmapped-listings', 'Unmapped', summary?.unmappedListings],
    ['diverged-listings', 'Diverged', summary?.divergedListings],
    ['unsent-listings', 'Unsent Local Changes', summary?.unsentChangeListings],
    ['manual-required-listings', 'Manual Required', summary?.manualRequiredListings],
  ] as const;
  return (
    <div
      data-testid="listing-summary-strip"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
        gap: 'var(--space-4)',
        marginTop: 'var(--space-7)',
      }}
    >
      {cards.map(([key, label, value]) => (
        <div
          key={key}
          data-testid={`summary-${key}`}
          style={{
            // Frame 01: a flat WHITE tile on the tinted page ground. The white is what
            // creates the separation, so it must be declared — left unset the tile inherits
            // the app background and the card silently disappears into the page.
            background: 'var(--color-surface)',
            // A hairline border, and NO elevation: the summary strip is not a card stack, and
            // a shadow here would compete with the result rows below it.
            border: '1px solid var(--color-border-card)',
            borderRadius: 'var(--radius-card-small)',
            padding: '12px 14px',
            minWidth: 0,
          }}
        >
          <div style={{ ...COLUMN_LABEL, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: '23px',
              lineHeight: '28px',
              fontWeight: 800,
              letterSpacing: '-.02em',
              color: 'var(--color-heading-ink)',
              marginTop: '5px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {value == null ? '-' : String(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The Frame 01 column header, sharing the row grid so every column aligns. */
export function ChannelListingListHeader({
  allSelected,
  someSelected = false,
  onSelectAllVisible,
}: {
  readonly allSelected: boolean;
  /** 🔴 Frame 04 — the indeterminate state, meaning PART of this page is selected. */
  readonly someSelected?: boolean;
  readonly onSelectAllVisible?: (selected: boolean) => void;
}): React.JSX.Element {
  return (
    <div
      data-testid="listing-list-header"
      style={{
        display: 'grid',
        gridTemplateColumns: LISTING_GRID,
        gap: GRID_GAP,
        alignItems: 'center',
        padding: '12px 14px 9px',
        marginTop: 'var(--space-5)',
        borderBottom: '1px solid var(--color-border-card)',
      }}
    >
      {/*
        🔴 Frame 04 — "Select This Page". Ticking this NEVER extends selection past the
        visible page; reaching every matching Listing is a separate, explicit action.
      */}
      <input
        type="checkbox"
        data-testid="listing-select-all-visible"
        aria-label="Select this page"
        title="Select this page"
        checked={allSelected}
        ref={(node) => {
          if (node) {
            node.indeterminate = !allSelected && someSelected;
          }
        }}
        disabled={!onSelectAllVisible}
        onChange={(event) => onSelectAllVisible?.(event.target.checked)}
        style={checkboxStyle}
      />
      <div />
      <div style={COLUMN_LABEL}>Listing</div>
      <div style={COLUMN_LABEL}>Channel / Shop</div>
      <div style={COLUMN_LABEL}>Sellable Product</div>
      <div style={{ ...COLUMN_LABEL, textAlign: 'right' }}>Price</div>
      <div style={{ ...COLUMN_LABEL, textAlign: 'right' }}>Listing Stock</div>
      <div style={COLUMN_LABEL}>State</div>
      <div />
    </div>
  );
}

/**
 * One Listing row.
 *
 * <p>🔴 A STRUCTURED OPERATIONAL ROW: fixed columns, never wrapping at any zoom, with long
 * values ellipsising inside their own cell. The grid is shared with the list header.
 */
export function ChannelListingCard({
  item,
  selected,
  onSelectChange,
  menuActions,
  menuNote,
}: {
  readonly item: ChannelListing;
  readonly selected?: boolean;
  readonly onSelectChange?: (id: string, selected: boolean) => void;
  /** Frame 05 — the row's own actions. Composed by the workspace, which knows authority. */
  readonly menuActions?: readonly MenuAction[];
  readonly menuNote?: string;
}): React.JSX.Element {
  const identity = item.externalListingId ?? item.id;
  // Frame 01 gives a withdrawn/suspended listing a quieter ground and demoted text — it is
  // retained and readable, never hidden (`PRD-177`).
  const quiet = item.listingStatus === 'SUSPENDED' || item.localLifecycle === 'WITHDRAWN';
  const ink = quiet ? 'var(--color-text-muted)' : 'var(--color-text-primary)';

  return (
    <div
      data-testid={`channel-listing-card-${identity}`}
      className="operational-row"
      style={{
        display: 'grid',
        gridTemplateColumns: LISTING_GRID,
        gap: GRID_GAP,
        alignItems: 'center',
        width: '100%',
        minWidth: 0,
        padding: '11px 14px',
        /*
          🔴 `UX-269` v1.16.0 — THE CONTAINER BORDER IS NEUTRAL, WHATEVER THE RECORD SAYS.
          A row is a container; business state lives in the state carrier inside it. The
          superseded treatment gave a DIVERGED row a 1.5px ink frame, which read as an error
          box around an ordinary record and competed with the DIVERGED chip for the same
          meaning. Superseded: `item.syncState === 'DIVERGED' ? '1.5px solid var(--color-ink)'`.

          🔴 DIVERGED LOSES NOTHING. It remains the strongest carrier in the State column —
          1.5px ink chip boundary, weight 800 — which is where an operator reads state.

          ⚠ SELECTION stays quiet and neutral too: a tinted ground plus the control border.
          Interaction state never outranks the record.
        */
        border: selected
          ? '1px solid var(--color-border-control)'
          : '1px solid var(--color-border-card)',
        borderRadius: 'var(--radius-card-small)',
        background: selected
          ? 'var(--color-strip)'
          : quiet
            ? 'var(--color-strip)'
            : 'var(--color-surface)',
      }}
    >
      <input
        type="checkbox"
        data-testid="listing-select"
        aria-label={`Select listing ${identity}`}
        checked={selected ?? false}
        disabled={!onSelectChange}
        onChange={(event) => onSelectChange?.(item.id, event.target.checked)}
        style={checkboxStyle}
      />

      {/*
        🔴 `RULE 3.15.a` — the 38×38px radius 9px thumbnail at its ratified geometry, and a
        missing image is the plain block. No placeholder illustration, no icon substitute and
        no "no image" text. The thumbnail never controls row height.
      */}
      <div
        data-testid="listing-thumbnail"
        aria-hidden="true"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: 'var(--radius-control)',
          background: 'var(--color-divider-light)',
        }}
      />

      <div style={{ minWidth: 0 }}>
        <Link
          to={`/inventory/products/listings/${item.id}`}
          data-testid="listing-title"
          // ⚠ The single line truncates by design; the full title stays reachable here
          // rather than being allowed to grow the row.
          title={item.intendedTitle || item.channelReportedTitle || 'Untitled listing'}
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 700,
            color: quiet ? 'var(--color-text-muted)' : 'var(--color-heading-ink)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            textDecoration: 'none',
          }}
        >
          {item.intendedTitle || item.channelReportedTitle || 'Untitled listing'}
        </Link>
        {/*
          🔴 `INV-59.2` / `PRD-188.b` — a Listing may legitimately have no channel identifier
          yet. That is said in words rather than left as a blank or faked with the internal id.
        */}
        <div
          data-testid="listing-external-id"
          style={{
            fontSize: '11.5px',
            color: 'var(--color-text-demoted)',
            marginTop: '3px',
            fontFamily: 'var(--font-family-mono)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {[
            item.externalListingId ?? 'Not published',
            item.skuCount > 1 ? `${item.skuCount} orderable SKUs` : item.skus[0]?.channelSku,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>

      <div
        data-testid="listing-channel"
        style={{ fontSize: '12.5px', fontWeight: 600, color: ink, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {item.channelName ?? item.channelInstance}
      </div>

      {/*
        🔴 `PRD-178` / `PRD-190` — mapping is a fact about the ORDERABLE SKU and lives in its
        own column. UNMAPPED is a first-class state shown as a distinct dashed carrier, not one
        more pill in a chain.
      */}
      <div data-testid="listing-sellable" style={{ minWidth: 0 }}>
        {item.skuCount > 1 ? (
          <>
            <div style={{ fontSize: '12.5px', color: ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.mappedSkuCount} of {item.skuCount} SKUs mapped
            </div>
            {item.mappedSkuCount < item.skuCount && (
              <div style={{ fontSize: '11px', color: 'var(--color-placeholder)' }}>
                {item.skuCount - item.mappedSkuCount} unmapped SKU
                {item.skuCount - item.mappedSkuCount === 1 ? '' : 's'}
              </div>
            )}
          </>
        ) : item.mappedSellableSku ? (
          <>
            <div style={{ fontSize: '12.5px', color: ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.sellableName ?? item.mappedSellableSku}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-placeholder)', fontFamily: 'var(--font-family-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.mappedSellableSku}
            </div>
          </>
        ) : (
          <span
            data-testid="listing-unmapped"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: '20px',
              padding: '0 8px',
              border: '1px dashed var(--color-border-secondary-button)',
              borderRadius: 'var(--radius-control-small)',
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '.06em',
              color: 'var(--color-text-secondary)',
            }}
          >
            UNMAPPED
          </span>
        )}
      </div>

      {/*
        🔴 `TEC-015` — money arrives as a STRING and stays one. The formatter below is
        DISPLAY ONLY: it groups digits and adds the symbol by string manipulation and never
        parses the amount into a JavaScript number.
      */}
      <div data-testid="listing-price" className="tabular-nums" style={{ fontSize: '12.5px', fontWeight: 600, textAlign: 'right', color: ink }}>
        {/*
          🔴 PRD-197 - TWO prices in the compact Frame 01 geometry.

          SALE PRICE is primary: it is what the customer actually pays, so it keeps the full
          type size and weight. What it was reduced from is the secondary line beneath it,
          labelled so it can never be misread as the selling price.

          🔴 PRD-199.d - the workspace shows the EFFECTIVE selling price: what a customer
          would pay right now. The server derives it from the clock, so the browser never
          decides whether a promotion is running.

          🔴 Where the promotion is NOT a reduction, no reference line is drawn. Repeating
          the same figure twice would imply a saving that is not being offered.
        */}
        <div data-testid="listing-sale-price">
          {formatMoneyForDisplay(item.effectiveSellingPrice ?? item.salePrice) ?? '-'}
        </div>
        {/*
          ONE sub-line carries every qualifier, so the price cell never becomes the reason a
          row grows. "from" says the figure is the lowest across orderable SKUs (Frame 02 F);
          the base price says what an ACTIVE promotion is reduced from; "promo scheduled" says
          a promotion exists but is NOT yet in force, which is a different fact from a
          discount being live.
        */}
        {(item.priceIsFrom || item.promotionActive || item.promotionPrice !== null) && (
          <div
            data-testid="listing-price-note"
            style={{ fontSize: '10.5px', color: 'var(--color-placeholder)', fontWeight: 500, whiteSpace: 'nowrap' }}
          >
            {[
              item.priceIsFrom ? 'from' : null,
              item.promotionActive && hasDiscount(item.salePrice, item.promotionPrice)
                ? `was ${formatMoneyForDisplay(item.salePrice)}`
                : null,
              !item.promotionActive && item.promotionPrice !== null ? 'promo scheduled' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        )}
      </div>

      <div data-testid="listing-published-stock" className="tabular-nums" style={{ fontSize: '12.5px', fontWeight: 600, textAlign: 'right', color: ink }}>
        {item.listingStock ?? '-'}
      </div>

      <StateCell item={item} quiet={quiet} />

      {/*
        Frame 01 anchors the row action as a single menu affordance rather than a standalone
        button. ⚠ The full row menu and its permission matrix are FRAME 05; until then this
        affordance preserves the existing navigation to the Listing.
      */}
      {/*
        🔴 Frame 02 / Frame 05 — "Row actions live in the anchored ⋯ menu. The card carries
        no buttons." The workspace composes the action list, because it is the layer that
        knows the operator's authority; the card only renders the affordance.
      */}
      {menuActions && menuActions.length > 0 ? (
        <ActionMenu
          trigger="glyph"
          label={`Actions for listing ${identity}`}
          triggerAriaLabel={`Actions for listing ${identity}`}
          triggerTestId="listing-menu-trigger"
          testId="listing-menu"
          menuWidth="204px"
          actions={menuActions}
          note={menuNote}
        />
      ) : (
        <Link
          to={`/inventory/products/listings/${item.id}`}
          data-testid="listing-view"
          aria-label={`Open listing ${identity}`}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', justifySelf: 'end', width: '26px', height: '26px', borderRadius: 'var(--radius-control-small)', color: 'var(--color-placeholder)', fontWeight: 700, fontSize: '15px', textDecoration: 'none', lineHeight: 1 }}
        >
          ⋯
        </Link>
      )}
    </div>
  );
}

/**
 * The State column, in the Frame 01 hierarchy.
 *
 * <p>🔴 NOT a chain of equal pills. The channel-owned status is a plain tracked label; an
 * ordinary integration position is a QUIET meta line; only an EXCEPTION earns a carrier, and
 * the three exceptions are weighted differently from one another:
 *
 * <ul>
 *   <li>{@code DIVERGED} — always an exception (`SYS-026`), so it takes the heaviest carrier.
 *   <li>{@code UNSENT CHANGES} — a local fact the operator owns, filled but light.
 *   <li>{@code MANUAL REQUIRED} — a NORMAL state (`SYS-025`), so it is the lightest carrier
 *       and must never read as a failure.
 * </ul>
 *
 * <p>🔴 All monochrome. `UX-038` — these remain independent facts and are stacked, never
 * combined into a single merged verdict.
 */
/**
 * The State column, in the Frame 02 hierarchy.
 *
 * <p>🔴 FOUR INDEPENDENT DIMENSIONS, NEVER FOUR EQUAL BADGES. Frame 02 separates them by
 * placement, typography and carrier weight:
 *
 * <ol>
 *   <li><b>Listing status</b> — uppercase caps, NO container. Always present.
 *   <li><b>Sync state</b> — quiet metadata beneath the status. Never a badge.
 *   <li><b>Publication intent</b> — a filled quiet chip, and only when it is not the
 *       ordinary published intent ({@code PRD-128}).
 *   <li><b>Unsent local changes</b> — solid grey fill with a leading dot.
 * </ol>
 *
 * <p>🔴 AT MOST ONE EXCEPTION CHIP, and {@code DIVERGED} outranks {@code MANUAL REQUIRED}.
 * {@code DIVERGED} is the strongest carrier — 1.5px ink outline at weight 800 — while
 * {@code MANUAL REQUIRED} stays a light outline, because it is a NORMAL operational
 * condition ({@code SYS-025}) and must never read as an alarm.
 *
 * <p>🔴 All monochrome. `RULE 8.4` — every carrier keeps a mandatory text label.
 */
function StateCell({ item, quiet }: { readonly item: ChannelListing; readonly quiet: boolean }): React.JSX.Element {
  // 🔴 syncState is ONE enum value, so DIVERGED and MANUAL_REQUIRED can never both be true.
  // The exception is therefore always a single chip, exactly as Frame 02 requires.
  const exception =
    item.syncState === 'DIVERGED' ? (
      <span
        data-testid="listing-state-diverged"
        title="Diverged — the channel holds a different value"
        style={{ ...chipBase, ...semanticChip('DIVERGED'), fontWeight: 800 }}
      >
        {item.divergedFactCount > 0 ? `DIVERGED · ${item.divergedFactCount}` : 'DIVERGED'}
      </span>
    ) : item.syncState === 'MANUAL_REQUIRED' ? (
      <span
        data-testid="listing-state-manual"
        title="Manual required — a person must look at this. It is a normal operational state, not a failure."
        style={{ ...chipBase, ...semanticChip('MANUAL_REQUIRED') }}
      >
        MANUAL REQUIRED
      </span>
    ) : null;

  const intent = abnormalPublicationIntent(item.publicationIntent);

  /*
    🔴 THE ONE PLACE TWO FRAME 02 RULES MEET.

    Frame 02 states both that UNSENT CHANGES renders BELOW the exception chip, and that row
    height is FIXED at 62px regardless of chips. Status + exception + a full-width unsent
    chip is three stacked lines, which cannot fit the 38px the compact row allows.

    ⚠ Height is the harder lock and the one §7 restates, so where the two coexist the unsent
    fact moves up beside the status as a compact dot marker rather than being dropped. It
    keeps its own carrier, its own dot and its full wording in the tooltip, so nothing is
    merged and nothing is hidden. With no exception it takes the full Frame 02 chip on line
    two exactly as drawn.
  */
  const unsentInline = item.hasUnsentLocalChanges && exception !== null;

  return (
    <div
      data-testid="listing-state"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '4px',
        minWidth: 0,
        // 🔴 Matches the thumbnail, which sets the compact row height. The State cell can
        // therefore never be the reason one row is taller than its neighbours.
        height: '38px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
        {/*
          Line one — the CHANNEL-owned status in caps with no container. Where the channel
          has reported none, an ERP-first draft shows its own lifecycle rather than leaving a
          blank that would read as "the channel says nothing is wrong".
        */}
        <span
          data-testid="listing-status"
          style={{
            fontSize: '10.5px',
            fontWeight: 700,
            letterSpacing: '.06em',
            whiteSpace: 'nowrap',
            /*
              🔴 `RULE 3.3.d.a` — the CHANNEL-REPORTED status carries real consequence: ACTIVE
              is live, SUSPENDED needs attention, REJECTED is a refusal. Where the channel has
              said nothing the LOCAL lifecycle shows instead, and DRAFT stays neutral because
              `PRD-188.a` makes a local draft legitimate rather than unfinished.

              🔴 FOREGROUND ONLY. Frame 02 renders this as BARE CAPS WITH NO CONTAINER, and
              that is locked geometry — a semantic tint here would change the form, not the
              tone. The role is carried by the text colour alone, and the WORD is already
              mandatory (`RULE 8.4`).

              ⚠ `quiet` still demotes, but only where the state is NEUTRAL: a SUSPENDED row
              must not be greyed out of the attention it is asking for.
            */
            color: statusColor(item, quiet),
          }}
        >
          {item.listingStatus ?? item.localLifecycle}
        </span>
        {intent && (
          <span data-testid="listing-publication-intent" title={`Publication intent: ${intent}`} style={{ ...chipBase, border: '1px solid var(--color-border-control)', background: 'var(--color-strip)', color: 'var(--color-text-secondary)' }}>
            {intent}
          </span>
        )}
        {unsentInline && <UnsentCarrier compact />}
      </div>

      {/* Line two — the single exception chip, the unsent chip, or quiet sync metadata. */}
      {exception ?? (item.hasUnsentLocalChanges ? (
        <UnsentCarrier />
      ) : (
        <span data-testid="listing-sync-state" style={{ fontSize: '11px', color: 'var(--color-placeholder)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {syncMeta(item)}
        </span>
      ))}
    </div>
  );
}

/**
 * 🔴 `PRD-185.d` — unsent local changes is Trioloo's OWN pending fact and is visually
 * distinct from both the channel status and the exception carrier. The dot marks it; the
 * word keeps it a text label rather than colour or a glyph alone (`RULE 8.4`).
 */
function UnsentCarrier({ compact = false }: { readonly compact?: boolean }): React.JSX.Element {
  return (
    <span
      data-testid="listing-unsent"
      title="Unsent local changes — edited in the ERP and not yet sent to the channel"
      style={{
        ...chipBase,
        height: compact ? '16px' : '19px',
        padding: compact ? '0 6px' : '0 7px',
        fontSize: compact ? '9.5px' : '10px',
        gap: compact ? '4px' : '5px',
        background: 'var(--color-divider-light)',
        color: 'var(--color-text-primary)',
      }}
    >
      <span aria-hidden="true" style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-ink)' }} />
      {compact ? 'UNSENT' : 'UNSENT CHANGES'}
    </span>
  );
}

/**
 * The status word's colour — `RULE 3.3.d.a` inside Frame 02's locked bare-caps form.
 *
 * 🔴 No background and no border: the role is carried by the foreground, because giving this
 * element a container would change locked geometry rather than semantics.
 */
function statusColor(item: ChannelListing, quiet: boolean): string {
  const tone = item.listingStatus
    ? semanticRoleOf(LISTING_STATUS_ROLE, item.listingStatus)
    : semanticRoleOf(LOCAL_LIFECYCLE_ROLE, item.localLifecycle);
  if (tone === 'neutral') {
    return quiet ? 'var(--color-text-demoted)' : 'var(--color-text-secondary)';
  }
  return `var(--color-semantic-${tone}-fg)`;
}

/**
 * The shared semantic chip surface — `RULE 3.3.d`.
 *
 * 🔴 The ROLE comes from the one canonical mapping source, never from this component. A soft
 * tint, a 1px semantic boundary and semantic text; the WORD stays mandatory (`RULE 8.4`).
 */
function semanticChip(state: string, map: Record<string, SemanticTone> = SYNC_STATE_ROLE): React.CSSProperties {
  const tone = semanticRoleOf(map, state);
  return {
    background: `var(--color-semantic-${tone}-bg)`,
    border: `1px solid var(--color-semantic-${tone}-border)`,
    color: `var(--color-semantic-${tone}-fg)`,
  };
}

const chipBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '19px',
  padding: '0 7px',
  borderRadius: '5px',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '.05em',
  width: 'fit-content',
  whiteSpace: 'nowrap',
};

const checkboxStyle: React.CSSProperties = {
  width: '15px',
  height: '15px',
  accentColor: 'var(--color-ink)',
  margin: 0,
};
