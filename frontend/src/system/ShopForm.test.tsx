import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ShopsWorkspacePage from './ShopsWorkspacePage';
import { ShopFormModal } from './ShopFormModal';
import type { ChannelTypeOption, MarketOption, ShopDetail } from './shopApi';

/**
 * FRAME 02 — the shop form.
 *
 * <p>🔴 THE CLAIMS UNDER TEST are that this is a MODAL with no route, that it offers exactly
 * three operator inputs and NO credential field, that fixed facts render as facts rather than
 * controls, that validation sits under its field with no summary banner, and that a created
 * shop exits to its detail page.
 */

const CHANNEL_TYPES: readonly ChannelTypeOption[] = [
  { code: 'DARAZ', label: 'Daraz' },
  { code: 'WEBSITE', label: 'Website' },
  { code: 'SHOPIFY', label: 'Shopify' },
  { code: 'WOOCOMMERCE', label: 'WooCommerce' },
];

/** 🔴 `INV-16.7` — the CLOSED set, exactly as the server serves it. */
const MARKETS: readonly MarketOption[] = [{ code: 'BANGLADESH', label: 'Bangladesh' }];

const BOUND_SHOP: ShopDetail = {
  id: '44444444-4444-4444-4444-444444444444',
  code: 'CHN-000114',
  name: 'Zeon Mart · Daraz',
  channelType: 'DARAZ',
  channelTypeLabel: 'Daraz',
  market: 'BANGLADESH',
  marketLabel: 'Bangladesh',
  configuration: 'ACTIVE',
  connectionKnown: true,
  connection: 'CONNECTED',
  connectionLastCheckedAt: null,
  externalAccountIdentity: 'zeonmart_bd',
  externalLink: 'https://daraz.example/zeonmart',
  boundAt: '2026-03-12T05:00:00Z',
  authorisedAt: '2026-03-12T05:00:00Z',
  activatedAt: '2026-03-12T05:10:00Z',
  activatedByName: 'A. Rahman',
  channelTypeChangeable: false,
  marketChangeable: false,
  activatable: false,
  activationBlockedReason: 'This shop has already been activated.',
  authorisationSupported: false,
  authorisationUnsupportedReason: 'Trioloo cannot yet sign in to Daraz accounts.',
};

const UNBOUND_DRAFT: ShopDetail = {
  ...BOUND_SHOP,
  id: '55555555-5555-5555-5555-555555555555',
  code: 'CHN-000300',
  name: 'Friday PC · Daraz',
  configuration: 'DRAFT',
  connection: 'NOT_CONNECTED',
  externalAccountIdentity: null,
  externalLink: null,
  boundAt: null,
  authorisedAt: null,
  activatedAt: null,
  activatedByName: null,
  channelTypeChangeable: true,
  marketChangeable: true,
  activatable: false,
  activationBlockedReason: 'Connect the account first — an active shop must have a verified account.',
};

let requests: { url: string; method: string; body: unknown }[] = [];

function stubApi(options: { readonly createStatus?: number; readonly createBody?: unknown } = {}): void {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({
        url,
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      const json = (body: unknown, status = 200): Response =>
        new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/auth/me')) {
        return json({
          id: 'dev',
          username: 'devuser',
          fullName: 'Dev User',
          roles: [],
          permissions: ['system.channel-instance.view', 'system.channel-instance.manage'],
        });
      }
      if (url.includes('/api/auth/csrf')) return new Response(null, { status: 204 });
      if (url.includes('/channel-types')) return json(CHANNEL_TYPES);
      if (url.includes('/markets')) return json(MARKETS);
      if (url.includes('/summary')) {
        return json({
          allShops: { channelTypeCount: 0, shopCount: 0, configurationSplit: [] },
          channelTypes: [],
          connectionKnown: true,
        });
      }
      if ((init?.method ?? 'GET') === 'POST' && url.includes('/api/system/shops')) {
        if (options.createStatus && options.createStatus !== 201) {
          return json(options.createBody ?? { message: 'no' }, options.createStatus);
        }
        return json({ id: '99999999-9999-9999-9999-999999999999' }, 201);
      }
      if ((init?.method ?? 'GET') === 'PUT') return new Response(null, { status: 204 });
      if (url.includes('/api/system/shops')) {
        /*
          ⚠ Deliberately POPULATED. `SCS-025.a` puts an Add Shop action inside the EMPTY
          state as well, so an empty workspace legitimately renders two of them — which
          would make "the" add button ambiguous here rather than proving anything.
        */
        return json({
          content: [
            {
              id: UNBOUND_DRAFT.id,
              code: UNBOUND_DRAFT.code,
              name: UNBOUND_DRAFT.name,
              channelType: 'DARAZ',
              channelTypeLabel: 'Daraz',
              configuration: 'DRAFT',
              connection: 'NOT_CONNECTED',
              externalLink: null,
              bound: false,
            },
          ],
          page: 0,
          size: 50,
          totalElements: 1,
          totalPages: 1,
          totalRegistered: 1,
        });
      }
      return json({});
    }),
  );
}

