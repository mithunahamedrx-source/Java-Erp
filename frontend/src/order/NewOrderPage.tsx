import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Button, Select } from '../ui/primitives';
import { apiRequest } from '../platform/api';
import { fetchChannelOrderSummary } from './orderApi';
import type { ChannelOrderSummary } from './orderApi';
import { listChannelListings } from '../product/channelListingApi';
import type { ChannelListing } from '../product/channelListingApi';
import { formatMoneyForDisplay } from '../platform/money';

/**
 * Manual order capture — `PRM-093`, `OM §22`.
 *
 * <p>🔴 IT IS A PAGE AND NOT A MODAL, AND THAT IS THE RULE RATHER THAN A PREFERENCE. `UX-151` —
 * *"a workflow needing more than a bounded decision gets a PAGE, not a modal"*. Capturing a
 * customer, an address, and any number of priced lines is not a bounded decision. ⚠ The legacy
 * system's New Sale MODAL is what `GAP-035` and `GAP-023` describe, and both are open BECAUSE of
 * what it compresses.
 *
 * <p>🔴 THE ORDER ENDS AT `PENDING_VERIFICATION` AND STOPS, AND THE STATE SELECTOR IS THEREFORE
 * NOT OFFERED. `PRM-093.b` — creation is not confirmation. The prototype's *"the state it will be
 * created in"* control offers `Confirmed`, `Released`, `Ready to ship` and `On hold`, and its own
 * consequence text says the creator *"is recorded as the confirmer"* — which `BR-176` forbids and
 * `BR-164` forbids deriving. ⚠ Creating an order directly into `RELEASED` would also raise a pick
 * task and a reservation, neither of which any ratified rule authorises a capture form to do. The
 * card keeps its place and states the one state that IS ratified.
 *
 * <p>🔴 SEVERAL CONTROLS THE PROTOTYPE DRAWS CANNOT BE PERSISTED AND ARE THEREFORE DIMMED, NOT
 * SILENTLY DROPPED. Customer type, Sold by, per-line quantity, per-line and package warranty,
 * the warranty charge, delivery & handling and the delivery route have no column on
 * `channel_order` or `channel_order_item` and no field on `ManualOrderService.NewOrder`. A control
 * that accepted a value and discarded it on save is the worst of the three options; a dimmed
 * control with its reason is honest and keeps the composition intact.
 *
 * <p>🔴 NOTHING PRESENTS A LOW MANUAL PRICE AS A DISCOUNT (`BR-148` — the Ideal / Recommended
 * Selling Price is ADVISORY, never a floor and never an approval trigger). The listing price a
 * search result carries is a STARTING POINT the operator overwrites, and no comparison is drawn.
 */
