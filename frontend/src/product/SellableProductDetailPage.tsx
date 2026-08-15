import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '../shell/AppShell';
import { Card, EmptyState, buttonStyle } from '../ui/primitives';
import { OperationalRegion } from '../ui/OperationalRegion';
import { useAuth } from '../auth/AuthContext';
import { usePageActions } from '../shell/PageActions';
import { ApiError } from '../platform/api';
import {
  activateTemplate,
  addBomLine,
  addBundleMember,
  createDraftTemplate,
  fetchBuildTemplates,
  fetchBundleMembers,
  fetchSellableProduct,
  removeBomLine,
  removeBundleMember,
} from './sellableProductApi';
import type { BuildTemplate, BundleMember, SellableProduct } from './sellableProductApi';

/**
 * The Sellable Product detail surface — `UX-039.c`.
 *
 * <p>Canonical sections only: **Overview · nature and resolution target** (`PRD-021`) **· Build
 * Template incl. version** (`PRD-067`) **or bundle members** (`PRD-047`) **· derived
 * availability** (`PRD-023`) **· Listings** (`PRD-028`) **· Warranty Package**.
 *
 * <p>🔴 NO ANALYTICS. No sales figure, no revenue, no margin, no trend, no chart — none is
 * canonical and `UX-080` forbids inventing one.
 *
 * <p>🔴 The Build Template region enforces the separation canon requires: authoring a DRAFT is
 * `product.sellable-product.manage`; ACTIVATING one is `product.build-template.activate`
 * (`PRD-155`), because `PRD §24` puts activation on its own row.
 */
