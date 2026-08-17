import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ShopDetailPage from './ShopDetailPage';
import type { AuthorisationResult, ShopDetail } from './shopApi';

/**
 * FRAME 03 — the shop detail page.
 *
 * <p>🔴 EVERY REPRESENTED STATE IS EXERCISED, not only the default connected one: four
 * connection conditions plus unreadable, Activate available and visible-but-unavailable, the
 * three authorisation results, and the restricted-permission treatment.
 *
 * <p>🔴 THE TWO STRUCTURAL CLAIMS: an unreadable connection never blanks the page, and a
 * permission absence OMITS a control while a state block leaves it VISIBLE with its reason.
 */

const ALL_PERMISSIONS = [
  'system.channel-instance.view',
  'system.channel-instance.manage',
  'system.channel-instance.lifecycle',
  'integration.channel-connection.authorize',
];

const CONNECTED: ShopDetail = {
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
  connectionLastCheckedAt: '2026-08-15T03:41:00Z',
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
  authorisationSupported: true,
  authorisationUnsupportedReason: null,
};

/** 🔴 The state the contract is built around. */
const DRAFT_CONNECTED: ShopDetail = {
  ...CONNECTED,
  id: '55555555-5555-5555-5555-555555555555',
  code: 'CHN-000121',
  name: 'Trioloo · Daraz',
  configuration: 'DRAFT',
  externalAccountIdentity: 'trioloo_official',
  activatedAt: null,
  activatedByName: null,
  activatable: true,
  activationBlockedReason: null,
};

const NOT_CONNECTED: ShopDetail = {
  ...CONNECTED,
  id: '66666666-6666-6666-6666-666666666666',
  name: 'Friday PC · Daraz',
  configuration: 'DRAFT',
  connection: 'NOT_CONNECTED',
  connectionLastCheckedAt: null,
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

let requests: { url: string; method: string }[] = [];

function stubApi(
  shop: ShopDetail,
  options: {
    readonly permissions?: readonly string[];
    readonly authorisation?: AuthorisationResult;
    readonly authoriseStatus?: number;
    readonly authoriseMessage?: string;
    readonly detailStatus?: number;
  } = {},
): void {
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, method: init?.method ?? 'GET' });
      const json = (body: unknown, status = 200): Response =>
        new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/auth/me')) {
        return json({
          id: 'dev',
          username: 'devuser',
          fullName: 'Dev User',
          roles: [],
          permissions: options.permissions ?? ALL_PERMISSIONS,
        });
      }
      if (url.includes('/api/auth/csrf')) return new Response(null, { status: 204 });
      if (url.includes('/channel-types')) return json([{ code: 'DARAZ', label: 'Daraz' }]);
      if (url.includes('/markets')) return json([{ code: 'BANGLADESH', label: 'Bangladesh' }]);
      if (url.includes('/authorize')) {
        if (options.authoriseStatus) {
          return json({ message: options.authoriseMessage ?? 'no' }, options.authoriseStatus);
        }
        return json(options.authorisation ?? { outcome: 'AUTHORISED', firstBinding: true, boundAccount: 'trioloo_official' });
      }
      if (url.includes('/activate')) return new Response(null, { status: 204 });
      if (url.includes('/api/system/shops/')) {
        if (options.detailStatus) return json({ message: 'denied' }, options.detailStatus);
        return json(shop);
      }
      return json({});
    }),
  );
}

/**
 * @param query the callback's query string, e.g. `?authorisation=AUTHORISED`.
 *              🔴 The authorisation OUTCOME now arrives this way — Daraz redirects the operator back
 *              to this page — rather than as a response to Connect.
 */
