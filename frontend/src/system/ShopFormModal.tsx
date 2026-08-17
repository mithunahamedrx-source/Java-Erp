import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '../platform/api';
import { buttonStyle } from '../ui/primitives';
import { createShop, updateShop } from './shopApi';
import type { ChannelTypeOption, MarketOption, ShopDetail } from './shopApi';

/**
 * `SC-F` — the shop form ({@code SCS-010}).
 *
 * <p>🔴 A MODAL, AND IT HAS NO ROUTE. `SCS-010` gives Shops & Channels exactly two routed
 * surfaces; add and edit are one modal family opened from either of them. No `/new` and no
 * `/:id/edit` path exists anywhere in the router.
 *
 * <p>🔴 THREE OPERATOR INPUTS ({@code SCS-030.a}): display name, channel type and market.
 * There is NO credential field on this surface and none may be added ({@code SCS-052}).
 * Internal code, external account identity and external link are never typed
 * ({@code INV-16.4}, {@code INV-16.5}) — where the pack shows them, they are read-only facts
 * under *Assigned by Trioloo*.
 *
 * <p>🔴 {@code SCS-030.d} — SAVING NEITHER CREATES NOR CONTACTS THE REMOTE ACCOUNT.
 */
export function ShopFormModal({
  mode,
  shop,
  channelTypes,
  markets,
  onCancel,
  onSaved,
}: {
  readonly mode: 'add' | 'edit';
  /** Required in edit mode — the current values, and which of them are fixed. */
  readonly shop?: ShopDetail;
  readonly channelTypes: readonly ChannelTypeOption[];
  /** 🔴 `INV-16.7` — the CLOSED Market set, supplied by the server (`fetchMarketOptions`). */
  readonly markets: readonly MarketOption[];
  readonly onCancel: () => void;
  /** `SCS-030.f` — the caller decides where to go; the modal only reports what happened. */
  readonly onSaved: (id: string) => void;
}): React.JSX.Element {
  const [name, setName] = useState(shop?.name ?? '');
  const [channelType, setChannelType] = useState(shop?.channelType ?? '');
  const [market, setMarket] = useState(shop?.market ?? '');
  const [busy, setBusy] = useState(false);
  /** `SCS-030.e` — keyed BY FIELD, because the message belongs under the field. */
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreTo.current = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('input, select')?.focus();
    return () => restoreTo.current?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        // ⚠ A save already in flight cannot be un-started by closing, so Escape is ignored.
        if (!busy) onCancel();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      // Focus trap — the background is inert while the modal is open.
      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  /**
   * 🔴 `SCS-030` — CHANNEL TYPE AND MARKET ARE FIXED BY BUSINESS STATE, NOT BY THE FORM. The
   * server decides and says so; this reads its answer rather than re-deriving the rule.
   */
  const channelTypeFixed = mode === 'edit' && shop !== undefined && !shop.channelTypeChangeable;
  const marketFixed = mode === 'edit' && shop !== undefined && !shop.marketChangeable;

  async function save(): Promise<void> {
    setBusy(true);
    setFieldError(null);
    setFailure(null);
    try {
      const payload = { name, channelType, market };
      const id = mode === 'add' ? await createShop(payload) : await updateShop(shop!.id, payload);
      onSaved(id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        const body = error.payload as { field?: string; message?: string } | null;
        setFieldError({ field: body?.field || 'name', message: body?.message ?? error.message });
      } else {
        /* ⚠ A failure that is not about a field stays in place; the modal does not close. */
        setFailure(error instanceof ApiError ? error.message : 'The shop could not be saved.');
      }
      setBusy(false);
    }
  }

  const errorFor = (field: string): string | undefined =>
    fieldError?.field === field ? fieldError.message : undefined;

  return (
    <div
      data-testid="shop-form-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
        zIndex: 100,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'add' ? 'Add shop' : 'Edit shop'}
        data-testid="shop-form-modal"
        data-mode={mode}
        style={{
          width: '470px',
          maxWidth: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-control)',
          borderRadius: '12px',
          boxShadow: 'var(--elevation-overlay)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--color-divider-inner)', flexShrink: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-heading-ink)' }}>
            {mode === 'add' ? 'Add shop' : 'Edit shop'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '3px' }}>
            {mode === 'add'
              ? /* 🔴 The pack's exact statement of what this does and does not do. */
                'Registers one external operating shop in Trioloo. It does not create or contact the remote account.'
              : `${shop?.name} · ${shop?.code}`}
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) void save();
          }}
          style={{ display: 'contents' }}
        >
          <div style={{ padding: '16px 22px', overflowY: 'auto', minHeight: 0 }}>
            <FormField
              label="Shop display name"
              helper={
                mode === 'add'
                  ? 'How operators will recognise this account. Several shops may share a channel type, so name the business that runs it.'
                  : undefined
              }
              error={errorFor('name')}
            >
              <input
                data-testid="field-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={errorFor('name') ? 'Enter a name' : undefined}
                aria-label="Shop display name"
                aria-invalid={Boolean(errorFor('name'))}
                style={controlStyle(Boolean(errorFor('name')))}
              />
            </FormField>

            {/*
              🔴 `SCS-030.b` / `INV-15.4` — SELECTION FROM THE SET TRIOLOO RECOGNISES. It
              decides which adapter the shop will use, so it cannot be typed freely. The
              options come from the server, so this surface holds no copy of the set.
            */}
            <FormField
              label="Channel type"
              badge={channelTypeFixed ? 'FIXED' : undefined}
              helper={
                channelTypeFixed
                  ? 'This shop is in operational use, so its channel type can no longer change. Register a separate shop for a different channel.'
                  : mode === 'add'
                    ? 'Chosen from the channel types Trioloo recognises. It decides which adapter this shop will use, so it cannot be typed freely.'
                    : undefined
              }
              error={errorFor('channelType')}
              marginTop
            >
              {channelTypeFixed ? (
                <FixedValue testId="field-channel-type-fixed">
                  {channelTypes.find((type) => type.code === shop?.channelType)?.label ?? shop?.channelTypeLabel}
                </FixedValue>
              ) : (
                <select
                  data-testid="field-channel-type"
                  value={channelType}
                  onChange={(event) => setChannelType(event.target.value)}
                  aria-label="Channel type"
                  aria-invalid={Boolean(errorFor('channelType'))}
                  style={{ ...controlStyle(Boolean(errorFor('channelType'))), fontWeight: channelType ? 600 : 400 }}
                >
                  <option value="">Select a channel type</option>
                  {channelTypes.map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.label}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            {/*
              ⚠ `INV-16.7` requires the fact and states it is business configuration, but
              canon ratifies NO value set for it. A free-text required field invents nothing;
              a selector would require coining a market enumeration, which `CLAUDE.md §5`
              forbids. Reported with the implementation, not decided here.
            */}
            {/*
              🔴 `INV-16.7` — A CLOSED, ERP-SUPPLIED SET, ratified 2026-08-15. Market is
              business configuration and is SELECTED, never typed. The options come from the
              server, so this surface holds no copy of the set and cannot offer an unratified
              value. ⚠ One member today is the ratified set, not a placeholder; a second
              arrives by canonical amendment.
            */}
            <FormField
              label="Market"
              badge={marketFixed ? 'FIXED' : undefined}
              helper={marketFixed ? 'An external account is bound to this shop, so the market is settled.' : undefined}
              error={errorFor('market')}
              marginTop
            >
              {marketFixed ? (
                <FixedValue testId="field-market-fixed">{shop?.marketLabel ?? shop?.market}</FixedValue>
              ) : (
                <select
                  data-testid="field-market"
                  value={market}
                  onChange={(event) => setMarket(event.target.value)}
                  aria-label="Market"
                  aria-invalid={Boolean(errorFor('market'))}
                  style={{ ...controlStyle(Boolean(errorFor('market'))), fontWeight: market ? 600 : 400 }}
                >
                  <option value="">Select a market</option>
                  {markets.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </FormField>

            {mode === 'add' ? (
              /* `SCS-030.c` — the form STATES what save does, before it is pressed. */
              <div data-testid="what-happens-on-save" style={panelBoxStyle}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>
                  What happens on save
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.7, marginTop: '6px' }}>
                  The shop is created in Trioloo as Draft and Not connected.
                  <br />
                  Trioloo assigns its internal code.
                  <br />
                  You land on the shop page, where Connect binds the remote account.
                </div>
              </div>
            ) : (
              /*
                🔴 `INV-16.4` / `INV-16.5` — READ-ONLY, AND NEVER TYPED. The internal code is
                generated at creation; the link and its account come from the channel when the
                shop is authorised.
              */
              <div data-testid="assigned-by-trioloo" style={panelBoxStyle}>
                <div
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--color-text-muted)',
                    fontWeight: 700,
                  }}
                >
                  Assigned by Trioloo
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '9px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Internal code</div>
                    <div
                      data-testid="assigned-code"
                      style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '2px', fontFamily: 'var(--font-mono, monospace)' }}
                    >
                      {shop?.code}
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>External link</div>
                    {shop?.externalLink ? (
                      <a
                        data-testid="assigned-link"
                        href={shop.externalLink}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          marginTop: '2px',
                          color: 'var(--color-heading-ink)',
                          textDecoration: 'none',
                        }}
                      >
                        Visit link
                      </a>
                    ) : (
                      /* ⚠ `SYS-034` — absence is stated, never left blank or invented. */
                      <div data-testid="assigned-link" style={{ fontSize: '12.5px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        Not yet bound
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px', lineHeight: 1.6 }}>
                  Both are read-only here. The internal code is generated at creation; the external link and its
                  account come from the marketplace when the shop is authorised.
                </div>
              </div>
            )}

            {failure && (
              <div data-testid="shop-form-failure" style={{ fontSize: '12px', color: 'var(--color-destructive)', marginTop: '12px', lineHeight: 1.5 }}>
                {failure}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '9px',
              padding: '13px 22px',
              borderTop: '1px solid var(--color-divider-inner)',
              background: 'var(--color-strip)',
              flexShrink: 0,
            }}
          >
            <button type="button" data-testid="shop-form-cancel" onClick={onCancel} disabled={busy} style={buttonStyle('secondary', 'button', busy)}>
              Cancel
            </button>
            <button type="submit" data-testid="shop-form-submit" disabled={busy} style={buttonStyle('primary', 'button', busy)}>
              {busy ? 'Working…' : mode === 'add' ? 'Create shop' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * One field.
 *
 * <p>🔴 `SCS-030.e` — VALIDATION SITS UNDER THE FIELD IT BELONGS TO. There is no summary
 * banner anywhere in this modal. ⚠ The pack uses the black exception outline and NO colour
 * here, which is `RULE 3.18.f`'s field treatment — not a `Notice`, and not a departure from
 * `RULE 3.3.d`.
 */
function FormField({
  label,
  badge,
  helper,
  error,
  marginTop,
  children,
}: {
  readonly label: string;
  readonly badge?: string;
  readonly helper?: string;
  readonly error?: string;
  readonly marginTop?: boolean;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <div style={marginTop ? { marginTop: '14px' } : undefined}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '5px' }}>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</div>
        {badge && (
          <div
            data-testid="fixed-badge"
            style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-text-secondary)' }}
          >
            {badge}
          </div>
        )}
      </div>
      {children}
      {error && (
        <div
          data-testid="field-error"
          role="alert"
          style={{ fontSize: '11.5px', color: 'var(--color-heading-ink)', fontWeight: 600, marginTop: '5px' }}
        >
          {error}
        </div>
      )}
      {!error && helper && (
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '5px', lineHeight: 1.6 }}>
          {helper}
        </div>
      )}
    </div>
  );
}

/** 🔴 A FACT, NOT A CONTROL. A fixed value is never rendered as an input an operator can try. */
function FixedValue({ children, testId }: { readonly children: ReactNode; readonly testId: string }): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      style={{
        height: '36px',
        border: '1px solid var(--color-divider-inner)',
        background: 'var(--color-strip)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 11px',
        fontSize: '12.5px',
        color: 'var(--color-text-secondary)',
      }}
    >
      {children}
    </div>
  );
}

/** The pack's control geometry; the exception state is its 1.5px black outline. */
function controlStyle(invalid: boolean): React.CSSProperties {
  return {
    width: '100%',
    height: '36px',
    border: invalid ? '1.5px solid var(--color-ink)' : '1px solid var(--color-border-form-control)',
    borderRadius: '8px',
    padding: '0 11px',
    fontSize: '12.5px',
    fontFamily: 'inherit',
    color: 'var(--color-text-primary)',
    background: 'var(--color-surface)',
    boxSizing: 'border-box',
  };
}

const panelBoxStyle: React.CSSProperties = {
  border: '1px solid var(--color-divider-inner)',
  borderRadius: '9px',
  padding: '12px 14px',
  marginTop: '16px',
};
