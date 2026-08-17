import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { PageActionsProvider } from '../shell/PageActions';
import ChannelListingImportPage from './ChannelListingImportPage';

/**
 * FRAME 22 — CSV import: upload, validate, review, apply locally.
 *
 * <p>🔴 THE CLAIM UNDER TEST is that this flow writes ERP intent and nothing else: no
 * marketplace call, no product creation, no silent mapping, and no apply while the file
 * still carries refusals.
 */

const CLEAN_PLAN = {
  planId: 'plan-1',
  validRows: 1187,
  errorRows: 0,
  outcomes: [{ rowNumber: 2, result: 'VALID', field: null, message: 'Will update' }],
};

const DIRTY_PLAN = {
  planId: '',
  validRows: 1187,
  errorRows: 6,
  outcomes: [
    { rowNumber: 14, result: 'ERROR', field: 'mapped_sellable_sku', message: 'SP-009999 does not exist — a supplied mapping must resolve' },
    { rowNumber: 96, result: 'ERROR', field: 'sale_price', message: '"46,900 BDT" is not a number' },
    { rowNumber: 211, result: 'ERROR', field: 'channel_instance', message: 'No channel instance supplied — the row matches no listing' },
    { rowNumber: 340, result: 'ERROR', field: 'listing_status', message: 'Channel-reported fields are read-only and cannot be imported as ERP intended data' },
    { rowNumber: 512, result: 'ERROR', field: 'published_marketplace_stock', message: '−4 is below zero' },
    { rowNumber: 640, result: 'ERROR', field: 'reported_price', message: 'Unknown column' },
  ],
};

const RESULT = { planId: '881', created: 8, updated: 1142, outcomes: [] };

let calls: { url: string; method: string; body: unknown }[] = [];

function stubApi(plan: unknown = CLEAN_PLAN): void {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    const json = (b: unknown): Response =>
      new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.includes('/import/validate')) return json(plan);
    if (url.includes('/import/confirm')) return json(RESULT);
    if (url.includes('/session')) {
      return json({
        username: 'operator', fullName: 'Operator', lifecycleState: 'ACTIVE',
        permissions: ['product.channel-listing.view', 'product.channel-listing.manage'],
      });
    }
    return json({});
  }));
}

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/inventory/products/listings/import']}>
      <AuthProvider>
        <PageActionsProvider>
          <Routes>
            <Route path="/inventory/products/listings/import" element={<ChannelListingImportPage />} />
            <Route path="/inventory/products/listings" element={<div>Workspace</div>} />
          </Routes>
        </PageActionsProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Drives the real file input, as an operator would. */
async function upload(text = 'channel_instance,sale_price\nDaraz A,1200.00\n'): Promise<void> {
  const file = new File([text], 'listings-price-update-aug.csv', { type: 'text/csv' });
  fireEvent.change(screen.getByTestId('import-file'), { target: { files: [file] } });
  await screen.findByTestId('import-filename');
}

beforeEach(() => stubApi());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ================================================================ composition

describe('FRAME 22 composition', () => {
  it('renders the four steps the frame names', async () => {
    renderPage();
    await screen.findByTestId('import-steps');
    ['Upload', 'Validate', 'Review', 'Result'].forEach((label, index) => {
      const chip = screen.getByTestId(`import-step-${label}`);
      expect(chip.textContent).toBe(`${index + 1} ${label}`);
    });
  });

  it('states up front that the import never contacts a marketplace', async () => {
    renderPage();
    expect(await screen.findByText('CSV import changes ERP intended values only. It never contacts a marketplace.')).toBeTruthy();
    expect(screen.getByTestId('download-template')).toBeTruthy();
  });

  it('offers the dropzone and lists the RATIFIED column contract', async () => {
    renderPage();
    const columns = await screen.findByTestId('import-columns');
    expect(screen.getByText('Drop a CSV file, or choose one')).toBeTruthy();
    /* 🔴 The server's names, not the mock's caption — a template with the mock's
       erp_listing_id / intended_price would fail on every row. */
    ['channel_instance', 'mapped_sellable_sku', 'sale_price', 'published_marketplace_stock']
      .forEach((column) => expect(columns.textContent).toContain(column));
    expect(columns.textContent).toContain('rejected, not silently dropped');
  });

  it('shows the uploaded file with its size, row count and time', async () => {
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    expect(screen.getByTestId('import-filename').textContent).toBe('listings-price-update-aug.csv');
    const meta = screen.getByTestId('import-file-meta').textContent ?? '';
    expect(meta).toContain('KB');
    expect(meta).toContain('1 rows');
    expect(meta).toContain('uploaded');
    expect(screen.getByTestId('import-replace')).toBeTruthy();
  });
});