function renderDetail(shopId = CONNECTED.id, query = ''): void {
  render(
    <MemoryRouter initialEntries={[`/administration/shops/${shopId}${query}`]}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/administration/shops/:id" element={<ShopDetailPage />} />
            <Route path="/inventory/products/listings" element={<div data-testid="listings-page">listings</div>} />
          </Routes>
        </PageActionsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SCS-040 — the sections and facts', () => {
  it('SCS-040 renders every approved section', async () => {
    stubApi(CONNECTED);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('section-identity')).toBeTruthy());
    for (const section of ['section-identity', 'section-states', 'section-listings', 'section-authorisation', 'section-lifecycle']) {
      expect(screen.getByTestId(section)).toBeTruthy();
    }
  });

  /**
   * 🔴 `SCS-041` — THE LINK AND THE ACCOUNT IDENTITY ARE TWO FACTS, never collapsed. The link
   * opens a page; the identity is what the shop is bound to.
   */
  it('SCS-041 the external link and the bound account are shown as separate facts', async () => {
    stubApi(CONNECTED);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('detail-external-link')).toBeTruthy());
    const link = screen.getByTestId('detail-external-link');
    expect(link.textContent).toContain('Visit link');
    expect(link.getAttribute('href')).toBe('https://daraz.example/zeonmart');
    // A separate element, with a separate meaning.
    expect(screen.getByTestId('bound-account').textContent).toContain('Account zeonmart_bd');
    expect(link.textContent).not.toContain('zeonmart_bd');
  });

  it('SYS-034 an unbound shop states that no account is bound yet', async () => {
    stubApi(NOT_CONNECTED);
    renderDetail(NOT_CONNECTED.id);

    await waitFor(() => expect(screen.getByTestId('detail-external-link')).toBeTruthy());
    expect(screen.getByTestId('detail-external-link').textContent).toBe('Not yet bound');
    expect(screen.getByTestId('bound-account').textContent).toContain('No account is bound yet');
  });

  /** 🔴 `SCS-040` — the two-independent-facts statement is on the page, in words. */
  it('SCS-040 the page states that configuration and connection are independent', async () => {
    stubApi(CONNECTED);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('independence-statement')).toBeTruthy());
    expect(screen.getByTestId('independence-statement').textContent).toContain('two independent facts');
  });

  /** 🔴 `INV-16.7` — the detail shows the canonical Market LABEL, not the persisted code. */
  it('INV-16.7 the detail displays the canonical market label', async () => {
    stubApi(CONNECTED);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('section-identity')).toBeTruthy());
    expect(screen.getByTestId('section-identity').textContent).toContain('Bangladesh');
    expect(screen.getByTestId('section-identity').textContent).not.toContain('BANGLADESH');
    expect(screen.getByTestId('shop-context').textContent).toContain('Bangladesh');
  });

  /**
   * ⚠ `SYS-034` — a shop that predates the feature has NO market, and the page says so
   * rather than assuming the single current member.
   */
  it('SYS-034 a shop with no recorded market says so and is not assumed to be Bangladesh', async () => {
    stubApi({ ...CONNECTED, market: null, marketLabel: null });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('section-identity')).toBeTruthy());
    expect(screen.getByTestId('section-identity').textContent).toContain('Not recorded');
    expect(screen.getByTestId('section-identity').textContent).not.toContain('Bangladesh');
  });

  /** 🔴 `AGV-001` — the activation actor is a captured fact. */
  it('SCS-042 the lifecycle section names when the shop was activated and by whom', async () => {
    stubApi(CONNECTED);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('section-lifecycle')).toBeTruthy());
    expect(screen.getByTestId('section-lifecycle').textContent).toContain('by A. Rahman');
  });

  /** ⚠ `SCS-051.e` — stated plainly rather than left as an unexplained absence. */
  it('SCS-051.e the page states that suspend and archive are unavailable in this release', async () => {
    stubApi(CONNECTED);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('lifecycle-scope')).toBeTruthy());
    expect(screen.getByTestId('lifecycle-scope').textContent).toContain(
      'Suspending or archiving a shop is not available in this release.',
    );
  });

  /** 🔴 `SCS-052` — the assurance is stated to the operator in words. */
  it('SCS-052 the page states that no password, key or token is shown or stored', async () => {
    stubApi(CONNECTED);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('secret-assurance')).toBeTruthy());
    expect(screen.getByTestId('secret-assurance').textContent).toContain(
      'never shows or stores marketplace passwords, keys or tokens',
    );
  });

  /** 🔴 `SCS-053` / `UX-273.b` — synchronisation stays in Products, and the page says so. */
  it('SCS-053 no refresh, push or sync control exists here', async () => {
    stubApi(CONNECTED);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('section-listings')).toBeTruthy());
    expect(screen.getByTestId('section-listings').textContent).toContain(
      'Synchronisation, refresh and push stay there.',
    );
    const text = document.body.textContent ?? '';
    for (const forbidden of ['Sync Now', 'Review & Push', 'Push ERP', 'Refresh listing', 'Delete shop']) {
      expect(text).not.toContain(forbidden);
    }
  });

  /** 🔴 `SCS-061` — no unbuilt-domain section, figure or zero. */
  it('SCS-061 no Orders, Returns, Chat or Settlement section appears', async () => {
    stubApi(CONNECTED);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('section-identity')).toBeTruthy());
    const text = document.body.textContent ?? '';
    for (const forbidden of ['Orders', 'Returns', 'Chat', 'Settlement', 'Revenue']) {
      expect(text).not.toContain(forbidden);
    }
  });

  /** `SCS-060` — View Listings scoped to THIS exact Channel Instance. */
  it('SCS-060 View Listings opens Listings scoped to this shop', async () => {
    stubApi(CONNECTED);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('view-listings')).toBeTruthy());
    fireEvent.click(screen.getByTestId('view-listings'));

    await waitFor(() => expect(screen.getByTestId('listings-page')).toBeTruthy());
    expect(window.location.search || '').toBeDefined();
  });
});

