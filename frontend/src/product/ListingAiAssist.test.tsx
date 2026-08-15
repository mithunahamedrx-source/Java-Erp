import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ChannelListingCreatePage from './ChannelListingCreatePage';

/**
 * AI ASSIST — `PRD-200`, through the real Add Listing page.
 *
 * <p>🔴 The claim under test throughout is the safety chain: generation writes nothing,
 * acceptance edits the FORM only, acceptance does not save, and saving does not publish.
 */

const CHANNELS = [{
  id: 'ch-1', code: 'DARAZ-A', name: 'Daraz account A', channelType: 'DARAZ',
  adapterAvailable: false, knownListings: 12, lastSyncAt: null, capabilities: [],
}];

let posted: { url: string; body: unknown }[] = [];
let generated: unknown[] = [];
let aiConfigured = true;
let generateFails = false;
let nextCandidates: Record<string, string> = {};

function stubApi(): void {
  posted = [];
  generated = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (body: unknown, status = 200): Response =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/ai/status')) return json({ configured: aiConfigured });
    if (url.includes('/ai/generate')) {
      const body = JSON.parse(String(init?.body));
      generated.push(body);
      if (generateFails) return json({ message: 'The assistant could not be reached.' }, 503);
      const kind = body.kind as string;
      return json({ candidates: kind in nextCandidates ? { [kind]: nextCandidates[kind] } : {} });
    }
    if (init?.method === 'POST') {
      posted.push({ url, body: JSON.parse(String(init.body)) });
      return json({ id: 'new-listing-1' }, 201);
    }
    if (url.includes('/api/auth/me')) {
      return json({ id: 'dev', username: 'devuser', fullName: 'Dev User', roles: [],
        permissions: ['product.channel-listing.view', 'product.channel-listing.manage'] });
    }
    if (url.includes('/channels')) return json(CHANNELS);
    if (url.includes('/sellable-products')) return json({ content: [], page: 0, size: 6, totalElements: 0, totalPages: 0 });
    return json({});
  }));
}

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/inventory/products/listings/new']}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/inventory/products/listings/new" element={<ChannelListingCreatePage />} />
            <Route path="/inventory/products/listings/:id" element={<div data-testid="landed-on-detail" />} />
          </Routes>
        </PageActionsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const setField = (id: string, value: string): void => {
  fireEvent.change(screen.getByTestId(id), { target: { value } });
};

async function openAssist(): Promise<void> {
  await waitFor(() => expect(screen.getByTestId('ai-assist-open')).toBeTruthy());
  fireEvent.click(screen.getByTestId('ai-assist-open'));
  await waitFor(() => expect(screen.getByTestId('ai-assist-dialog')).toBeTruthy());
}

/** Runs a command and waits for its candidates. */
async function generate(commandTestId: string): Promise<void> {
  fireEvent.click(screen.getByTestId(commandTestId));
  fireEvent.click(screen.getByText('Generate', { selector: 'button' }));
  await waitFor(() => expect(screen.getByTestId('ai-candidates')).toBeTruthy());
}

const body = (): Record<string, unknown> => posted[0]?.body as Record<string, unknown>;