// ================================================================ validate step

describe('validation', () => {
  it('reports the tallies, marking the unavailable one honestly', async () => {
    stubApi(DIRTY_PLAN);
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));

    await screen.findByTestId('import-validate-step');
    expect(screen.getByTestId('import-tally-valid').textContent).toContain('1,187');
    expect(screen.getByTestId('import-tally-invalid').textContent).toContain('6');
    /* ⚠ No "unchanged" tally exists in the plan; it is not fabricated. */
    expect(screen.getByTestId('import-tally-no-change').textContent).toContain('—');
  });

  it('renders the invalid-row table with the frame’s five columns', async () => {
    stubApi(DIRTY_PLAN);
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));

    const header = await screen.findByTestId('import-invalid-header');
    expect([...header.children].map((c) => c.textContent))
      .toEqual(['Row', 'Listing reference', 'Column', 'Reason', 'Outcome']);
  });

  it('shows an unresolvable mapping, a bad price, a missing identifier and a negative stock', async () => {
    stubApi(DIRTY_PLAN);
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));

    await screen.findByTestId('import-invalid-14');
    expect(screen.getByTestId('import-invalid-14').textContent).toContain('a supplied mapping must resolve');
    expect(screen.getByTestId('import-invalid-96').textContent).toContain('is not a number');
    expect(screen.getByTestId('import-invalid-211').textContent).toContain('matches no listing');
    expect(screen.getByTestId('import-invalid-512').textContent).toContain('below zero');
  });

  it('🔴 marks a channel-reported column REJECTED, not skipped', async () => {
    stubApi(DIRTY_PLAN);
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));

    /* listing_status is read-only: the file asked for something the contract forbids. */
    const rejected = await screen.findByTestId('import-invalid-340');
    expect(rejected.textContent).toContain('REJECTED');
    /* An ordinary bad value is SKIPPED — the row was understood and could not be used. */
    expect(screen.getByTestId('import-invalid-96').textContent).toContain('SKIPPED');
  });

  it('leaves the listing reference unavailable rather than inventing one', async () => {
    stubApi(DIRTY_PLAN);
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));
    await screen.findByTestId('import-ref-14');
    expect(screen.getByTestId('import-ref-14').textContent).toBe('—');
  });

  it('pages the invalid rows five at a time, as the frame does', async () => {
    stubApi(DIRTY_PLAN);
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));

    const range = await screen.findByTestId('import-invalid-range');
    expect(range.textContent).toBe('1–5 of 6 invalid rows');
    expect(screen.getByTestId('import-download-invalid')).toBeTruthy();
    fireEvent.click(screen.getByTestId('import-invalid-next'));
    expect(screen.getByTestId('import-invalid-range').textContent).toBe('6–6 of 6 invalid rows');
  });

  it('says so plainly when every row is valid', async () => {
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));
    expect(await screen.findByText('Every row is valid')).toBeTruthy();
  });
});

// ================================================================ review + apply

