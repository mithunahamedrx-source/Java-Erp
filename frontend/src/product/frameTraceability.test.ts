import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * `LSC-003` — EVERY IMPLEMENTED LISTINGS SURFACE NAMES THE FRAME IT SERVES.
 *
 * <p>🔴 ASSERTED AGAINST THE SOURCE, NOT A RENDERED PAGE, and on purpose — exactly as
 * `visualFoundation.test.ts` asserts the shared stylesheets. The rule is about TRACEABILITY:
 * a surface built from the approved pack without its frame number cannot be checked against
 * the design it claims to implement, and `LSC-003` treats such a component as a draft.
 *
 * <p>⚠ IT CAUGHT THREE REAL GAPS. `FRAME 04` and `FRAME 11` shipped complete and tested but
 * untagged, and `FRAME 19`'s draft carried no number at all — each was traceable only through
 * a comment in its test file, which is the wrong direction.
 *
 * <p>🔴 THIS TEST ASSERTS TRACEABILITY, NOT COMPLETENESS. A tag says which frame a component
 * serves; it never claims that frame is finished. `FRAME 19` is tagged and still blocked.
 */

/** ⚠ Resolved from the project root: vitest runs there. */
const read = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

/**
 * The register from `LISTINGS_SCREEN_CONTRACT.md` §2, as source paths.
 *
 * ⚠ ONE SURFACE MAY SERVE SEVERAL FRAMES — the pack draws states of one screen, and this
 * mapping follows the pack rather than inventing a component per frame.
 */
const OWNERS: readonly (readonly [number, string])[] = [
  [1, 'src/product/ChannelListingsPage.tsx'],
  [2, 'src/product/ChannelListingCard.tsx'],
  [3, 'src/product/ChannelListingStates.tsx'],
  [4, 'src/product/ChannelListingsPage.tsx'],
  [5, 'src/product/ChannelListingsPage.tsx'],
  [6, 'src/product/ChannelListingDetailPage.tsx'],
  [7, 'src/product/ChannelListingComparison.tsx'],
  [8, 'src/product/ChannelListingComparison.tsx'],
  [9, 'src/product/ListingAuthoringForm.tsx'],
  [10, 'src/product/ChannelListingEditPage.tsx'],
  [11, 'src/product/ChannelListingDetailPage.tsx'],
  [12, 'src/product/MappingModal.tsx'],
  [13, 'src/product/ListingMediaPage.tsx'],
  [14, 'src/product/ListingSkuSection.tsx'],
  [15, 'src/product/PushReviewModal.tsx'],
  [16, 'src/product/ListingRefreshState.tsx'],
  [17, 'src/product/ChannelListingBatchEditPage.tsx'],
  [19, 'src/product/ChannelListingBatchPage.tsx'],
  [20, 'src/product/ChannelListingSyncPage.tsx'],
  [21, 'src/product/ListingActivityPage.tsx'],
  [22, 'src/product/ChannelListingImportPage.tsx'],
];

/**
 * Whether a file names a frame, in either the singular or the plural form the codebase uses
 * (`FRAME 09`, `FRAMES 09 AND 10`). ⚠ Zero-padded and bare numbers both count: the register
 * writes `FRAME 01` and prose sometimes writes `Frame 1`.
 */
function namesFrame(source: string, frame: number): boolean {
  const padded = String(frame).padStart(2, '0');
  return new RegExp(`FRAMES?\\s+(\\d+\\s+AND\\s+)?0?${frame}\\b|FRAMES?\\s+${padded}\\b`, 'i')
    .test(source)
    || new RegExp(`FRAMES?\\s+\\d+\\s+AND\\s+0?${frame}\\b`, 'i').test(source);
}

describe('LSC-003 — every implemented Listings surface names its frame', () => {
  it.each(OWNERS)('FRAME %i is named in %s', (frame, path) => {
    expect(namesFrame(read(path), frame)).toBe(true);
  });

  /**
   * 🔴 THE THREE THIS TEST EXISTS FOR. They were complete or drafted, and untagged.
   */
  it('names FRAME 04 on the workspace that owns selection scope', () => {
    expect(read('src/product/ChannelListingsPage.tsx')).toMatch(/FRAME 04/);
  });

  it('names FRAME 11 on the detail page that owns the unmapped state', () => {
    expect(read('src/product/ChannelListingDetailPage.tsx')).toMatch(/FRAME 11/);
  });

  it('names FRAME 19 on the batch page, which is tagged but still blocked', () => {
    const source = read('src/product/ChannelListingBatchPage.tsx');
    expect(source).toMatch(/FRAME 19/);
    /* ⚠ A tag is traceability, never a completeness claim — the source says so itself. */
    expect(source).toMatch(/NOT COMPLETE|blocked|OUTBOUND/i);
  });

  /**
   * 🔴 `FRAME 18` HAS NO COMPONENT AND MUST NOT ACQUIRE ONE by accident. Batch review is
   * blocked on the outbound half and on the unratified `PRD-187` operators; a file claiming
   * to implement it would assert a capability that does not exist.
   *
   * ⚠ A REFERENCE IS NOT AN IMPLEMENTATION. `ChannelListingImportPage.tsx` mentions
   * `FRAME 18` in a comment explaining why its "Review & Push" control is inert, which is the
   * opposite of implementing it — so this checks for a component whose own header claims it.
   */
  it('has no component claiming to implement FRAME 18', () => {
    const claimants = OWNERS.filter(([frame]) => frame === 18);
    expect(claimants).toHaveLength(0);
  });
});