export default function NewOrderPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [shops, setShops] = useState<ChannelOrderSummary['shops']>([]);
  const [shopId, setShopId] = useState('');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<readonly LineDraft[]>([
    { id: 1, description: '', unitPrice: '' },
    { id: 2, description: '', unitPrice: '' },
  ]);
  const [nextLineId, setNextLineId] = useState(3);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<readonly ChannelListing[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const summary = await fetchChannelOrderSummary({});
        setShops(summary.shops ?? []);
      } catch {
        // ⚠ The shop list failing does not disable capture; the field simply has no options and
        // the server refuses without one (BR-002). A silent empty select is honest here.
        setShops([]);
      }
    })();
  }, []);

  /*
    🔴 THE SEARCH READS THE REAL LISTING CATALOGUE, NOT A SAMPLE ONE. The prototype searches an
    invented array of seven products; `listChannelListings` is the same endpoint the Listings
    workspace uses, so a title the operator finds here is a listing that actually exists, its
    mapping state is the real `PRD-178` one, and its price is the real `PRD-199.a` base price.
  */
  useEffect(() => {
    const term = search.trim();
    if (term.length === 0) {
      setResults([]);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const page = await listChannelListings({ search: term }, 0, 5);
          if (live) setResults(page.content);
        } catch {
          if (live) setResults([]);
        }
      })();
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [search]);

  /*
    🔴 THE TOTAL IS SUMMED FROM STRINGS AS STRINGS. `TEC-015` / `DB-079` — money is never a
    JavaScript number. A `reduce` over `Number(price)` would round 0.1 + 0.2 into an amount nobody
    typed, and this is the figure that becomes the order's price and the invoice's subtotal.
  */
  const total = useMemo(() => sumMinorUnits(lines.map((line) => line.unitPrice)), [lines]);
  const priced = lines.some((line) => /^\d+(\.\d{0,2})?$/.test(line.unitPrice.trim()));

  const updateLine = useCallback((id: number, patch: Partial<LineDraft>) => {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }, []);

  const addLine = useCallback((description: string, unitPrice: string) => {
    setLines((current) => [...current, { id: nextLineId, description, unitPrice }]);
    setNextLineId((value) => value + 1);
    setSearch('');
    setResults([]);
  }, [nextLineId]);

  const submit = useCallback(async (thenPrint: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const { first, last } = splitName(customer);
      const created = await apiRequest<{ id: string; invoiceNumber: string }>('/api/order/orders', {
        method: 'POST',
        body: {
          channelInstanceId: shopId || null,
          customerFirstName: first,
          customerLastName: last,
          customerPhone: phone,
          shippingAddress: address,
          shippingCity: null,
          paymentMethod,
          note,
          total,
          lines: lines
            .filter((line) => line.description.trim())
            .map((line, index) => ({
              lineNumber: index + 1,
              name: line.description,
              sku: null,
              unitPrice: line.unitPrice || '0',
            })),
        },
      });
      /*
        ✅ `Create and print` OPENS THE INVOICE AND CHANGES NO STATE (`PRN-022` — the rendering
        never becomes the source). Both buttons create exactly the same order.
      */
      navigate(thenPrint ? `/sales/orders/${created.id}/invoice` : `/sales/orders/${created.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The order could not be created.');
    } finally {
      setSaving(false);
    }
  }, [shopId, customer, phone, address, paymentMethod, note, lines, total, navigate]);

  const units = lines.length;

  return (
    <>
      <PageHeader
        title="New order"
        breadcrumb={
          <>
            <span>Sales &amp; Orders</span>
            <span>/</span>
            <Link to="/sales/orders" style={crumbLinkStyle}>Orders</Link>
            <span>/</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>New order</span>
          </>
        }
        subtitle="Direct-channel capture · the order is created in pending verification, and creating it does not confirm it"
        actions={
          <>
            <Button variant="secondary" size="page-header" onClick={() => navigate('/sales/orders')}>
              Cancel
            </Button>
            {/* `RULE 3.11` — exactly one primary, and it is rightmost. */}
            <Button
              variant="primary"
              size="page-header"
              disabled={saving}
              onClick={() => void submit(false)}
              testId="new-order-submit"
            >
              {saving ? 'Creating…' : 'Create order'}
            </Button>
          </>
        }
      />

      {error ? <p style={errorStyle} data-testid="new-order-error">{error}</p> : null}

      <div style={splitStyle}>
        <div style={columnStyle}>
          {/* ── 1 · Customer ───────────────────────────────────────────── */}
          <Panel step="1" title="Customer" meta="Written onto the order as a snapshot at creation">
            <div style={captureGridStyle}>
              <Field label="Customer name" required>
                <input
                  style={inputStyle}
                  placeholder="Rifat Hasan"
                  value={customer}
                  onChange={(event) => setCustomer(event.target.value)}
                  aria-label="Customer name"
                />
              </Field>
              <Field label="Phone number" required>
                <input
                  style={inputStyle}
                  placeholder="01XXXXXXXXX"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  aria-label="Phone number"
                />
              </Field>
              <Field label="Address" required full>
                <textarea
                  rows={2}
                  style={{ ...inputStyle, minHeight: '64px', height: 'auto', padding: '10px 12px', lineHeight: 1.6, resize: 'vertical' }}
                  placeholder="House, road, area, city — the full address the courier will deliver to"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  aria-label="Address"
                />
              </Field>
              {/*
                🔴 DIMMED — `channel_order` HOLDS NO CUSTOMER TYPE. `CUSTOMER_ARCHITECTURE.md` owns
                the customer classification and no column carries it onto an order, so a value
                chosen here would be discarded on save.
              */}
              <Field label="Customer type" reason="Not stored: no customer-type column exists on the order.">
                <Select value="" onChange={() => undefined} disabled>
                  <option value="">Not recorded</option>
                </Select>
              </Field>
              <Field label="Shop" required>
                {/* 🔴 `BR-002` — channel type is never sufficient attribution; the INSTANCE is named. */}
                <Select value={shopId} onChange={setShopId}>
                  <option value="">Choose a shop</option>
                  {shops.map((shop) => (
                    <option key={shop.channelInstanceId} value={shop.channelInstanceId}>
                      {shop.name ?? shop.code}
                    </option>
                  ))}
                </Select>
              </Field>
              {/*
                🔴 DIMMED — NO `Sold by` ATTRIBUTION IS RATIFIED ON AN ORDER. ⚠ CLAUDE.md §8's
                attribution rule is precisely why this is not improvised: a first-class actor fact
                is captured when the authoritative action occurs, and inventing a salesperson field
                here would create an attribution nothing else in the corpus recognises.
              */}
              <Field label="Sold by" reason="Not stored: no order-level salesperson attribution is ratified.">
                <Select value="" onChange={() => undefined} disabled>
                  <option value="">Not recorded</option>
                </Select>
              </Field>
            </div>
          </Panel>

          {/* ── 2 · Lines ──────────────────────────────────────────────── */}
          <Panel
            step="2"
            title="Lines"
            meta="Unit price is entered by staff"
            flush
          >
            <div style={{ padding: '16px 22px 0' }}>
              <div style={{ position: 'relative' }}>
                <input
                  style={inputStyle}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    const text = search.trim();
                    if (!text) return;
                    const first = results[0];
                    if (first) {
                      addLine(first.intendedTitle ?? text, first.salePrice ?? '');
                    } else {
                      addLine(text, '');
                    }
                  }}
                  placeholder="Search a listing title, listing id or product — press Enter to add it as a line"
                  aria-label="Search the listing catalogue"
                  data-testid="new-order-search"
                />
                {results.length > 0 && (
                  <div style={resultsPanelStyle} role="listbox">
                    {results.map((listing) => (
                      <button
                        key={listing.id}
                        type="button"
                        style={resultRowStyle}
                        onClick={() => addLine(listing.intendedTitle ?? 'Listing', listing.salePrice ?? '')}
                      >
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                              {listing.intendedTitle ?? 'Title not recorded'}
                            </span>
                            {/*
                              🔴 THE MAPPING CHIP IS NEUTRAL WHEN MAPPED AND AMBER WHEN NOT, AND
                              THE AMBER IS NOT A FAULT. `PRD-178` makes `UNMAPPED` a first-class
                              valid state; it is marked here only because an unmapped listing has
                              no sellable product behind it, so cost and margin stay unknown.
                            */}
                            <span style={listing.mappingState === 'MAPPED' ? mapChipStyle : unmappedChipStyle}>
                              {listing.mappingState === 'MAPPED' ? 'Mapped' : 'Unmapped'}
                            </span>
                          </span>
                          <span style={resultMetaStyle}>
                            {listing.externalListingId
                              ? `${listing.channelName ?? 'Shop'} listing ${listing.externalListingId}`
                              : `${listing.channelName ?? 'Shop'} · not yet published`}
                          </span>
                          <span style={resultMetaStyle}>
                            {listing.mappingState === 'MAPPED'
                              ? `Maps to ${listing.sellableName ?? listing.mappedSellableSku ?? 'a sellable product'}`
                              : 'Unmapped listing · no sellable product behind it, so cost and margin stay unknown'}
                          </span>
                        </span>
                        <span style={{ textAlign: 'right' }}>
                          <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {formatMoneyForDisplay(listing.salePrice) ?? 'Price not recorded'}
                          </span>
                          <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--color-text-demoted)', marginTop: '2px' }}>
                            listing price
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
                No match is needed — pressing Enter with no result adds the text you typed as a
                non-catalogued line, and mapping it stays owed.
              </div>
            </div>

            <div style={{ padding: '14px 22px 8px' }}>
              <div style={lineHeaderStyle}>
                <div>DESCRIPTION</div>
                <div style={rightAlign}>QTY</div>
                <div style={rightAlign}>UNIT PRICE</div>
                <div>WARRANTY</div>
                <div style={rightAlign}>LINE TOTAL</div>
                <div />
              </div>
              {lines.map((line, index) => (
                <div key={line.id} style={lineRowStyle}>
                  <input
                    style={inputStyle}
                    placeholder="Item description"
                    value={line.description}
                    onChange={(event) => updateLine(line.id, { description: event.target.value })}
                    aria-label={`Line ${index + 1} description`}
                  />
                  {/*
                    🔴 DIMMED AT ONE — `channel_order_item` HOLDS NO QUANTITY COLUMN, and the order
                    total IS stored. A quantity that multiplied the total but was not itself saved
                    would make the invoice print a figure its own lines do not add up to.
                  */}
                  <input
                    style={{ ...inputStyle, ...rightAlign, ...disabledInputStyle }}
                    value="1"
                    readOnly
                    disabled
                    title="Quantity is not stored: channel_order_item holds no quantity column. Add the line again for a second unit."
                    aria-label={`Line ${index + 1} quantity — not stored`}
                  />
                  <input
                    style={{ ...inputStyle, ...rightAlign }}
                    placeholder="0"
                    inputMode="decimal"
                    value={line.unitPrice}
                    onChange={(event) => updateLine(line.id, { unitPrice: event.target.value })}
                    aria-label={`Line ${index + 1} unit price`}
                  />
                  {/*
                    🔴 DIMMED — WARRANTY IS `WARRANTY_REPAIR_ARCHITECTURE.md`'s, AND NO ORDER LINE
                    CARRIES A TERM. Choosing one here would invent both a storage location and the
                    rule for when its clock starts.
                  */}
                  <Select value="" onChange={() => undefined} disabled>
                    <option value="">From product policy</option>
                  </Select>
                  <div className="tabular-nums" style={{ ...rightAlign, fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {formatMoneyForDisplay(line.unitPrice) ?? '—'}
                  </div>
                  <button
                    type="button"
                    style={removeLineStyle}
                    disabled={lines.length === 1}
                    onClick={() => setLines((current) => current.filter((row) => row.id !== line.id))}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 12h12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div style={lineFooterStyle}>
              <button type="button" style={addLineStyle} onClick={() => addLine('', '')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14" /><path d="M5 12h14" />
                </svg>
                Add line
              </button>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {units} line{units === 1 ? '' : 's'} · quantity not stored
              </div>
            </div>
          </Panel>

          {/* ── 3 · Payment and note ───────────────────────────────────── */}
          <Panel step="3" title="Payment and note" meta="No receipt is recorded at capture">
            <div style={fieldGridStyle}>
              <Field label="Collection mode">
                <Select value={paymentMethod} onChange={setPaymentMethod}>
                  <option>Cash on Delivery</option>
                  <option>bKash</option>
                  <option>Card at counter</option>
                  <option>Bank transfer</option>
                </Select>
              </Field>
              {/*
                🔴 DIMMED — `ManualOrderService` WRITES NO `shipping_fee`. The column exists on
                imported orders because the channel reports one; a manual capture path that set it
                would be adding a figure to the order total by a route nothing ratifies.
              */}
              <Field label="Delivery & handling" reason="Not stored: the manual capture path writes no shipping fee.">
                <input style={{ ...inputStyle, ...rightAlign, ...disabledInputStyle }} value="" placeholder="Not recorded" disabled aria-label="Delivery and handling — not stored" />
              </Field>
              <Field label="Note for operations" full>
                <input
                  style={inputStyle}
                  placeholder="Optional — a packing or delivery instruction"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  aria-label="Note for operations"
                />
              </Field>
            </div>
          </Panel>

          {/* ── The footer bar ─────────────────────────────────────────── */}
          <div style={footerBarStyle}>
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', lineHeight: 1.55, maxWidth: '520px' }}>
              Both actions create the order in <strong>pending verification</strong>. Create and
              print opens the invoice straight after, and printing changes no state.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexShrink: 0 }}>
              <Button variant="secondary" size="page-header" onClick={() => navigate('/sales/orders')}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="page-header"
                disabled={saving}
                onClick={() => void submit(true)}
                testId="new-order-create-print"
              >
                <PrinterIcon />
                Create and print
              </Button>
              <Button
                variant="primary"
                size="page-header"
                disabled={saving}
                onClick={() => void submit(false)}
              >
                {saving ? 'Creating…' : 'Create order'}
              </Button>
            </div>
          </div>
        </div>

        {/* ── The right rail ───────────────────────────────────────────── */}
        <div style={railStyle}>
          <section style={railCardStyle}>
            <div style={railCapStyle}>ORDER TOTAL</div>
            <div className="tabular-nums" style={totalStyle} data-testid="new-order-total">
              {priced ? formatMoneyForDisplay(total) ?? 'Not entered yet' : 'Not entered yet'}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--color-text-demoted)', lineHeight: 1.55, marginTop: 'var(--space-1)' }}>
              {priced
                ? 'Preview of the staff-entered prices. The authoritative figure is stored as entered and is never re-derived from the lines.'
                : 'Enter a unit price on at least one line.'}
            </div>
            <div style={railDividerStyle} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <RailRow label="Goods" value={priced ? formatMoneyForDisplay(total) ?? 'Not entered' : 'Not entered'} />
              <RailRow label="Reaches customer by" value="Not recorded" muted />
              <RailRow label="Warranty charge" value="Not recorded" muted />
              <RailRow label="Warranty package" value="Not recorded" muted />
              <RailRow label="Delivery & handling" value="Not recorded" muted />
              {/*
                🔴 UNKNOWN, NEVER `0` (`INV-32.4`, `BR-007`). A manual line carries no cost
                snapshot, so the margin on this order is unknown from the moment it is created.
              */}
              <RailRow label="Cost and margin" value="Unknown" muted />
            </div>
          </section>

          <section style={railCardStyle}>
            <div style={railCapStyle}>WARRANTY</div>
            <Field label="Overall warranty package" reason="Not stored: no order-level warranty term is ratified. WARRANTY_REPAIR_ARCHITECTURE.md owns the policy.">
              <Select value="" onChange={() => undefined} disabled>
                <option value="">Per line, from each product's policy</option>
              </Select>
            </Field>
            <div style={{ marginTop: 'var(--space-5)' }}>
              <Field label="Warranty charge" reason="Not stored: a warranty charge is a sale amount with no column and no ratified accounting treatment.">
                <input style={{ ...inputStyle, ...rightAlign, ...disabledInputStyle }} value="" placeholder="Not recorded" disabled aria-label="Warranty charge — not stored" />
              </Field>
            </div>
          </section>

          <section style={railCardStyle}>
            <div style={railCapStyle}>PRINTING</div>
            {/*
              🔴 THE INVOICE PRINTS THE `E-039` SNAPSHOT AND NOTHING ELSE (`PRN-022`, `INV-39.2`).
              The prototype offers a choice between printing the order's own lines and printing a
              marketplace listing's title instead. ⚠ That choice cannot exist here: the invoice is
              rendered from a snapshot taken at issue so it stays reproducible years later, and a
              renderer that substituted a channel-authored title would make the printed document
              disagree with the record it claims to reproduce.
            */}
            <p style={{ ...railTextStyle, marginTop: 0 }}>
              The invoice prints the order's own lines exactly as they were captured. It renders the
              snapshot taken at issue and computes nothing (<code>PRN-022</code>), so there is no
              choice of what to print.
            </p>
          </section>

          <section style={railCardStyle}>
            <div style={railCapStyle}>WHAT CREATING THIS DOES</div>
            <Field
              label="The state it will be created in"
              reason="PRM-093.b — creation is not confirmation. No other creation state is ratified."
            >
              <Select value="PENDING_VERIFICATION" onChange={() => undefined} disabled>
                <option value="PENDING_VERIFICATION">Pending verification</option>
              </Select>
            </Field>
            <ul style={consequenceListStyle}>
              <li>Creation is not confirmation. No confirmer and no confirmation time are recorded.</li>
              <li>No stock is reserved or deducted, and a shortage does not block capture.</li>
              <li>The price you enter is the price of record. It is not read as a discount against any list price.</li>
              <li>The order is ERP-managed from creation, and no marketplace holds authority over it.</li>
            </ul>
            <div style={railDividerStyle} />
            <Field
              label="How this order reaches the customer"
              reason="Not stored: no delivery route is recorded at capture. Steadfast is the only courier and is assigned automatically (BR-076)."
            >
              <Select value="" onChange={() => undefined} disabled>
                <option value="">Not recorded</option>
              </Select>
            </Field>
          </section>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

type LineDraft = { readonly id: number; readonly description: string; readonly unitPrice: string };

function Panel({
  step,
  title,
  meta,
  flush,
  children,
}: {
  readonly step: string;
  readonly title: string;
  readonly meta: string;
  /** `flush` gives the panel's children the whole body, for a panel that paints its own padding. */
  readonly flush?: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section style={panelStyle}>
      <header style={panelHeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={stepStyle}>{step}</span>
          <h2 style={panelTitleStyle}>{title}</h2>
        </div>
        <span style={panelMetaStyle}>{meta}</span>
      </header>
      {flush ? children : <div style={{ padding: '18px 22px' }}>{children}</div>}
    </section>
  );
}

/**
 * A labelled field.
 *
 * <p>🔴 A `reason` MAKES THE FIELD'S DISABLING VISIBLE, NOT TOOLTIP-ONLY. A tooltip is
 * unreachable by keyboard and invisible on touch, and a control that is dimmed for a reason the
 * operator cannot read is indistinguishable from one that is broken.
 */
function Field({
  label,
  required,
  reason,
  full,
  children,
}: {
  readonly label: string;
  readonly required?: boolean;
  readonly reason?: string;
  readonly full?: boolean;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label style={fieldLabelStyle}>
        {label}
        {required ? <span style={{ color: 'var(--color-destructive)' }}> *</span> : null}
      </label>
      {children}
      {reason ? <div style={reasonTextStyle}>{reason}</div> : null}
    </div>
  );
}

function RailRow({
  label,
  value,
  muted,
}: {
  readonly label: string;
  readonly value: string;
  readonly muted?: boolean;
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
      <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', flexShrink: 0 }}>{label}</span>
      <span
        className="tabular-nums"
        style={{
          fontSize: '13px',
          fontWeight: 600,
          textAlign: 'right',
          color: muted ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PrinterIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M6 9V4h12v5" /><rect x="4" y="9" width="16" height="7" rx="1.5" /><path d="M7 16h10v4H7z" />
    </svg>
  );
}

/**
 * Splits one typed name into the two columns the order snapshot holds.
 *
 * <p>⚠ The prototype captures ONE name field and `channel_order` holds two, so the split happens
 * here rather than by asking an operator to parse their own customer. Everything after the first
 * space is the last name — a Bangladeshi name commonly has three parts, and putting the remainder
 * in one column keeps it intact instead of discarding the middle.
 */
export function splitName(value: string): { readonly first: string; readonly last: string } {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return { first: '', last: '' };
  }
  const cut = trimmed.indexOf(' ');
  return cut < 0
    ? { first: trimmed, last: '' }
    : { first: trimmed.slice(0, cut), last: trimmed.slice(cut + 1) };
}

/**
 * Sums decimal strings without ever becoming a float.
 *
 * 🔴 `TEC-015` / `DB-079` — money is never a JavaScript number. This works in minor units as
 * integers, so `0.1 + 0.2` stays `0.30` instead of becoming an amount nobody typed. ⚠ The result
 * is the figure that becomes the order's price and then the invoice's subtotal, so it is the last
 * place a rounding artefact could be introduced unnoticed.
 */
export function sumMinorUnits(values: readonly string[]): string {
  let minor = 0n;
  for (const raw of values) {
    const value = (raw ?? '').trim();
    if (!value || !/^\d+(\.\d{0,2})?$/.test(value)) {
      continue;
    }
    const [whole, fraction = ''] = value.split('.');
    minor += BigInt(whole || '0') * 100n + BigInt((fraction + '00').slice(0, 2));
  }
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  return `${negative ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ styles */

const splitStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 340px',
  gap: 'var(--space-7)',
  alignItems: 'start',
  minWidth: 0,
};

const columnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-7)',
  minWidth: 0,
};

const railStyle: React.CSSProperties = {
  position: 'sticky',
  top: 'var(--space-8)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5)',
  minWidth: 0,
};

const panelStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
};