export default function SellableProductDetailPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();

  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  // 🔴 Affordances only (`UX-014`, `PRJ-120`). The backend refuses regardless.
  const mayManage = permissions.includes('product.sellable-product.manage');
  const mayActivate = permissions.includes('product.build-template.activate');

  const [item, setItem] = useState<SellableProduct | null>(null);
  const [templates, setTemplates] = useState<readonly BuildTemplate[]>([]);
  const [members, setMembers] = useState<readonly BundleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const product = await fetchSellableProduct(id);
      setItem(product);
      if (product.nature === 'ASSEMBLED') {
        setTemplates(await fetchBuildTemplates(id));
      } else if (product.nature === 'BUNDLE') {
        setMembers(await fetchBundleMembers(id));
      }
    } catch (cause) {
      if (cause instanceof ApiError && cause.isForbidden) {
        setForbidden(true);
      } else {
        setError(cause instanceof Error ? cause.message : 'The Sellable Product could not be loaded.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (cause) {
      const payload = cause instanceof ApiError
        ? (cause.payload as { message?: string } | null) : null;
      setError(payload?.message ?? (cause instanceof Error ? cause.message : 'The action failed.'));
    } finally {
      setBusy(false);
    }
  }

  usePageActions(
    mayManage && id ? (
      <Link data-testid="edit-sellable-product" to={`/inventory/products/sellable/${id}/edit`} style={headerPrimary}>
        Edit
      </Link>
    ) : null,
    [mayManage, id],
  );

  if (forbidden) {
    return (
      <Card>
        <EmptyState
          title="You do not have access to this Sellable Product"
          guidance="Viewing Sellable Products requires a capability your account has not been granted."
        />
      </Card>
    );
  }
  if (loading) {
    return (
      <Card>
        <EmptyState title="Loading…" guidance="Fetching the Sellable Product." />
      </Card>
    );
  }
  if (!item) {
    return (
      <Card>
        <EmptyState title="Sellable Product not found" guidance={error ?? 'No such record.'} />
      </Card>
    );
  }

  const draft = templates.find((t) => t.status === 'DRAFT');
  const active = templates.find((t) => t.status === 'ACTIVE');

  return (
    <>
      <PageHeader title={item.name} subtitle={`Products · Sellable Products · ${item.nature}`} />

      {error && (
        <div role="alert" data-testid="sellable-detail-error" style={{ marginBottom: 'var(--space-5)' }}>
          <Card>
            <EmptyState title="The action could not be completed" guidance={error} />
          </Card>
        </div>
      )}

      {/* ---------------------------------------------------------------- Overview */}
      <Section title="Overview" testId="section-overview">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '18px 32px' }}>
          <Fact label="Sellable SKU" testId="detail-sku" value={item.sellableSku} mono />
          <Fact label="Nature" testId="detail-nature" value={item.nature}
            note="Immutable (PRD-070)." />
          <Fact label="Record status" testId="detail-status" value={item.recordStatus} />
          <Fact label="Sellable category" testId="detail-category" value={item.sellableCategory ?? '—'} />
          <Fact label="Warranty package" testId="detail-warranty" value={item.warrantyPackage ?? '—'} />
          <Fact label="Description" testId="detail-description" value={item.description ?? '—'} />
        </div>
      </Section>

      {/* ------------------------------------------------- Resolution + availability */}
      <Section title="Resolution target and derived availability" testId="section-resolution">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px 32px' }}>
          {item.nature === 'SIMPLE' && (
            <Fact label="Stock Item" testId="detail-simple-target"
              value={item.simpleTargetInventorySku
                ? `${item.simpleTargetInventorySku} × ${item.simpleQuantityPerSaleUnit ?? ''}`
                : 'Not mapped'}
              mono
              note="PRD-021 — one Inventory Product with a quantity per sale unit. A reference, never a copy." />
          )}
          {item.nature === 'ASSEMBLED' && (
            <>
              <Fact label="Finished Stock Item" testId="detail-assembled-finished"
                value={item.assembledFinishedInventorySku ?? 'Not mapped'}
                mono
                note="PRD-156 — ready-built finished units are held under this Inventory identity." />
              <Fact label="Active Build Template" testId="detail-active-template"
                value={active ? `v${active.versionNumber}` : 'No active version'}
                note="PRD-081 — exactly one ACTIVE version supplies the buildable term." />
            </>
          )}
          {item.nature === 'BUNDLE' && (
            <Fact label="Members" testId="detail-member-count"
              value={`${members.length} member${members.length === 1 ? '' : 's'}`}
              note="PRD-021, PRD-047 — an ordered list of member Sellable Products with quantities." />
          )}

          <div>
            <div style={labelStyle}>Sellable availability</div>
            {item.availableSaleUnits != null ? (
              <div data-testid="detail-availability" className="tabular-nums"
                style={{ fontSize: '19px', fontWeight: 800, color: 'var(--color-heading-ink)' }}>
                {item.availableSaleUnits} units
              </div>
            ) : (
              /* 🔴 Not derivable is NOT zero (SYS-034). The reason names the remedy. */
              <div data-testid="detail-availability-unresolved"
                style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                Not derivable
              </div>
            )}
            <div style={noteStyle}>
              {item.availabilityUnresolvedReason
                ?? `Derived from the resolution target on every read and never stored (PRD-023, INV-58.4).${
                  item.availabilityConstrainedBy ? ` Constrained by ${item.availabilityConstrainedBy}.` : ''
                }`}
            </div>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------ Build Template */}
      {item.nature === 'ASSEMBLED' && (
        <Section title="Build Template versions" testId="section-build-templates">
          <div style={{ ...noteStyle, marginBottom: 'var(--space-4)' }}>
            🔴 A change is always a NEW version; an ACTIVE version is never edited in place
            (PRD-069), and superseded versions are retained permanently because As-Built Records
            reference them (PRD-068). Templates are single-level: a line resolves to a physical
            Stock Item, never to another template (PRD-034).
          </div>

          {mayManage && (
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
              <button type="button" data-testid="create-draft-template" disabled={busy || draft != null}
                onClick={() => void run(() => createDraftTemplate(item.id))} style={secondaryButton}>
                {draft ? `Draft v${draft.versionNumber} in progress` : 'Create draft version'}
              </button>
            </div>
          )}

          {draft && mayManage && (
            <AddBomLineForm busy={busy}
              onAdd={(body) => void run(() => addBomLine(draft.id, body))} />
          )}

          {templates.length === 0 ? (
            <EmptyState title="No Build Template versions yet"
              guidance="Create a draft version and add its required components. Nothing is shown here because no version exists." />
          ) : (
            <div data-testid="build-template-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
              {templates.map((template) => (
                <div key={template.id} data-testid={`build-template-v${template.versionNumber}`}
                  style={{
                    border: '1px solid var(--color-border-card)',
                    borderRadius: 'var(--radius-card-small)',
                    padding: '14px',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'nowrap', marginBottom: 'var(--space-4)' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>v{template.versionNumber}</span>
                    <span data-testid={`template-status-v${template.versionNumber}`}
                      style={{
                        fontSize: '11.5px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px',
                        background: template.status === 'ACTIVE'
                          ? 'var(--color-status-confirmed-bg)' : 'var(--color-status-neutral-bg)',
                        color: template.status === 'ACTIVE'
                          ? 'var(--color-status-confirmed-fg)' : 'var(--color-status-neutral-fg)',
                        whiteSpace: 'nowrap',
                      }}>
                      {template.status}
                    </span>
                    {template.status === 'DRAFT' && mayActivate && (
                      /*
                        🔴 A SEPARATE CAPABILITY, not `manage` (PRD-155). PRD §24 requires a
                        Product administrator WITH APPROVAL because the blast radius is every
                        future build, and PRD-092 audits the activation.
                      */
                      <button type="button" data-testid={`activate-v${template.versionNumber}`}
                        disabled={busy}
                        onClick={() => void run(() => activateTemplate(template.id))}
                        style={{ ...secondaryButton, marginLeft: 'auto' }}>
                        Activate version
                      </button>
                    )}
                    {template.activatedAt && (
                      <span style={{ ...noteStyle, marginLeft: 'auto', marginTop: 0 }}>
                        Activated {template.activatedAt}
                      </span>
                    )}
                  </div>

                  {template.lines.length === 0 ? (
                    <div style={noteStyle}>
                      No component lines yet. A version needs at least one required line before it
                      can be activated (PRD-082, INV-60.2).
                    </div>
                  ) : (
                    <OperationalRegion>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {template.lines.map((line) => (
                          <div key={line.id} data-testid={`bom-line-${line.inventorySku}`}
                            className="operational-row"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                              flexWrap: 'nowrap', minWidth: '760px', padding: '8px 10px',
                              borderRadius: 'var(--radius-control)',
                              background: 'var(--color-status-neutral-bg)',
                            }}>
                            <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 700, fontSize: '12px', minWidth: '140px', flexShrink: 0 }}>
                              {line.inventorySku}
                            </span>
                            <span style={{ flex: '1 1 auto', minWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                              {line.technicalName}
                            </span>
                            <span style={{ width: '110px', flexShrink: 0, fontSize: '12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                              {line.componentRole ?? '—'}
                            </span>
                            <span className="tabular-nums" style={{ width: '110px', flexShrink: 0, textAlign: 'right', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {line.quantityRequired} {line.unitOfMeasure}
                            </span>
                            <span style={{ width: '80px', flexShrink: 0, fontSize: '11.5px', color: 'var(--color-text-demoted)', whiteSpace: 'nowrap' }}>
                              {line.optional ? 'Optional' : 'Required'}
                            </span>
                            {template.status === 'DRAFT' && mayManage && (
                              <button type="button" data-testid={`remove-line-${line.inventorySku}`}
                                disabled={busy}
                                onClick={() => void run(() => removeBomLine(template.id, line.id))}
                                style={{ ...secondaryButton, height: 'var(--control-height-row-action)', flexShrink: 0 }}>
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </OperationalRegion>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ------------------------------------------------------------ Bundle members */}
      {item.nature === 'BUNDLE' && (
        <Section title="Bundle members" testId="section-bundle-members">
          <div style={{ ...noteStyle, marginBottom: 'var(--space-4)' }}>
            🔴 A member is a Sellable Product, which may be SIMPLE or ASSEMBLED — never another
            bundle (PRD-047, PRD-048). Defining a bundle creates no physical inventory and no
            stock movement.
          </div>

          {mayManage && (
            <AddBundleMemberForm busy={busy}
              onAdd={(body) => void run(() => addBundleMember(item.id, body))} />
          )}

          {members.length === 0 ? (
            <EmptyState title="No members yet"
              guidance="A bundle needs at least one required member before it can become ACTIVE." />
          ) : (
            <OperationalRegion>
              <div data-testid="bundle-member-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {members.map((member) => (
                  <div key={member.id} data-testid={`bundle-member-${member.memberSellableSku}`}
                    className="operational-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'nowrap',
                      minWidth: '760px', padding: '8px 10px', borderRadius: 'var(--radius-control)',
                      background: 'var(--color-status-neutral-bg)',
                    }}>
                    <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 700, fontSize: '12px', minWidth: '140px', flexShrink: 0 }}>
                      {member.memberSellableSku}
                    </span>
                    <span style={{ flex: '1 1 auto', minWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                      {member.memberName}
                    </span>
                    <span style={{ width: '96px', flexShrink: 0, fontSize: '11.5px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {member.memberNature}
                    </span>
                    <span className="tabular-nums" style={{ width: '80px', flexShrink: 0, textAlign: 'right', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      × {member.quantity}
                    </span>
                    <span style={{ width: '80px', flexShrink: 0, fontSize: '11.5px', color: 'var(--color-text-demoted)', whiteSpace: 'nowrap' }}>
                      {member.optional ? 'Optional' : 'Required'}
                    </span>
                    {mayManage && (
                      <button type="button" data-testid={`remove-member-${member.memberSellableSku}`}
                        disabled={busy}
                        onClick={() => void run(() => removeBundleMember(item.id, member.id))}
                        style={{ ...secondaryButton, height: 'var(--control-height-row-action)', flexShrink: 0 }}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </OperationalRegion>
          )}
        </Section>
      )}

      {/* ---------------------------------------------------------------- Listings */}
      <Section title="Listings" testId="section-listings">
        <div data-testid="detail-listings-not-implemented" style={noteStyle}>
          Channel Listings (`E-059`) have a ratified place on this surface (`UX-039.c`), but the
          module has not been built. 🔴 Nothing is shown here because no listing data exists — a
          count of zero would be a fabricated business statement.
        </div>
      </Section>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <Link to="/inventory/products/sellable" style={secondaryLink}>Back to Sellable Products</Link>
      </div>
    </>
  );
}

/** Draft-only BOM line authoring. 🔴 Identified by INVENTORY SKU — a physical component. */
function AddBomLineForm({
  busy,
  onAdd,
}: {
  readonly busy: boolean;
  readonly onAdd: (body: Record<string, unknown>) => void;
}): React.JSX.Element {
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [role, setRole] = useState('');
  const [optional, setOptional] = useState(false);

  return (
    <div data-testid="add-bom-line" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'nowrap', marginBottom: 'var(--space-5)' }}>
      <input data-testid="bom-line-sku" value={sku} onChange={(e) => setSku(e.target.value)}
        placeholder="Component Inventory SKU" aria-label="Component Inventory SKU" style={inlineControl(220)} />
      <input data-testid="bom-line-quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)}
        placeholder="Qty" aria-label="Quantity required" style={inlineControl(90)} />
      <input data-testid="bom-line-role" value={role} onChange={(e) => setRole(e.target.value)}
        placeholder="Component role" aria-label="Component role" style={inlineControl(160)} />
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '12.5px' }}>
        <input type="checkbox" data-testid="bom-line-optional" checked={optional}
          onChange={(e) => setOptional(e.target.checked)}
          style={{ width: '16px', height: '16px', accentColor: 'var(--color-ink)' }} />
        Optional
      </label>
      <button type="button" data-testid="add-bom-line-submit" disabled={busy || !sku}
        onClick={() => { onAdd({ inventorySku: sku, quantityRequired: quantity, componentRole: role || null, optional }); setSku(''); setRole(''); }}
        style={secondaryButton}>
        Add component
      </button>
    </div>
  );
}

/** 🔴 Identified by SELLABLE SKU — a bundle member is a Sellable Product (`PRD-047`). */
function AddBundleMemberForm({
  busy,
  onAdd,
}: {
  readonly busy: boolean;
  readonly onAdd: (body: Record<string, unknown>) => void;
}): React.JSX.Element {
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [optional, setOptional] = useState(false);

  return (
    <div data-testid="add-bundle-member" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'nowrap', marginBottom: 'var(--space-5)' }}>
      <input data-testid="member-sku" value={sku} onChange={(e) => setSku(e.target.value)}
        placeholder="Member Sellable SKU" aria-label="Member Sellable SKU" style={inlineControl(220)} />
      <input data-testid="member-quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)}
        placeholder="Qty" aria-label="Member quantity" style={inlineControl(90)} />
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '12.5px' }}>
        <input type="checkbox" data-testid="member-optional" checked={optional}
          onChange={(e) => setOptional(e.target.checked)}
          style={{ width: '16px', height: '16px', accentColor: 'var(--color-ink)' }} />
        Optional
      </label>
      <button type="button" data-testid="add-bundle-member-submit" disabled={busy || !sku}
        onClick={() => { onAdd({ memberSellableSku: sku, quantity, optional }); setSku(''); }}
        style={secondaryButton}>
        Add member
      </button>
    </div>
  );
}

function Section({
  title, testId, children,
}: {
  readonly title: string; readonly testId: string; readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div data-testid={testId} style={{ marginBottom: 'var(--space-6)' }}>
      <Card>
        <div style={{ padding: '18px 22px 22px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-heading-ink)', marginBottom: 'var(--space-4)' }}>
            {title}
          </div>
          {children}
        </div>
      </Card>
    </div>
  );
}

function Fact({
  label, testId, value, note, mono = false,
}: {
  readonly label: string; readonly testId: string; readonly value: string;
  readonly note?: string; readonly mono?: boolean;
}): React.JSX.Element {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div data-testid={testId} style={{
        fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)',
        fontFamily: mono ? 'var(--font-family-mono)' : 'inherit',
      }}>
        {value}
      </div>
      {note && <div style={noteStyle}>{note}</div>}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)',
};

const noteStyle: React.CSSProperties = {
  fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)',
};

const secondaryButton: React.CSSProperties = {
  ...buttonStyle('secondary', 'button'),
  padding: '0 14px',
  fontSize: '12.5px',
};

const secondaryLink: React.CSSProperties = {
  ...secondaryButton, textDecoration: 'none', cursor: 'default',
};

const headerPrimary: React.CSSProperties = {
  ...buttonStyle('primary', 'page-header'),
  textDecoration: 'none',
};

function inlineControl(width: number): React.CSSProperties {
  return {
    height: 'var(--control-height-form)', width: `${width}px`,
    borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-control)',
    padding: '0 12px', fontSize: '13px', fontFamily: 'inherit', background: 'var(--color-surface)',
  };
}