beforeEach(() => {
  aiConfigured = true;
  generateFails = false;
  nextCandidates = {
    TITLE: 'Hi-Power 22 Inch IPS Monitor with HDMI and VGA',
    HIGHLIGHTS: '22-inch IPS panel\nFull HD resolution\nHDMI and VGA inputs',
    DESCRIPTION: 'A 22 inch IPS monitor with HDMI and VGA inputs.',
  };
  stubApi();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('AI Assist — availability', () => {
  it('opens from the authoring header without being the page primary', async () => {
    renderPage();
    await openAssist();
    expect(screen.getByTestId('ai-assist-dialog')).toBeTruthy();
    // 🔴 The dark primary on the page remains Save listing.
    expect(screen.getByTestId('page-header-actions').textContent).toContain('Save listing');
  });

  /** 🔴 `PRD-200.r` — an unconfigured provider is stated, never faked. */
  it('states honestly when no provider is configured, and fabricates nothing', async () => {
    aiConfigured = false;
    renderPage();
    await openAssist();
    await waitFor(() => expect(screen.getByTestId('ai-assist-dialog').textContent)
      .toContain('AI authoring is not configured'));
    expect(screen.getByTestId('ai-assist-dialog').textContent).toContain('written by hand');
    expect((screen.getByTestId('ai-command-title') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId('ai-candidates')).toBeNull();
  });

  /** 🔴 `PRD-200.i` — manual authoring is unaffected by any of this. */
  it('leaves the form fully usable with no provider', async () => {
    aiConfigured = false;
    renderPage();
    await waitFor(() => expect(screen.getByTestId('field-intended-title')).toBeTruthy());
    fireEvent.change(screen.getByTestId('field-channel-instance'), { target: { value: 'DARAZ-A' } });
    setField('field-intended-title', 'Written by hand');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().intendedTitle).toBe('Written by hand');
  });

  /** 🔴 `PRD-200.p` — nothing generates on its own. */
  it('sends no generation request until the operator asks', async () => {
    renderPage();
    await openAssist();
    expect(generated.length).toBe(0);
  });
});

describe('AI Assist — generation and context', () => {
  /**
   * 🔴 `PRD-200.f`/`.g` — the request carries only facts the Listing holds, and a blank one
   * is reported as ABSENT rather than dropped or guessed.
   */
  it('sends structured listing context and names what is absent', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('field-channel-instance')).toBeTruthy());
    fireEvent.change(screen.getByTestId('field-channel-instance'), { target: { value: 'DARAZ-A' } });
    setField('field-intended-title', 'Existing title');
    await openAssist();
    await generate('ai-command-title');

    const request = generated[0] as { facts: Record<string, string | null>; language: string };
    expect(request.facts.channel).toBe('Daraz account A');
    expect(request.facts.title).toBe('Existing title');
    // Never recorded on this draft — sent as null so the assistant is TOLD it is unknown.
    expect(request.facts.packageWeightKg).toBeNull();
    expect(request.language).toBe('EN');
    // The operator can see the same distinction.
    expect(screen.getByTestId('ai-context').textContent).toContain('never invented');
  });

  it('passes a custom instruction through as the operator wrote it', async () => {
    renderPage();
    await openAssist();
    setField('ai-instruction', 'Emphasise warranty and connectivity.');
    await generate('ai-command-title');
    expect(String((generated[0] as { instruction: string }).instruction))
      .toContain('Emphasise warranty and connectivity.');
  });

  /** ⚠ `PRD-200` + §16 — no adapter means no constraints, and none are invented. */
  it('claims no marketplace constraints when no adapter declares any', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('field-channel-instance')).toBeTruthy());
    fireEvent.change(screen.getByTestId('field-channel-instance'), { target: { value: 'DARAZ-A' } });
    await openAssist();
    await generate('ai-command-marketplace');
    expect((generated[0] as { adapterConstraints: string[] }).adapterConstraints).toEqual([]);
  });

  /** 🔴 A failure changes nothing and keeps what the operator typed. */
  it('keeps the form untouched when generation fails', async () => {
    generateFails = true;
    renderPage();
    await waitFor(() => expect(screen.getByTestId('field-intended-title')).toBeTruthy());
    setField('field-intended-title', 'Mine');
    await openAssist();
    fireEvent.click(screen.getByTestId('ai-command-title'));
    fireEvent.click(screen.getByText('Generate', { selector: 'button' }));

    await waitFor(() => expect(screen.getByTestId('dialog-error')).toBeTruthy());
    fireEvent.click(screen.getByText('Close'));
    expect((screen.getByTestId('field-intended-title') as HTMLInputElement).value).toBe('Mine');
  });
});

