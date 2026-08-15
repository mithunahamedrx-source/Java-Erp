import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../ui/Overlay';
import { buttonStyle } from '../ui/primitives';
import { fetchMappingSuggestions, mapSku, unmapSku } from './channelListingApi';
import type { ChannelListing, ChannelListingSku, MappingSuggestion } from './channelListingApi';
import { listSellableProducts } from './sellableProductApi';
import type { SellableProduct } from './sellableProductApi';

/**
 * FRAME 12 — the Mapping modal, and the ONLY surface that changes a mapping.
 *
 * <p>🔴 `INV-106.2` / `PRD-190` — THE MAPPING UNIT IS THE ORDERABLE CHANNEL SKU (`E-106`),
 * never the listing. A variation listing holds one mapping per SKU and each is confirmed on
 * its own; nothing here ever fans one choice across siblings, and nothing touches another
 * shop's listings (`PRD-187`).
 *
 * <p>🔴 `PRD-179` — SUGGESTION IS NOT AUTHORITY. Nothing is mapped by opening this modal, by
 * a search result appearing, or by selecting one. Only the explicit footer confirmation maps.
 *
 * <p>🔴 `PRD-185` — MAPPING IS LOCAL. Confirming writes an ERP relationship and stops: it does
 * not push, publish, refresh, sync, or contact the marketplace, and it needs no adapter.
 */

/**
 * The three facts the modal needs to name a chosen product.
 *
 * ⚠ Deliberately NOT a `SellableProduct`: a suggestion carries only identity, and widening a
 * partial object into the full record with a cast would be a lie the compiler stops catching.
 */
type Chosen = {
  readonly id: string;
  readonly sellableSku: string;
  readonly name: string;
};

/** Which SKU the operator is resolving, and what it currently points at. */
type Target = {
  readonly sku: ChannelListingSku;
  readonly selected: Chosen | null;
  /** ⚠ An explicit intent to CLEAR, distinct from "nothing chosen yet". */
  readonly clearing: boolean;
};