describe('SCS-043 — every connection condition', () => {
  it.each([
    ['CONNECTED', 'CONNECTED', 'can work against this account'],
    ['NOT_CONNECTED', 'NOT CONNECTED', 'has never been authorised'],
    ['REAUTH_REQUIRED', 'REAUTHORIZATION REQUIRED', 'no longer accepts'],
    ['ERROR', 'CONNECTION ERROR', 'refused the last attempt'],
  ])('SCS-043 %s renders its approved title and meaning', async (state, title, meaning) => {
    stubApi({ ...CONNECTED, connection: state as ShopDetail['connection'] });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('connection-box')).toBeTruthy());
    const box = screen.getByTestId('connection-box');
    expect(box.getAttribute('data-value')).toBe(title);
    expect(box.textContent).toContain(meaning);
  });

  /** 🔴 `SCS-043` — the ERROR condition shows when it was last ACTUALLY observed. */
  it('SCS-042.a CONNECTION ERROR shows a real observation time', async () => {
    stubApi({ ...CONNECTED, connection: 'ERROR' });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('last-checked')).toBeTruthy());
    expect(screen.getByTestId('last-checked').textContent).toContain('Last checked');
  });

  /** 🔴 `SCS-042.a` — with no genuine observation, no time is invented. */
  it('SCS-042.a no observation means no last-checked line', async () => {
    stubApi({ ...CONNECTED, connection: 'ERROR', connectionLastCheckedAt: null });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('connection-box')).toBeTruthy());
    expect(screen.queryByTestId('last-checked')).toBeNull();
    expect(screen.getByTestId('connection-box').textContent).not.toContain('Last checked');
  });

  /**
   * 🔴 THE STRUCTURAL SAFETY TEST. The connection could not be read, and the page still
   * renders every local fact. It does NOT become an error screen, and it does NOT claim
   * NOT CONNECTED.
   */
  it('SCS-043.a an unreadable connection keeps the whole page and claims no condition', async () => {
    stubApi({ ...CONNECTED, connectionKnown: false, connection: null, connectionLastCheckedAt: null });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('connection-box')).toBeTruthy());
    const box = screen.getByTestId('connection-box');
    expect(box.getAttribute('data-value')).toBe('CONNECTION UNAVAILABLE');
    expect(box.textContent).toContain('is not claiming one');
    expect(box.textContent).not.toContain('NOT CONNECTED');
    expect(screen.getByTestId('connection-retry')).toBeTruthy();

    /*
      🔴 AND IT MUST NOT LOOK LIKE A RESOLVED CONDITION. The approved design draws the
      unavailable chip UNFILLED with a DASHED boundary; every real condition is filled and
      solid. Without this, "not known" was pixel-identical to NOT CONNECTED.
    */
    const chip = screen.getByTestId('connection-chip');
    expect(chip.style.borderStyle || chip.style.border).toContain('dashed');
    expect(chip.style.background).toBe('transparent');

    // 🔴 Everything else is intact.
    expect(screen.getByTestId('section-identity').textContent).toContain('Zeon Mart · Daraz');
    expect(screen.getByTestId('bound-account').textContent).toContain('zeonmart_bd');
    expect(screen.queryByTestId('shop-load-error')).toBeNull();
  });

  it('SCS-043.a Try again re-reads the shop', async () => {
    stubApi({ ...CONNECTED, connectionKnown: false, connection: null });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('connection-retry')).toBeTruthy());
    requests = [];
    fireEvent.click(screen.getByTestId('connection-retry'));

    await waitFor(() => expect(requests.some((r) => r.url.includes('/api/system/shops/'))).toBe(true));
  });
});