describe('AI Assist — candidate workflow', () => {
  /** 🔴 `PRD-200.o` — a candidate never replaces authored content in place. */
  it('shows current beside suggested and changes nothing before acceptance', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('field-intended-title')).toBeTruthy());
    setField('field-intended-title', 'My own title');
    await openAssist();
    await generate('ai-command-rewrite-title');

    expect(screen.getByTestId('ai-current-TITLE').textContent).toBe('My own title');
    expect(screen.getByTestId('ai-suggested-TITLE').textContent).toContain('Hi-Power');
    // The form is untouched while the candidate sits on screen.
    expect((screen.getByTestId('field-intended-title') as HTMLInputElement).value).toBe('My own title');
  });

  it('changes nothing when the candidate is discarded', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('field-intended-title')).toBeTruthy());
    setField('field-intended-title', 'Untouched');
    await openAssist();
    await generate('ai-command-title');
    fireEvent.click(screen.getByText('Close'));

    expect((screen.getByTestId('field-intended-title') as HTMLInputElement).value).toBe('Untouched');
  });

  it('replaces only the candidate when regenerating', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('field-intended-title')).toBeTruthy());
    setField('field-intended-title', 'Untouched');
    await openAssist();
    await generate('ai-command-title');

    nextCandidates.TITLE = 'A second suggestion';
    fireEvent.click(screen.getByTestId('ai-regenerate'));
    await waitFor(() => expect(screen.getByTestId('ai-suggested-TITLE').textContent).toBe('A second suggestion'));
    expect((screen.getByTestId('field-intended-title') as HTMLInputElement).value).toBe('Untouched');
  });

  /** 🔴 `PRD-200.a`/`.k` — acceptance edits the FORM. It does not save. */
  it('writes an accepted candidate into the form without saving', async () => {
    renderPage();
    await openAssist();
    await generate('ai-command-title');
    fireEvent.click(screen.getByText(/^Use 1 suggestion$/));

    await waitFor(() => expect((screen.getByTestId('field-intended-title') as HTMLInputElement).value)
      .toContain('Hi-Power'));
    // 🔴 NOTHING was saved and NOTHING was pushed.
    expect(posted.length).toBe(0);
    expect(screen.queryByTestId('landed-on-detail')).toBeNull();
  });

  /** 🔴 `PRD-200.m` — a set may be accepted IN PART. */
  it('accepts part of a generated set and discards the rest', async () => {
    renderPage();
    await openAssist();
    fireEvent.click(screen.getByTestId('ai-command-all'));
    fireEvent.click(screen.getByText('Generate', { selector: 'button' }));
    await waitFor(() => expect(screen.getByTestId('ai-candidate-DESCRIPTION')).toBeTruthy());

    // Drop the description; keep the title and the highlights.
    fireEvent.click(screen.getByTestId('ai-accept-DESCRIPTION'));
    fireEvent.click(screen.getByText(/^Use 2 suggestions$/));

    await waitFor(() => expect((screen.getByTestId('field-intended-title') as HTMLInputElement).value)
      .toContain('Hi-Power'));
    expect((screen.getByTestId('field-highlights') as HTMLTextAreaElement).value).toContain('22-inch IPS panel');
    // The refused candidate wrote nothing.
    expect((screen.getByTestId('field-intended-description') as HTMLTextAreaElement).value).toBe('');
  });

  /**
   * 🔴 `PRD-198.b` — accepted highlights become ORDERED CANONICAL RECORDS, one per line. The
   * textarea is still just the input shape.
   */
  it('turns accepted highlights into ordered records on save', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('field-channel-instance')).toBeTruthy());
    fireEvent.change(screen.getByTestId('field-channel-instance'), { target: { value: 'DARAZ-A' } });
    setField('field-intended-title', 'A title');
    await openAssist();
    await generate('ai-command-highlights');
    fireEvent.click(screen.getByText(/^Use 1 suggestion$/));
    await waitFor(() => expect((screen.getByTestId('field-highlights') as HTMLTextAreaElement).value)
      .toContain('22-inch IPS panel'));

    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().highlights).toEqual(['22-inch IPS panel', 'Full HD resolution', 'HDMI and VGA inputs']);
    expect(screen.queryByTestId('highlight-add')).toBeNull();
  });
});

describe('AI Assist — provenance and language', () => {
  /** 🔴 `PRD-200.e` — the accepted field is marked AI-assisted; the ACTOR is still the person. */
  it('records AI provenance for an accepted field on save', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('field-channel-instance')).toBeTruthy());
    fireEvent.change(screen.getByTestId('field-channel-instance'), { target: { value: 'DARAZ-A' } });
    await openAssist();
    await generate('ai-command-title');
    fireEvent.click(screen.getByText(/^Use 1 suggestion$/));
    await waitFor(() => expect((screen.getByTestId('field-intended-title') as HTMLInputElement).value)
      .toContain('Hi-Power'));

    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().aiAssistedFields).toEqual(['intendedTitle']);
  });

  /**
   * 🔴 `PRD-200.n` — provenance does NOT propagate. Typing over an accepted field makes the
   * value the operator's own again.
   */
  it('drops AI provenance once the field is edited by hand', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('field-channel-instance')).toBeTruthy());
    fireEvent.change(screen.getByTestId('field-channel-instance'), { target: { value: 'DARAZ-A' } });
    await openAssist();
    await generate('ai-command-title');
    fireEvent.click(screen.getByText(/^Use 1 suggestion$/));
    await waitFor(() => expect((screen.getByTestId('field-intended-title') as HTMLInputElement).value)
      .toContain('Hi-Power'));

    setField('field-intended-title', 'I rewrote this myself');
    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().aiAssistedFields).toEqual([]);
    expect(body().intendedTitle).toBe('I rewrote this myself');
  });

  /** 🔴 `PRD-202` — the candidate follows the page's authoring language. */
  it('generates in Bangla and fills the Bangla override only', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('field-channel-instance')).toBeTruthy());
    fireEvent.change(screen.getByTestId('field-channel-instance'), { target: { value: 'DARAZ-A' } });
    setField('field-intended-title', 'English title');
    fireEvent.click(screen.getByTestId('language-bn'));

    nextCandidates.TITLE = 'বাংলা শিরোনাম';
    await openAssist();
    expect(screen.getByTestId('ai-language').textContent).toBe('বাংলা');
    await generate('ai-command-title');
    fireEvent.click(screen.getByText(/^Use 1 suggestion$/));

    await waitFor(() => expect((screen.getByTestId('field-intended-title-bn') as HTMLInputElement).value)
      .toBe('বাংলা শিরোনাম'));
    // 🔴 `PRD-202.g` — the English content it may have been derived from is untouched.
    expect((screen.getByTestId('field-intended-title') as HTMLInputElement).value).toBe('English title');

    fireEvent.click(screen.getByTestId('create-save'));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(body().intendedTitleBn).toBe('বাংলা শিরোনাম');
    expect(body().aiAssistedFields).toEqual(['intendedTitleBn']);
  });
});