export function MappingModal({
  listing,
  onClose,
  onMapped,
}: {
  readonly listing: ChannelListing;
  readonly onClose: () => void;
  /** Fires after at least one mapping actually persisted, so the caller can re-read. */
  readonly onMapped: () => void;
}): React.JSX.Element {
  const navigate = useNavigate();
  /*
    ⚠ A listing ALWAYS has at least one orderable SKU (`INV-106.1`), but a list payload need
    not carry them. Reading defensively keeps a summary-shaped record from crashing the modal;
    the empty case is then stated honestly below rather than rendered as a dead form.
  */
  const skus = listing.skus ?? [];
  const multi = skus.length > 1;

  /*
    🔴 THE MODAL OWNS ITS OWN COPY OF WHAT IS BEING DECIDED. It is seeded from the listing
    ONCE: re-seeding on every render would discard a selection the moment anything upstream
    re-read, which is precisely when an operator is mid-decision.
  */
  const [targets, setTargets] = useState<readonly Target[]>(() =>
    skus.map((sku) => ({ sku, selected: null, clearing: false })),
  );
  const [activeSkuId, setActiveSkuId] = useState<string>(skus[0]?.id ?? '');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<readonly SellableProduct[]>([]);
  const [suggestions, setSuggestions] = useState<readonly MappingSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const active = targets.find((t) => t.sku.id === activeSkuId) ?? targets[0];

  // ⚠ Focus lands on search: on a catalogue of any size, finding is the first act.
  useEffect(() => { searchRef.current?.focus(); }, []);

  /*
    🔴 `PRD-179.a` — DETERMINISTIC EVIDENCE ONLY, fetched per SKU because the evidence is the
    SKU's own Seller SKU. Advice is read; it is never applied.
  */
  useEffect(() => {
    if (!active) return;
    let live = true;
    setSuggestions([]);
    fetchMappingSuggestions(active.sku.id)
      .then((found) => { if (live) setSuggestions(found); })
      // ⚠ Advice failing is not the operation failing. Search still works.
      .catch(() => { if (live) setSuggestions([]); });
    return () => { live = false; };
  }, [active?.sku.id]);

  /*
    🔴 SERVER-BACKED AND PAGE-BOUNDED (`PRD-174.b`). The catalogue may be large, so the browser
    asks for one small page and never holds the corpus.
  */
  const search = useCallback(async (value: string): Promise<void> => {
    setSearching(true);
    try {
      const page = await listSellableProducts(
        { search: value.trim() || undefined, status: 'ACTIVE' }, 0, 6, 'name', 'ASC',
      );
      // ⚠ A response without a content array is an EMPTY result, never a crash.
      setResults(page.content ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => { void search(''); }, [search]);

  const setTarget = (skuId: string, patch: Partial<Target>): void =>
    setTargets((current) => current.map((t) => (t.sku.id === skuId ? { ...t, ...patch } : t)));

  /** Every SKU the operator has actually decided something about. */
  const pending = useMemo(
    () => targets.filter((t) => t.selected !== null || t.clearing),
    [targets],
  );

  /**
   * 🔴 EACH SKU IS ITS OWN OPERATION, in the operator's own order, with its own version
   * (`PRD-186`-style per-record results). One SKU failing must not silently undo another that
   * already succeeded, so the loop stops at the failure and reports what did land.
   */
  const confirm = async (): Promise<void> => {
    if (pending.length === 0) return;
    setBusy(true);
    setFailure(null);
    let done = 0;
    try {
      for (const target of pending) {
        if (target.clearing) {
          await unmapSku(target.sku.id, null);
        } else if (target.selected) {
          await mapSku(target.sku.id, target.selected.sellableSku, null);
        }
        done += 1;
      }
      onMapped();
      onClose();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The mapping could not be saved.';
      /*
        🔴 THE MODAL STAYS OPEN AND THE SELECTION SURVIVES. Clearing it would make the operator
        find the product again to retry the thing that just failed.

        ⚠ A partial result is stated rather than hidden — `done` mappings really did persist.
      */
      setFailure(done > 0
        ? `${done} of ${pending.length} mappings saved. The next one failed: ${message}`
        : message);
      if (done > 0) onMapped();
    } finally {
      setBusy(false);
    }
  };

  const currentOf = (sku: ChannelListingSku): string | null => sku.sellableSku;

  /** The Design's context line: what is being mapped, in operator terms, never a UUID. */
  const context = [
    active?.sku.channelSku,
    listing.externalListingId,
    listing.channelName ?? listing.channelInstance,
  ].filter(Boolean).join(' · ');

  const anyMapped = listing.mappedSkuCount > 0;
  const title = multi
    ? 'Map channel SKUs'
    : anyMapped ? 'Change mapping' : 'Map to Sellable Product';
  const confirmLabel = multi
    ? 'Save mappings'
    : pending[0]?.clearing ? 'Remove mapping'
      : anyMapped ? 'Change mapping' : 'Confirm mapping';

  return (
    <ConfirmDialog
      testId="mapping-modal"
      width="720px"
      title={title}
      consequence="Mapping links this channel SKU to ERP master data. It does not change anything on the marketplace."
      confirmLabel={confirmLabel}
      busy={busy}
      error={failure}
      onCancel={onClose}
      onConfirm={() => void confirm()}
      footerLead={
        /*
          🔴 `PRD-180` — CREATING A SELLABLE PRODUCT IS AN EXPLICIT, SEPARATE ACT, and a
          Products act at that (`PRD-196.c`). It is offered as a way OUT of this decision,
          never as a consequence of finding nothing.

          🔴 `PRD-180.b` / §23 — leaving here creates nothing and maps nothing. The operator
          returns and confirms a mapping themselves.
        */
        <button
          type="button"
          data-testid="mapping-create-sellable"
          disabled={busy}
          onClick={() => navigate('/inventory/products/sellable/new')}
          style={linkAction}
        >
          Create Sellable Product instead
        </button>
      }
    >
      <div style={{ marginTop: '14px' }}>
        {targets.length === 0 && (
          /*
            🔴 NOTHING TO MAP IS SAID, NOT SHOWN AS AN EMPTY FORM. Mapping attaches to an
            orderable SKU (`INV-106.2`); with none loaded there is no unit to attach to, and a
            search box here would invite a choice that could not be saved.
          */
          <div data-testid="mapping-no-skus" style={emptyState}>
            <div style={{ fontWeight: 700, color: 'var(--color-heading-ink)' }}>
              No orderable channel SKU is loaded
            </div>
            <div style={{ marginTop: '4px' }}>
              Mapping attaches to an orderable SKU. Open the Listing to see its SKUs.
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------- context */}
        <div data-testid="mapping-context" style={contextStrip}>
          <div aria-hidden="true" style={thumb} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-heading-ink)', overflowWrap: 'anywhere' }}>
              {listing.intendedTitle ?? listing.channelReportedTitle ?? 'Untitled listing'}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', marginTop: '2px', fontFamily: 'var(--font-family-mono)', overflowWrap: 'anywhere' }}>
              {context || (listing.channelName ?? listing.channelInstance)}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------- which SKU (multi only) */}
        {multi && (
          <div data-testid="mapping-sku-list" style={{ marginTop: '14px' }}>
            <div style={sectionLabel}>Orderable channel SKUs</div>
            {/*
              🔴 ONE ROW PER SKU, EACH DECIDED SEPARATELY (`INV-106.2`). Selecting a row only
              chooses which SKU the search below is resolving — it maps nothing.
            */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {targets.map((target) => {
                const isActive = target.sku.id === activeSkuId;
                const current = currentOf(target.sku);
                return (
                  <button
                    key={target.sku.id}
                    type="button"
                    data-testid={`mapping-sku-${target.sku.id}`}
                    aria-pressed={isActive}
                    onClick={() => setActiveSkuId(target.sku.id)}
                    style={{ ...skuRow, borderColor: isActive ? 'var(--color-ink)' : 'var(--color-divider-inner)', borderWidth: isActive ? '1.5px' : '1px' }}
                  >
                    <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '12px', fontWeight: 700, minWidth: 0, overflowWrap: 'anywhere' }}>
                      {target.sku.channelSku ?? 'No Seller SKU'}
                    </span>
                    <span style={{ flex: 1 }} />
                    {target.clearing ? (
                      <span data-testid={`mapping-sku-pending-${target.sku.id}`} style={pendingChip}>
                        will be unmapped
                      </span>
                    ) : target.selected ? (
                      <span data-testid={`mapping-sku-pending-${target.sku.id}`} style={pendingChip}>
                        → {target.selected.sellableSku}
                      </span>
                    ) : current ? (
                      <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family-mono)' }}>
                        {current}
                      </span>
                    ) : (
                      <span style={dashedChip}>UNMAPPED</span>
                    )}
                  </button>
                );
              })}
            </div>
            <p style={note}>
              Each SKU is mapped on its own. Confirming saves only the SKUs you changed — the
              others keep exactly the mapping they have.
            </p>
          </div>
        )}

        {/* ------------------------------------------------------- current mapping */}
        {active && currentOf(active.sku) && (
          <div data-testid="mapping-current" style={{ marginTop: '14px' }}>
            <div style={sectionLabel}>Currently mapped to</div>
            <div style={{ ...resultRow, marginTop: '8px', cursor: 'default' }}>
              <div aria-hidden="true" style={smallThumb} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {active.sku.sellableName ?? active.sku.sellableSku}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-demoted)', fontFamily: 'var(--font-family-mono)' }}>
                  {active.sku.sellableSku}
                </div>
              </div>
              {/*
                🔴 UNMAP IS CANONICAL and is an INTENTION, not a click. It is staged like any
                other change and takes effect only at the footer confirmation.
              */}
              <button
                type="button"
                data-testid="mapping-remove"
                disabled={busy}
                onClick={() => setTarget(active.sku.id, { clearing: !active.clearing, selected: null })}
                style={linkAction}
              >
                {active.clearing ? 'Keep mapping' : 'Remove mapping'}
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- search */}
        <div style={{ marginTop: '14px' }}>
          <label htmlFor="mapping-search" style={sectionLabel}>Find a Sellable Product</label>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input
              id="mapping-search"
              ref={searchRef}
              data-testid="mapping-search"
              value={term}
              placeholder="Name or Sellable SKU"
              disabled={busy}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void search(term);
                }
              }}
              style={control}
            />
            <button
              type="button"
              data-testid="mapping-search-run"
              disabled={busy}
              onClick={() => void search(term)}
              style={{ ...buttonStyle('secondary', 'row-action'), flexShrink: 0 }}
            >
              Search
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------- suggestions */}
        {suggestions.length > 0 && (
          <div data-testid="mapping-suggestions" style={{ marginTop: '14px' }}>
            <div style={sectionLabel}>Suggested matches</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '8px' }}>
              {suggestions.map((suggestion) => (
                <SuggestionRow
                  key={suggestion.sellableProductId}
                  suggestion={suggestion}
                  chosen={active?.selected?.sellableSku === suggestion.sellableSku}
                  disabled={busy}
                  onChoose={() => {
                    if (!active) return;
                    // ⚠ Selecting stages a decision. It does not save one.
                    setTarget(active.sku.id, {
                      selected: {
                        id: suggestion.sellableProductId,
                        sellableSku: suggestion.sellableSku,
                        name: suggestion.sellableName,
                      },
                      clearing: false,
                    });
                  }}
                />
              ))}
            </div>
            {/* 🔴 `PRD-179.b`/`.d` — the honest description of what a suggestion is worth. */}
            <p style={note}>
              Suggestions come from an exact Seller SKU match only. Trioloo never maps
              automatically and never maps on a similar name.
            </p>
          </div>
        )}

        {/* --------------------------------------------------------------- results */}
        <div style={{ marginTop: '14px' }}>
          <div style={sectionLabel}>{searching ? 'Searching…' : 'Sellable Products'}</div>
          {results.length === 0 && !searching ? (
            /*
              ⚠ EMPTY IS AN ANSWER, NOT A PROMPT TO CREATE. `PRD-180.a` — creating is an act
              the operator chooses from the footer, never a consequence of a search missing.
            */
            <div data-testid="mapping-no-results" style={{ ...emptyState, marginTop: '8px' }}>
              <div style={{ fontWeight: 700, color: 'var(--color-heading-ink)' }}>
                No Sellable Products found
              </div>
              <div style={{ marginTop: '4px' }}>Try another name or Sellable SKU.</div>
            </div>
          ) : (
            <div data-testid="mapping-results" style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '8px' }}>
              {results.map((product, index) => (
                <ResultRow
                  key={product.id}
                  product={product}
                  index={index}
                  chosen={active?.selected?.id === product.id}
                  disabled={busy}
                  onChoose={() => {
                    if (!active) return;
                    setTarget(active.sku.id, {
                      selected: { id: product.id, sellableSku: product.sellableSku, name: product.name },
                      clearing: false,
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* -------------------------------------------------------------- selected */}
        {active?.selected && (
          <div data-testid="mapping-selected" style={selectedPanel}>
            <div style={sectionLabel}>Selected</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
              <div aria-hidden="true" style={smallThumb} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {active.selected.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-demoted)', fontFamily: 'var(--font-family-mono)' }}>
                  {active.selected.sellableSku}
                </div>
              </div>
              <button
                type="button"
                data-testid="mapping-clear"
                disabled={busy}
                onClick={() => setTarget(active.sku.id, { selected: null })}
                style={linkAction}
              >
                Clear
              </button>
            </div>
            {/*
              🔴 THE REAL CONSEQUENCE, AND ONLY THE REAL ONE (`PRD-185`, `PRD-187`). Naming
              what a mapping does NOT do is the point: an operator who believes this reaches
              the marketplace will not use it.
            */}
            <p style={{ ...note, marginTop: '10px' }}>
              {active.sku.channelSku ?? 'This channel SKU'} will draw its ERP Product context
              from {active.selected.sellableSku}. Nothing is sent to
              {' '}{listing.channelName ?? 'the channel'}, the Sellable Product is unchanged,
              stock is unchanged, and no other SKU or shop is affected.
            </p>
          </div>
        )}

        {active?.clearing && (
          <div data-testid="mapping-remove-consequence" style={selectedPanel}>
            <div style={sectionLabel}>Removing the mapping</div>
            <p style={{ ...note, marginTop: '6px' }}>
              {active.sku.channelSku ?? 'This channel SKU'} returns to UNMAPPED. That is a valid
              state, not an error — but ERP Product values cannot be pushed until it is mapped
              again. Nothing is deleted on the marketplace.
            </p>
          </div>
        )}
      </div>
    </ConfirmDialog>
  );
}

/** ⚠ Advisory, and visibly so: the evidence is stated in words beside the row. */
function SuggestionRow({
  suggestion, chosen, disabled, onChoose,
}: {
  readonly suggestion: MappingSuggestion;
  readonly chosen: boolean;
  readonly disabled: boolean;
  readonly onChoose: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      data-testid={`mapping-suggestion-${suggestion.sellableSku}`}
      disabled={disabled}
      onClick={onChoose}
      style={{ ...resultRow, borderColor: chosen ? 'var(--color-ink)' : 'var(--color-divider-inner)', borderWidth: chosen ? '1.5px' : '1px' }}
    >
      <Radio checked={chosen} />
      <div aria-hidden="true" style={smallThumb} />
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 700, overflowWrap: 'anywhere' }}>
          {suggestion.sellableName}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-demoted)', fontFamily: 'var(--font-family-mono)' }}>
          {suggestion.sellableSku}
        </div>
      </div>
      <span style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', fontWeight: 600, flexShrink: 0 }}>
        {suggestion.basis}
      </span>
    </button>
  );
}

/** ⚠ A compact operational row. Identity enough to not map the wrong product. */
function ResultRow({
  product, index, chosen, disabled, onChoose,
}: {
  readonly product: SellableProduct;
  readonly index: number;
  readonly chosen: boolean;
  readonly disabled: boolean;
  readonly onChoose: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      data-testid={`mapping-result-${index}`}
      disabled={disabled}
      onClick={onChoose}
      style={{ ...resultRow, borderColor: chosen ? 'var(--color-ink)' : 'var(--color-divider-inner)', borderWidth: chosen ? '1.5px' : '1px' }}
    >
      <Radio checked={chosen} />
      <div aria-hidden="true" style={smallThumb} />
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 700, overflowWrap: 'anywhere' }}>
          {product.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-demoted)', fontFamily: 'var(--font-family-mono)' }}>
          {product.sellableSku}
        </div>
      </div>
      {/* ⚠ Nature is real, canonical identity — not a decorative badge. */}
      <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '.05em', color: 'var(--color-text-demoted)', flexShrink: 0 }}>
        {product.nature}
      </span>
    </button>
  );
}