const panelHeaderStyle: React.CSSProperties = {
  minHeight: '56px',
  padding: '0 22px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-6)',
  borderBottom: '1px solid var(--color-divider-inner)',
};

const stepStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  borderRadius: '999px',
  background: 'var(--color-ink)',
  color: 'var(--color-surface)',
  fontSize: '11.5px',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const panelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '15.5px',
  fontWeight: 700,
  letterSpacing: '-0.01em',
  color: 'var(--color-heading-ink)',
};

const panelMetaStyle: React.CSSProperties = {
  fontSize: '11.5px',
  color: 'var(--color-text-secondary)',
  textAlign: 'right',
};

/* The capture grid is tighter than `RULE 3.18.g`'s reference, exactly as the prototype draws it. */
const captureGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  rowGap: 'var(--space-5)',
  columnGap: 'var(--space-8)',
};

/** `RULE 3.18.g` — the two-column `1fr 1fr` reference composition at `18px 32px`. */
const fieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  rowGap: '18px',
  columnGap: '32px',
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11.5px',
  fontWeight: 600,
  letterSpacing: '0.01em',
  color: 'var(--color-text-muted)',
  marginBottom: 'var(--space-2)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 'var(--control-height-button)',
  padding: '0 12px',
  borderRadius: 'var(--radius-control-small)',
  border: '1px solid var(--color-border-form-control)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 500,
};

