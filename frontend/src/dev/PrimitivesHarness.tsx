import { useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Field,
  LoadingState,
  RefusalState,
  SegmentedControl,
  Select,
  StatusPill,
  TextInput,
} from '../ui/primitives';
import { OperationalRegion, OperationalRow, RowCell, RowIdentity, RowSpacer } from '../ui/OperationalRegion';
import { ActionMenu, ConfirmDialog, Pagination } from '../ui/Overlay';

/**
 * DEVELOPMENT-ONLY primitive verification surface.
 *
 * <p>🔴 Not an application page. It is not in the navigation register, carries no business
 * route, and is reachable only at `/__dev/primitives` while running the Vite dev server.
 * It is removable without touching any module.
 *
 * <p>🔴 It contains NO business data. Every label below is a neutral placeholder — no
 * order, no product, no customer, no amount that could be mistaken for an ERP record.
 * Inventory must consume an already-verified foundation, which is why these primitives are
 * exercised here rather than first appearing inside a real module.
 */
export default function PrimitivesHarness(): React.JSX.Element {
  const [text, setText] = useState('');
  const [filled, setFilled] = useState('Entered value');
  const [choice, setChoice] = useState('one');
  const [segment, setSegment] = useState('all');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<'none' | 'plain' | 'destructive'>('none');

  const section: React.CSSProperties = { marginBottom: 'var(--space-8)' };
  const heading: React.CSSProperties = {
    fontSize: '15.5px',
    fontWeight: 700,
    color: 'var(--color-heading-ink)',
    margin: '0 0 var(--space-5)',
  };
  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 'var(--space-7) var(--space-8)',
  };

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
      <h1 style={{ fontSize: '25px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-heading-ink)', margin: 0 }}>
        Primitive verification harness
      </h1>
      <p style={{ fontSize: '13.5px', color: 'var(--color-text-muted)', margin: 'var(--space-2) 0 var(--space-8)' }}>
        Development only · no business data · not part of the application
      </p>

      {/* ---------------------------------------------------------- form controls */}
      <section style={section}>
        <h2 style={heading}>Form controls — §3.18 states</h2>
        <div style={grid}>
          <Field label="Rest" htmlFor="p-rest" helper="Tab into it to check focus.">
            <TextInput id="p-rest" value={text} onChange={setText} placeholder="Placeholder text" />
          </Field>
          <Field label="Filled" htmlFor="p-filled">
            <TextInput id="p-filled" value={filled} onChange={setFilled} />
          </Field>
          <Field label="Required" htmlFor="p-req" required helper="Marker is on the label.">
            <TextInput id="p-req" value={text} onChange={setText} placeholder="Placeholder text" />
          </Field>
          <Field label="Error" htmlFor="p-err" error="This value was not accepted.">
            <TextInput id="p-err" value={filled} onChange={setFilled} invalid />
          </Field>
          <Field label="Disabled" htmlFor="p-dis" helper="Lighter than enabled, and still readable.">
            <TextInput id="p-dis" value="Not editable" onChange={() => undefined} disabled />
          </Field>
          <Field label="Select" htmlFor="p-sel">
            <Select id="p-sel" value={choice} onChange={setChoice}>
              <option value="one">Option one</option>
              <option value="two">Option two</option>
            </Select>
          </Field>
        </div>
      </section>

      {/* ---------------------------------------------------------------- buttons */}
      <section style={section}>
        <h2 style={heading}>Buttons — §3.11</h2>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="secondary">Secondary</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button variant="secondary" size="row-action">
            Row action 32px
          </Button>
          <Button variant="primary" size="page-header">
            Page header 40px
          </Button>
        </div>
      </section>

      {/* ------------------------------------------------- segments and status */}
      <section style={section}>
        <h2 style={heading}>Segmented control &amp; status pills — §3.13, §3.14</h2>
        <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center', flexWrap: 'wrap' }}>
          <SegmentedControl
            value={segment}
            onChange={setSegment}
            options={[
              { value: 'all', label: 'All' },
              { value: 'first', label: 'First' },
              { value: 'second', label: 'Second' },
            ]}
          />
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <StatusPill tone="pending">Pending</StatusPill>
            <StatusPill tone="confirmed">Confirmed</StatusPill>
            <StatusPill tone="dispatched">Dispatched</StatusPill>
            <StatusPill tone="cancelled">Cancelled</StatusPill>
            <StatusPill tone="neutral">Neutral</StatusPill>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- operational rows */}
      <section style={section}>
        <h2 style={heading}>Operational region — UX-060 / UX-071 / UX-073</h2>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-4)' }}>
          Narrow the window or zoom in. The row must scroll horizontally inside its own
          region and must never stack vertically. The identity column stays pinned. The
          pagination below sits OUTSIDE the scrolling region.
        </p>
        <Card>
          <OperationalRegion>
            <div style={{ minWidth: '1100px' }}>
              {['Row one', 'Row two', 'Row three'].map((label, index) => (
                <OperationalRow key={label}>
                  <RowIdentity>{label} — identity</RowIdentity>
                  <RowCell width="140px">Column A</RowCell>
                  <RowCell width="140px">Column B</RowCell>
                  <RowCell width="120px" numeric align="right">
                    1,234.56
                  </RowCell>
                  <RowCell width="120px" numeric align="right">
                    9,876.54
                  </RowCell>
                  <RowSpacer />
                  <StatusPill tone={index === 0 ? 'confirmed' : index === 1 ? 'pending' : 'neutral'}>
                    {index === 0 ? 'Confirmed' : index === 1 ? 'Pending' : 'Neutral'}
                  </StatusPill>
                  <ActionMenu
                    label="More actions"
                    actions={[
                      { label: 'Neutral action', onSelect: () => undefined },
                      { label: 'Another action', onSelect: () => undefined },
                      { label: 'Destructive action', onSelect: () => setDialog('destructive'), destructive: true, separatorBefore: true },
                    ]}
                  />
                </OperationalRow>
              ))}
            </div>
          </OperationalRegion>
        </Card>
        <Pagination total={3} page={page} pageSize={50} onPage={setPage} />
      </section>

      {/* ----------------------------------------------------------- overlays */}
      <section style={section}>
        <h2 style={heading}>Overlays — §3.19</h2>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Button variant="primary" onClick={() => setDialog('plain')}>
            Open confirmation
          </Button>
          <Button variant="destructive" onClick={() => setDialog('destructive')}>
            Open destructive confirmation
          </Button>
        </div>
      </section>

      {/* ------------------------------------------------------------- states */}
      <section style={section}>
        <h2 style={heading}>States — UX-140 / UX-141</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-7)' }}>
          <Card title="Loading">
            <LoadingState />
          </Card>
          <Card title="Empty">
            <EmptyState title="Nothing here" guidance="Guidance explaining what would appear and why it does not." />
          </Card>
          <Card title="Refusal">
            <RefusalState kind="refusal" reason="A refusal states the canonical reason; it is not styled as a malfunction." />
          </Card>
          <Card title="Forbidden">
            <RefusalState kind="forbidden" reason="Presented as authority, not as an error." />
          </Card>
        </div>
      </section>

      {dialog === 'plain' && (
        <ConfirmDialog
          title="Confirm this action?"
          consequence="The consequence is stated here, in full, before the confirming action is reachable."
          confirmLabel="Confirm"
          onConfirm={() => setDialog('none')}
          onCancel={() => setDialog('none')}
        />
      )}
      {dialog === 'destructive' && (
        <ConfirmDialog
          destructive
          title="Destructive action?"
          consequence="This names what will be lost and states plainly that it cannot be undone."
          confirmLabel="Yes, proceed"
          cancelLabel="Keep it"
          onConfirm={() => setDialog('none')}
          onCancel={() => setDialog('none')}
        />
      )}
    </div>
  );
}