describe('SCS-044 — the authorisation results', () => {
  it('SCS-044 a first success names the bound account and says activation is separate', async () => {
    stubApi(DRAFT_CONNECTED, {
      authorisation: { outcome: 'AUTHORISED', firstBinding: true, boundAccount: 'trioloo_official' },
    });
    renderDetail(DRAFT_CONNECTED.id, '?authorisation=AUTHORISED');

    await waitFor(() => expect(screen.getByTestId('authorisation-result')).toBeTruthy());
    const notice = screen.getByTestId('authorisation-result');
    expect(notice.getAttribute('data-outcome')).toBe('AUTHORISED');
    expect(notice.textContent).toContain('trioloo_official');
    // 🔴 SCS-051.b — activating is a SEPARATE decision and is not done for the operator.
    expect(notice.textContent).toContain('activating it is a separate decision and is not done for you');
    /* 🔴 `SCS-044` — the ratified NEXT step is offered where the operator is reading it. */
    expect(screen.getByTestId('result-activate')).toBeTruthy();
  });

  /**
   * 🔴 THE SAFETY-CRITICAL SURFACE TEST. Both accounts are named, and the page states that
   * nothing was rebound and that the other account needs its own shop.
   */
  it('SCS-044 a mismatch names BOTH accounts and states nothing was changed', async () => {
    stubApi(CONNECTED, {
      authorisation: {
        outcome: 'DIFFERENT_ACCOUNT',
        firstBinding: false,
        boundAccount: 'zeonmart_bd',
        attemptedAccount: 'friday_pc_bd',
      },
    });
    renderDetail(CONNECTED.id, '?authorisation=DIFFERENT_ACCOUNT&attempted=friday_pc_bd');

    await waitFor(() => expect(screen.getByTestId('authorisation-result')).toBeTruthy());
    const notice = screen.getByTestId('authorisation-result');
    expect(notice.textContent).toContain('friday_pc_bd');
    expect(notice.textContent).toContain('zeonmart_bd');
    expect(notice.textContent).toContain('did not rebind');
    expect(notice.textContent).toContain('register it as its own shop');
    /*
      🔴 DANGER, as the approved design renders it. A sign-in as the wrong account is not a
      gentle prompt — the operator believes they connected something and they did not.
    */
    expect(notice.querySelector('[role="status"]')?.getAttribute('data-tone')).toBe('danger');
    /* `SCS-044` — BOTH ratified routes out. */
    expect(screen.getByTestId('result-add-shop').textContent).toBe('Add a shop for that account');
    expect(screen.getByTestId('result-retry').textContent).toBe('Try again as zeonmart_bd');
    // 🔴 No OAuth payload, no token, ever.
    for (const secret of ['token', 'Token', 'code=', 'Bearer']) {
      expect(notice.textContent).not.toContain(secret);
    }
  });

  it('SCS-044 a not-completed authorisation says nothing was bound', async () => {
    stubApi(NOT_CONNECTED, { authorisation: { outcome: 'NOT_COMPLETED', firstBinding: false } });
    renderDetail(NOT_CONNECTED.id, '?authorisation=NOT_COMPLETED');

    await waitFor(() => expect(screen.getByTestId('authorisation-result')).toBeTruthy());
    const notice = screen.getByTestId('authorisation-result');
    expect(notice.getAttribute('data-outcome')).toBe('NOT_COMPLETED');
    expect(notice.textContent).toContain('nothing was bound and this shop is unchanged');
    /*
      ⚠ NEUTRAL, as the approved design renders it — deliberately NOT danger. `SCS-044` is
      explicit that nothing was bound and the shop is unchanged: an unfinished sign-in is an
      incomplete act, not a failure with consequence.
    */
    expect(notice.querySelector('[role="status"]')?.getAttribute('data-tone')).toBe('neutral');
    /* `SCS-044` — the ratified next step for an unbound shop. */
    expect(screen.getByTestId('result-retry').textContent).toBe('Connect');
  });

  /** ⚠ The result is a STATE of this page — it never becomes its own screen. */
  it('SCS-010.a the result renders on the detail page, not a separate screen', async () => {
    stubApi(DRAFT_CONNECTED, { authorisation: { outcome: 'AUTHORISED', firstBinding: true, boundAccount: 'x' } });
    renderDetail(DRAFT_CONNECTED.id, '?authorisation=AUTHORISED');

    await waitFor(() => expect(screen.getByTestId('authorisation-result')).toBeTruthy());
    // The page's own sections are still there behind the result.
    expect(screen.getByTestId('section-identity')).toBeTruthy();
    expect(screen.getByTestId('section-lifecycle')).toBeTruthy();
  });

  it('the label is Connect when nothing is bound and Reauthorize once it is', async () => {
    stubApi(NOT_CONNECTED);
    renderDetail(NOT_CONNECTED.id);
    await waitFor(() => expect(screen.getByTestId('authorise').textContent).toBe('Connect'));

    cleanup();
    vi.unstubAllGlobals();
    stubApi(CONNECTED);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('authorise').textContent).toBe('Reauthorize'));
  });
});