/*
  ✅ THE SHARED NEUTRAL DISABLED VOCABULARY the form controls already use — light neutral surface,
  muted text — so a control that cannot be saved reads the same everywhere on this page.
*/
const disabledInputStyle: React.CSSProperties = {
  background: 'var(--color-divider-light)',
  borderColor: 'var(--color-border-control)',
  color: 'var(--color-text-muted)',
  cursor: 'not-allowed',
};

const reasonTextStyle: React.CSSProperties = {
  fontSize: '11px',
  lineHeight: 1.5,
  color: 'var(--color-text-demoted)',
  marginTop: 'var(--space-2)',
};

const LINE_COLUMNS = 'minmax(0, 1fr) 84px 132px 190px 128px 36px';

const lineHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: LINE_COLUMNS,
  gap: 'var(--space-4)',
  alignItems: 'center',
  padding: '0 0 var(--space-2)',
  borderBottom: '1px solid var(--color-divider-inner)',
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  color: 'var(--color-text-secondary)',
};

const lineRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: LINE_COLUMNS,
  gap: 'var(--space-4)',
  alignItems: 'center',
  padding: 'var(--space-4) 0',
  borderBottom: '1px solid var(--color-divider-light)',
};

const lineFooterStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-7)',
  padding: 'var(--space-4) 22px 18px',
};