describe('review and apply locally', () => {
  it('renders the review table and marks the per-field breakdown unavailable', async () => {
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));

    const header = await screen.findByTestId('import-review-header');
    expect([...header.children].map((c) => c.textContent)).toEqual(['Field', 'Rows', 'Notes']);
    expect(screen.getByTestId('import-review-unavailable')).toBeTruthy();
  });

  it('states the consequence, including unmapped and ERP-first handling', async () => {
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));

    const consequence = await screen.findByTestId('import-consequence');
    expect(consequence.textContent).toContain('Apply 1,187 rows to ERP intended data?');
    expect(consequence.textContent).toContain('No marketplace is contacted by this step');
    expect(consequence.textContent).toContain('stay unmapped');
    expect(consequence.textContent).toContain('accepted as ERP-first drafts');
    expect(consequence.textContent).toContain('never maps a row by matching titles');
  });

  it('applies a clean file and reports the result', async () => {
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));
    await screen.findByTestId('import-apply');
    expect((screen.getByTestId('import-apply') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByTestId('import-apply'));
    await screen.findByTestId('import-result');
    const confirm = calls.find((call) => call.url.includes('/import/confirm'));
    expect(confirm?.body).toEqual({ planId: 'plan-1' });
    expect(screen.getByTestId('import-result').textContent).toContain('1,150 rows applied');
  });

  it('🔴 refuses to apply while any row is invalid, and says why', async () => {
    stubApi(DIRTY_PLAN);
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));

    const apply = await screen.findByTestId('import-apply');
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('import-apply-blocked').textContent).toContain('all-or-nothing');

    fireEvent.click(apply);
    await waitFor(() => expect(calls.some((call) => call.url.includes('/import/confirm'))).toBe(false));
  });

  it('sends the CSV text unchanged — no parsing or arithmetic in the browser', async () => {
    renderPage();
    await screen.findByTestId('import-file');
    const text = 'channel_instance,sale_price\nDaraz A,1200.00\n';
    await upload(text);
    fireEvent.click(screen.getByTestId('import-validate'));

    await waitFor(() => expect(calls.some((c) => c.url.includes('/import/validate'))).toBe(true));
    const sent = calls.find((call) => call.url.includes('/import/validate'));
    /* 🔴 Money crosses as the operator's own string, untouched. */
    expect((sent?.body as { csv: string }).csv).toBe(text);
  });
});

// ================================================================ result step

describe('the result step', () => {
  it('renders the result, the workspace link and the inert push action', async () => {
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));
    await screen.findByTestId('import-apply');
    fireEvent.click(screen.getByTestId('import-apply'));

    const result = await screen.findByTestId('import-result');
    expect(result.textContent).toContain('import 881');
    expect(result.textContent).toContain('1,142 listings now carry unsent local changes');
    expect(result.textContent).toContain('8 drafts created without an external listing ID');
    expect(screen.getByTestId('import-view-listings')).toBeTruthy();
    /* 🔴 FRAME 18 is blocked; the button is present and cannot act. */
    expect((screen.getByTestId('import-review-push') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('import-push-footnote').textContent)
      .toContain('Pushing to marketplaces stays a separate, reviewed action.');
  });
});

// ================================================================ local only

describe('this flow only writes local intent', () => {
  it('🔴 triggers no push, sync, discovery, publish or channel-import call', async () => {
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));
    await screen.findByTestId('import-apply');
    fireEvent.click(screen.getByTestId('import-apply'));
    await screen.findByTestId('import-result');

    ['push', 'sync', 'discover', 'publish', 'refresh', 'operations', 'batches']
      .forEach((forbidden) => expect(calls.some((call) => call.url.includes(forbidden))).toBe(false));
  });

  it('🔴 creates no product and touches no sellable-product endpoint', async () => {
    renderPage();
    await screen.findByTestId('import-file');
    await upload();
    fireEvent.click(screen.getByTestId('import-validate'));
    await screen.findByTestId('import-apply');
    fireEvent.click(screen.getByTestId('import-apply'));
    await screen.findByTestId('import-result');

    ['sellable-products', 'stock-items'].forEach((forbidden) =>
      expect(calls.some((call) => call.url.includes(forbidden))).toBe(false));
    /* Only the two documented import endpoints are ever posted to. */
    calls.filter((call) => call.method === 'POST').forEach((call) =>
      expect(call.url).toMatch(/\/import\/(validate|confirm)$/));
  });
});