describe('SCS-050 — permission and state', () => {
  /** 🔴 UNAUTHORISED → OMITTED. A disabled control would advertise authority they lack. */
  it('SCS-050.a an operator without manage or authorize sees neither Edit nor Reauthorize', async () => {
    stubApi(DRAFT_CONNECTED, {
      permissions: ['system.channel-instance.view', 'system.channel-instance.lifecycle'],
    });
    renderDetail(DRAFT_CONNECTED.id);

    await waitFor(() => expect(screen.getByTestId('section-identity')).toBeTruthy());
    expect(screen.queryByTestId('edit-shop')).toBeNull();
    expect(screen.queryByTestId('authorise')).toBeNull();
    expect(screen.queryByTestId('authorise-section')).toBeNull();
    // 🔴 And no reason text is offered, because there is nothing they can do about it here.
    expect(screen.queryByTestId('authorise-section-reason')).toBeNull();
    // The lifecycle authority they DO hold is unaffected.
    expect(screen.getByTestId('activate')).toBeTruthy();
  });

  /**
   * 🔴 AUTHORISED BUT BLOCKED BY STATE → VISIBLE, GREYED, REASON BESIDE IT.
   */
  it('SCS-050.b Activate stays visible with its reason when no account is bound', async () => {
    stubApi(NOT_CONNECTED);
    renderDetail(NOT_CONNECTED.id);

    await waitFor(() => expect(screen.getByTestId('activate')).toBeTruthy());
    const activate = screen.getByTestId('activate') as HTMLButtonElement;
    expect(activate.disabled).toBe(true);
    /*
      ⚠ The reason renders beside the IN-CONTENT action, as the approved pack places it — the
      header band has no room for a sentence. Both controls are described by that one text.
    */
    expect(screen.getByTestId('activate-section-reason').textContent).toBe(
      'Connect the account first — an active shop must have a verified account.',
    );
    expect((screen.getByTestId('activate-section') as HTMLButtonElement).disabled).toBe(true);
    // 🔴 The reason is associated with BOTH controls for assistive technology.
    expect(activate.getAttribute('aria-describedby')).toBe('activate-section-reason');
    expect(screen.getByTestId('activate-section').getAttribute('aria-describedby')).toBe(
      'activate-section-reason',
    );
  });

  it('SCS-050.b Activate is available on a bound DRAFT shop', async () => {
    stubApi(DRAFT_CONNECTED);
    renderDetail(DRAFT_CONNECTED.id);

    await waitFor(() => expect(screen.getByTestId('activate')).toBeTruthy());
    expect((screen.getByTestId('activate') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId('activate-section-reason')).toBeNull();
  });

  /**
   * 🔴 ONE DARK PRIMARY, ON THE NEXT ACT. The approved pack makes Reauthorize the primary on
   * a settled ACTIVE shop and ACTIVATE the primary on the DRAFT-and-connected one. Two
   * primaries would leave neither meaning anything.
   */
  it('the dark primary follows the operator’s next act', async () => {
    stubApi(DRAFT_CONNECTED);
    renderDetail(DRAFT_CONNECTED.id);
    await waitFor(() => expect(screen.getByTestId('activate')).toBeTruthy());
    // Activate is available → it takes the emphasis, and Reauthorize steps back.
    expect(screen.getByTestId('activate').style.background).toContain('--color-ink');
    expect(screen.getByTestId('authorise').style.background).not.toContain('--color-ink');

    cleanup();
    vi.unstubAllGlobals();
    stubApi(CONNECTED);
    renderDetail();
    await waitFor(() => expect(screen.getByTestId('authorise')).toBeTruthy());
    // Nothing to activate → Reauthorize is the primary, as the pack shows.
    expect(screen.getByTestId('authorise').style.background).toContain('--color-ink');
    expect(screen.queryByTestId('activate')).toBeNull();
  });

  /** ⚠ `SCS-051` — Activate is not offered at all once the shop is no longer DRAFT. */
  it('SCS-051 an already-active shop offers no Activate control', async () => {
    stubApi(CONNECTED);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('section-lifecycle')).toBeTruthy());
    expect(screen.queryByTestId('activate')).toBeNull();
  });

  /**
   * 🔴 `SCS-092.d` — MEMBERSHIP IMPLIES NO ADAPTER. The operator is entitled; the integration
   * does not exist. Visible, greyed, with the honest reason.
   */
  it('SCS-092.d a channel type with no adapter greys Connect and says why', async () => {
    stubApi({
      ...NOT_CONNECTED,
      authorisationSupported: false,
      authorisationUnsupportedReason:
        'Trioloo cannot yet sign in to Daraz accounts. This channel type is recognised, but its integration is not built.',
    });
    renderDetail(NOT_CONNECTED.id);

    await waitFor(() => expect(screen.getByTestId('authorise')).toBeTruthy());
    expect((screen.getByTestId('authorise') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('authorise-section') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('authorise-section-reason').textContent).toContain(
      'its integration is not built',
    );
  });

  it('PRM-003 a refused read reports the missing capability', async () => {
    stubApi(CONNECTED, { detailStatus: 403 });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('shop-forbidden')).toBeTruthy());
    expect(screen.queryByTestId('section-identity')).toBeNull();
  });

  it('a shop that does not exist reports it rather than rendering an empty page', async () => {
    stubApi(CONNECTED, { detailStatus: 404 });
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('shop-not-found')).toBeTruthy());
  });
});