const addLineStyle: React.CSSProperties = {
  height: 'var(--control-height-row-action)',
  padding: '0 var(--space-4)',
  borderRadius: 'var(--radius-control-small)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-secondary-button)',
  color: 'var(--color-secondary-text)',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  cursor: 'pointer',
};

const removeLineStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: 'var(--radius-control-small)',
  border: '1px solid var(--color-border-control)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const resultsPanelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '42px',
  left: 0,
  right: 0,
  zIndex: 20,
  padding: 'var(--space-2)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-control)',
  borderRadius: 'var(--radius-card)',
  boxShadow: 'var(--elevation-overlay)',
  maxHeight: '260px',
  overflowY: 'auto',
};

const resultRowStyle: React.CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 104px',
  gap: 'var(--space-4)',
  alignItems: 'center',
  padding: 'var(--space-3)',
  border: 'none',
  borderRadius: 'var(--radius-control-small)',
  background: 'transparent',
  font: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
};

const resultMetaStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: 'var(--color-text-demoted)',
  marginTop: '3px',
};

const mapChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  flexShrink: 0,
  padding: '2px var(--space-2)',
  borderRadius: '999px',
  fontSize: '10.5px',
  fontWeight: 600,
  background: 'var(--color-status-neutral-bg)',
  color: 'var(--color-status-neutral-fg)',
};