function Radio({ checked }: { readonly checked: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      style={{
        width: '15px',
        height: '15px',
        borderRadius: '50%',
        flexShrink: 0,
        border: checked ? '4.5px solid var(--color-ink)' : '1.5px solid var(--color-border-control)',
      }}
    />
  );
}

const sectionLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '10.5px',
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: 'var(--color-text-demoted)',
  fontWeight: 700,
};

const note: React.CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
  lineHeight: 1.6,
  margin: '9px 0 0',
};

const contextStrip: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  border: '1px solid var(--color-divider-inner)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-strip)',
  padding: '11px 13px',
};

const resultRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '11px',
  width: '100%',
  border: '1px solid var(--color-divider-inner)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-surface)',
  padding: '10px 12px',
  font: 'inherit',
  cursor: 'pointer',
  minWidth: 0,
};

const skuRow: React.CSSProperties = {
  ...resultRow,
  padding: '9px 12px',
};

const selectedPanel: React.CSSProperties = {
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-strip)',
  padding: '12px 14px',
  marginTop: '14px',
};

const emptyState: React.CSSProperties = {
  border: '1px dashed var(--color-border-secondary-button)',
  borderRadius: 'var(--radius-control)',
  padding: '18px 14px',
  textAlign: 'center',
  fontSize: '12px',
  color: 'var(--color-text-secondary)',
};

const dashedChip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: '20px',
  padding: '0 8px',
  border: '1px dashed var(--color-border-secondary-button)',
  borderRadius: 'var(--radius-control-small)',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '.05em',
  color: 'var(--color-text-secondary)',
  flexShrink: 0,
};

const pendingChip: React.CSSProperties = {
  ...dashedChip,
  border: '1px solid var(--color-ink)',
  color: 'var(--color-ink)',
  fontFamily: 'var(--font-family-mono)',
};

const control: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 'var(--control-height-form)',
  borderRadius: 'var(--radius-control-small)',
  border: '1px solid var(--color-border-form-control)',
  padding: '0 11px',
  fontSize: '12.5px',
  fontFamily: 'inherit',
  background: 'var(--color-surface)',
};

const linkAction: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  cursor: 'pointer',
  flexShrink: 0,
};

const thumb: React.CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-divider-light)',
  flexShrink: 0,
};

const smallThumb: React.CSSProperties = { ...thumb, width: '32px', height: '32px' };