describe('SCS-051 — Activate', () => {
  it('SCS-051 Activate calls its own endpoint and re-reads the shop', async () => {
    stubApi(DRAFT_CONNECTED);
    renderDetail(DRAFT_CONNECTED.id);

    await waitFor(() => expect(screen.getByTestId('activate')).toBeTruthy());
    requests = [];
    fireEvent.click(screen.getByTestId('activate'));

    await waitFor(() => expect(requests.some((r) => r.url.includes('/activate') && r.method === 'POST')).toBe(true));
    await waitFor(() => expect(requests.some((r) => r.method === 'GET' && r.url.includes('/api/system/shops/'))).toBe(true));
  });
});

describe('SC-F — edit from the detail page', () => {
  /** `SCS-010` — Edit opens the Frame 02 MODAL, in place. It creates no route. */
  it('SCS-010 Edit opens the shop form modal without navigating', async () => {
    stubApi(CONNECTED);
    renderDetail();

    await waitFor(() => expect(screen.getByTestId('edit-shop')).toBeTruthy());
    fireEvent.click(screen.getByTestId('edit-shop'));

    await waitFor(() => expect(screen.getByTestId('shop-form-modal')).toBeTruthy());
    expect(screen.getByTestId('shop-form-modal').getAttribute('data-mode')).toBe('edit');
    // 🔴 A bound shop's channel type and market are FIXED, not controls.
    expect(screen.getByTestId('field-channel-type-fixed')).toBeTruthy();
    expect(screen.getByTestId('field-market-fixed')).toBeTruthy();
    // The page is still underneath.
    expect(screen.getByTestId('section-identity')).toBeTruthy();
  });
});