const unmappedChipStyle: React.CSSProperties = {
  ...mapChipStyle,
  background: 'var(--color-semantic-warning-bg)',
  color: 'var(--color-semantic-warning-fg)',
};

const footerBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-8)',
  padding: 'var(--space-5) var(--space-7)',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
};

const railCardStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border-card)',
  borderRadius: 'var(--radius-panel)',
  boxShadow: 'var(--elevation-card)',
  padding: 'var(--space-7)',
};

const railCapStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.07em',
  color: 'var(--color-text-muted)',
  marginBottom: 'var(--space-4)',
};

const totalStyle: React.CSSProperties = {
  fontSize: '30px',
  fontWeight: 800,
  letterSpacing: '-0.025em',
  lineHeight: '38px',
  color: 'var(--color-heading-ink)',
  marginTop: 'var(--space-1)',
};

const railDividerStyle: React.CSSProperties = {
  height: '1px',
  background: 'var(--color-divider-inner)',
  margin: 'var(--space-6) 0',
};

const railTextStyle: React.CSSProperties = {
  margin: 'var(--space-4) 0 0',
  fontSize: '12.5px',
  lineHeight: 1.55,
  color: 'var(--color-text-muted)',
};

const consequenceListStyle: React.CSSProperties = {
  margin: 'var(--space-4) 0 0',
  paddingLeft: '18px',
  fontSize: '12px',
  lineHeight: 1.55,
  color: 'var(--color-text-muted)',
};

const crumbLinkStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  textDecoration: 'underline',
};

const rightAlign: React.CSSProperties = { textAlign: 'right' };

const errorStyle: React.CSSProperties = {
  margin: '0 0 var(--space-5)',
  padding: 'var(--space-4)',
  borderRadius: 'var(--radius-control)',
  background: 'var(--color-semantic-warning-bg)',
  color: 'var(--color-semantic-warning-fg)',
  fontSize: '13px',
};