function renderWorkspace(): void {
  render(
    <MemoryRouter initialEntries={['/administration/shops']}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/administration/shops" element={<ShopsWorkspacePage />} />
            <Route path="/administration/shops/:id" element={<div data-testid="detail-page">detail</div>} />
          </Routes>
        </PageActionsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function renderModal(props: Partial<Parameters<typeof ShopFormModal>[0]> = {}): {
  cancel: ReturnType<typeof vi.fn>;
  saved: ReturnType<typeof vi.fn>;
} {
  const cancel = vi.fn();
  const saved = vi.fn();
  render(
    <MemoryRouter>
      <ShopFormModal
        mode="add"
        channelTypes={CHANNEL_TYPES}
        markets={MARKETS}
        onCancel={cancel}
        onSaved={saved}
        {...(props as Record<string, never>)}
      />
    </MemoryRouter>,
  );
  return { cancel, saved };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SC-F — a modal with no route', () => {
  /** 🔴 `SCS-010` — Add Shop opens the modal IN PLACE. It navigates nowhere. */
  it('SCS-010 Add Shop opens the modal without leaving the workspace', async () => {
    stubApi();
    renderWorkspace();

    await waitFor(() => expect(screen.getByTestId('add-shop')).toBeTruthy());
    fireEvent.click(screen.getByTestId('add-shop'));

    await waitFor(() => expect(screen.getByTestId('shop-form-modal')).toBeTruthy());
    expect(screen.queryByTestId('detail-page')).toBeNull();
    // Still the workspace: its own controls are behind the modal.
    expect(screen.getByTestId('shop-search')).toBeTruthy();
  });

  it('the modal is a labelled, modal dialog', () => {
    renderModal();
    const dialog = screen.getByTestId('shop-form-modal');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('Escape and Cancel both dismiss', () => {
    const { cancel } = renderModal();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(cancel).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('shop-form-cancel'));
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});

describe('SCS-030 — the add state', () => {
  /** 🔴 `SCS-030.a` — THREE OPERATOR INPUTS, AND NO MORE. */
  it('SCS-030.a offers exactly three operator inputs', () => {
    renderModal();
    expect(screen.getByTestId('field-name')).toBeTruthy();
    expect(screen.getByTestId('field-channel-type')).toBeTruthy();
    expect(screen.getByTestId('field-market')).toBeTruthy();

    const controls = screen.getByTestId('shop-form-modal').querySelectorAll('input, select, textarea');
    expect(controls).toHaveLength(3);
  });

  /** 🔴 `SCS-030` — the internal code and account identity are ABSENT from the add form. */
  it('SCS-030 the add form has no code, account, link or credential field', () => {
    renderModal();
    const text = screen.getByTestId('shop-form-modal').textContent ?? '';
    for (const forbidden of ['App Key', 'App Secret', 'Access token', 'Refresh token', 'Password', 'Internal code']) {
      expect(text).not.toContain(forbidden);
    }
    expect(screen.queryByTestId('assigned-by-trioloo')).toBeNull();
  });

  /** 🔴 `SCS-030.b` — a CLOSED SET. The only way to supply a value is to select one. */
  it('SCS-030.b channel type is a selector over the offered set, never free text', () => {
    renderModal();
    const select = screen.getByTestId('field-channel-type') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect([...select.options].map((option) => option.value)).toEqual([
      '',
      'DARAZ',
      'WEBSITE',
      'SHOPIFY',
      'WOOCOMMERCE',
    ]);
  });

  /**
   * 🔴 `INV-16.7` — MARKET IS A SELECTOR OVER A CLOSED SET, NOT A TEXT FIELD. The approved
   * design renders it as a selector, and free text is forbidden.
   */
  it('INV-16.7 market is a selector, never a free-text input', () => {
    renderModal();
    const market = screen.getByTestId('field-market') as HTMLSelectElement;
    expect(market.tagName).toBe('SELECT');
    expect(market.getAttribute('type')).toBeNull();
  });

  /** 🔴 EXACTLY ONE CURRENT MEMBER. No unratified market may appear anywhere. */
  it('INV-16.7 the market selector offers Bangladesh and nothing else', () => {
    renderModal();
    const market = screen.getByTestId('field-market') as HTMLSelectElement;
    expect([...market.options].map((option) => option.value)).toEqual(['', 'BANGLADESH']);
    expect([...market.options].map((option) => option.textContent)).toEqual([
      'Select a market',
      'Bangladesh',
    ]);
    for (const unratified of ['India', 'Pakistan', 'Global', 'International', 'Asia', 'United States']) {
      expect(screen.getByTestId('shop-form-modal').textContent).not.toContain(unratified);
    }
  });

  it('SCS-030.b the helper states why the channel type cannot be typed', () => {
    renderModal();
    expect(screen.getByTestId('shop-form-modal').textContent).toContain(
      'It decides which adapter this shop will use, so it cannot be typed freely.',
    );
  });

  /** `SCS-030.c` — the form STATES what save does before it is pressed. */
  it('SCS-030.c the add form states the initial state save produces', () => {
    renderModal();
    const panel = screen.getByTestId('what-happens-on-save').textContent ?? '';
    expect(panel).toContain('Draft and Not connected');
    expect(panel).toContain('Trioloo assigns its internal code');
    expect(panel).toContain('Connect binds the remote account');
  });

  /** 🔴 `SCS-030.d` — it neither creates nor contacts the remote account. */
  it('SCS-030.d the add form says it does not contact the remote account', () => {
    renderModal();
    expect(screen.getByTestId('shop-form-modal').textContent).toContain(
      'It does not create or contact the remote account.',
    );
  });

  /** 🔴 The request carries THREE FIELDS. Nothing else can reach the server from here. */
  it('SCS-030 saving posts exactly the three operator inputs', async () => {
    stubApi();
    renderWorkspace();
    await waitFor(() => expect(screen.getByTestId('add-shop')).toBeTruthy());
    fireEvent.click(screen.getByTestId('add-shop'));
    await waitFor(() => expect(screen.getByTestId('field-name')).toBeTruthy());

    fireEvent.change(screen.getByTestId('field-name'), { target: { value: 'Trioloo · Daraz' } });
    fireEvent.change(screen.getByTestId('field-channel-type'), { target: { value: 'DARAZ' } });
    fireEvent.change(screen.getByTestId('field-market'), { target: { value: 'BANGLADESH' } });
    fireEvent.click(screen.getByTestId('shop-form-submit'));

    await waitFor(() => expect(requests.some((r) => r.method === 'POST')).toBe(true));
    const post = requests.find((r) => r.method === 'POST' && r.url.includes('/api/system/shops'));
    /* 🔴 The CANONICAL CODE crosses the wire, never the display label. */
    expect(post?.body).toEqual({ name: 'Trioloo · Daraz', channelType: 'DARAZ', market: 'BANGLADESH' });
  });

  /** 🔴 `SCS-030.f` — a CREATED shop exits to its detail page. */
  it('SCS-030.f a created shop routes to its detail page', async () => {
    stubApi();
    renderWorkspace();
    await waitFor(() => expect(screen.getByTestId('add-shop')).toBeTruthy());
    fireEvent.click(screen.getByTestId('add-shop'));
    await waitFor(() => expect(screen.getByTestId('field-name')).toBeTruthy());

    fireEvent.change(screen.getByTestId('field-name'), { target: { value: 'Trioloo' } });
    fireEvent.change(screen.getByTestId('field-channel-type'), { target: { value: 'DARAZ' } });
    fireEvent.change(screen.getByTestId('field-market'), { target: { value: 'BANGLADESH' } });
    fireEvent.click(screen.getByTestId('shop-form-submit'));

    await waitFor(() => expect(screen.getByTestId('detail-page')).toBeTruthy());
  });
});

describe('SCS-030 — the edit state', () => {
  /** 🔴 A FIXED FACT IS RENDERED AS A FACT, never as a control the operator can try. */
  it('SCS-030 a bound shop shows channel type and market as FIXED, not as inputs', () => {
    renderModal({ mode: 'edit', shop: BOUND_SHOP });

    expect(screen.queryByTestId('field-channel-type')).toBeNull();
    expect(screen.queryByTestId('field-market')).toBeNull();
    expect(screen.getByTestId('field-channel-type-fixed').textContent).toBe('Daraz');
    expect(screen.getByTestId('field-market-fixed').textContent).toBe('Bangladesh');
    expect(screen.getAllByTestId('fixed-badge')).toHaveLength(2);
  });

  it('SCS-030 each fixed field states WHY it is fixed', () => {
    renderModal({ mode: 'edit', shop: BOUND_SHOP });
    const text = screen.getByTestId('shop-form-modal').textContent ?? '';
    expect(text).toContain('This shop is in operational use, so its channel type can no longer change.');
    expect(text).toContain('An external account is bound to this shop, so the market is settled.');
  });

  /** ⚠ Before an account is bound nothing is settled, so both remain editable. */
  it('SCS-030 an unbound draft still offers both controls', () => {
    renderModal({ mode: 'edit', shop: UNBOUND_DRAFT });

    expect(screen.getByTestId('field-channel-type')).toBeTruthy();
    expect(screen.getByTestId('field-market')).toBeTruthy();
    expect(screen.queryByTestId('fixed-badge')).toBeNull();
  });

  /**
   * 🔴 `INV-16.7` — a bound shop shows the canonical LABEL as a FIXED FACT, never a control.
   */
  it('INV-16.7 a bound shop shows Bangladesh as fixed, using the display label', () => {
    renderModal({ mode: 'edit', shop: BOUND_SHOP });

    expect(screen.queryByTestId('field-market')).toBeNull();
    const fixed = screen.getByTestId('field-market-fixed');
    expect(fixed.textContent).toBe('Bangladesh');
    // 🔴 The label is rendered, never the persisted code.
    expect(fixed.textContent).not.toBe('BANGLADESH');
  });

  /** 🔴 `INV-16.4` / `INV-16.5` — read-only, and stated as generated rather than entered. */
  it('SCS-030 the assigned block shows the code and link as read-only facts', () => {
    renderModal({ mode: 'edit', shop: BOUND_SHOP });

    const assigned = screen.getByTestId('assigned-by-trioloo');
    expect(assigned.textContent).toContain('Assigned by Trioloo');
    expect(screen.getByTestId('assigned-code').textContent).toBe('CHN-000114');
    expect(screen.getByTestId('assigned-link').textContent).toContain('Visit link');
    expect(assigned.querySelectorAll('input, select')).toHaveLength(0);
  });

  /** ⚠ `SYS-034` — where nothing is bound, absence is STATED, never blank or invented. */
  it('SYS-034 an unbound shop states that no link exists yet', () => {
    renderModal({ mode: 'edit', shop: UNBOUND_DRAFT });
    expect(screen.getByTestId('assigned-link').textContent).toBe('Not yet bound');
  });

  /** 🔴 The account IDENTITY is never an editable field on this surface (`INV-16.5`). */
  it('INV-16.5 the bound account identity is never an input', () => {
    renderModal({ mode: 'edit', shop: BOUND_SHOP });
    const inputs = [...screen.getByTestId('shop-form-modal').querySelectorAll('input, select')];
    for (const input of inputs) {
      expect((input as HTMLInputElement).value).not.toBe('zeonmart_bd');
    }
  });

  it('the edit footer commits rather than creates', () => {
    renderModal({ mode: 'edit', shop: BOUND_SHOP });
    expect(screen.getByTestId('shop-form-submit').textContent).toBe('Save changes');
  });
});

describe('SCS-030.e — validation', () => {
  /**
   * 🔴 THE MESSAGE SITS UNDER ITS FIELD, AND THERE IS NO SUMMARY BANNER. A summary would be a
   * generic error surface the approved design explicitly does not use.
   */
  it('SCS-030.e a field failure renders under that field, with no summary banner', async () => {
    stubApi({ createStatus: 400, createBody: { field: 'name', message: 'A shop needs a name operators can recognise.' } });
    renderWorkspace();
    await waitFor(() => expect(screen.getByTestId('add-shop')).toBeTruthy());
    fireEvent.click(screen.getByTestId('add-shop'));
    await waitFor(() => expect(screen.getByTestId('field-name')).toBeTruthy());

    fireEvent.change(screen.getByTestId('field-channel-type'), { target: { value: 'DARAZ' } });
    fireEvent.click(screen.getByTestId('shop-form-submit'));

    await waitFor(() => expect(screen.getByTestId('field-error')).toBeTruthy());
    expect(screen.getByTestId('field-error').textContent).toBe('A shop needs a name operators can recognise.');
    expect(screen.getByTestId('field-name').getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByTestId('shop-form-failure')).toBeNull();
  });

  it('SCS-030.e a validation failure keeps the modal open and the values entered', async () => {
    stubApi({ createStatus: 400, createBody: { field: 'channelType', message: 'Choose the channel this shop operates on.' } });
    renderWorkspace();
    await waitFor(() => expect(screen.getByTestId('add-shop')).toBeTruthy());
    fireEvent.click(screen.getByTestId('add-shop'));
    await waitFor(() => expect(screen.getByTestId('field-name')).toBeTruthy());

    fireEvent.change(screen.getByTestId('field-name'), { target: { value: 'Kept' } });
    fireEvent.click(screen.getByTestId('shop-form-submit'));

    await waitFor(() => expect(screen.getByTestId('field-error')).toBeTruthy());
    expect(screen.getByTestId('shop-form-modal')).toBeTruthy();
    expect((screen.getByTestId('field-name') as HTMLInputElement).value).toBe('Kept');
    expect(screen.queryByTestId('detail-page')).toBeNull();
  });
});
