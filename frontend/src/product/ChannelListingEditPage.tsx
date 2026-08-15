import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, EmptyState } from '../ui/primitives';
import { PageHeader } from '../shell/AppShell';
import { ListingAuthoringForm, EMPTY } from './ListingAuthoringForm';
import type { Draft } from './ListingAuthoringForm';
import { fetchChannelListing, updateChannelListing } from './channelListingApi';
import type { ChannelListing } from './channelListingApi';

/**
 * FRAME 10 — Edit Listing.
 *
 * <p>🔴 THIS PAGE HOLDS NO FORM OF ITS OWN. It is Frame 09 populated with the listing's
 * current intended content ({@link ListingAuthoringForm}). A second, edit-only form would
 * drift from the first and teach the operator the same screen twice.
 *
 * <p>🔴 `PRD-185` — SAVE IS NOT PUSH. Saving records the changed intent locally, marks the
 * listing as carrying UNSENT local changes, and stops. It never contacts the channel.
 */
export default function ChannelListingEditPage(): React.JSX.Element {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<ChannelListing | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let live = true;
    setLoading(true);
    fetchChannelListing(id)
      .then((found) => { if (live) setListing(found); })
      .catch((cause) => {
        if (live) setFailure(cause instanceof Error ? cause.message : 'The Listing could not be loaded.');
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id]);

  /**
   * Re-reads the listing after a mapping was confirmed, WITHOUT a loading state.
   *
   * 🔴 The form is not remounted and `loading` is deliberately untouched: swapping the page
   * for a spinner would tear down the authoring form and take the operator's unsaved values
   * with it (§27). Only the mapping facts on screen change.
   *
   * ⚠ Safe because a mapping alters no field the draft holds — `toDraft` produces the same
   * values it did before, so the dirty comparison is unaffected.
   */
  const reread = (): void => {
    if (!id) return;
    void fetchChannelListing(id).then(setListing).catch(() => { /* keep what is on screen */ });
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Edit Listing" subtitle="Products · Listings" />
        <Card>
          <EmptyState title="Loading Listing…" guidance="Fetching the current intended content." />
        </Card>
      </>
    );
  }

  if (failure !== null || listing === null || !id) {
    return (
      <>
        <PageHeader title="Edit Listing" subtitle="Products · Listings" />
        <Card>
          {/*
            🔴 `SYS-034` — an unreadable record is NOT an empty one. The page says it could not
            read the listing rather than presenting a blank form, which would invite an operator
            to author over content they were never shown.
          */}
          <EmptyState
            title="This Listing could not be loaded"
            guidance={failure ?? 'No Listing with that identifier is readable here.'}
          />
        </Card>
      </>
    );
  }

  return (
    <ListingAuthoringForm
      mode={{
        kind: 'edit',
        initial: toDraft(listing),
        existing: listing,
        onSubmit: async (body) => {
          await updateChannelListing(id, body);
          navigate(`/inventory/products/listings/${id}`);
        },
        onMappingChanged: reread,
      }}
    />
  );
}

/**
 * The listing's CURRENT intended content, in the shape the shared form authors.
 *
 * <p>🔴 EVERY VALUE IS THE LISTING'S OWN, never an effective or derived one. Prefilling a
 * fallback would make the operator's first save materialise someone else's content as this
 * listing's override — the fallback would be silently consumed by the act of opening the page.
 *
 * <p>⚠ `EMPTY` is spread first so a field added to the form later starts blank here rather
 * than becoming `undefined` and breaking the dirty comparison.
 */
function toDraft(listing: ChannelListing): Draft {
  const sku = listing.skus.length === 1 ? listing.skus[0] : null;
  return {
    ...EMPTY,
    channelInstance: listing.channelInstance,
    // ⚠ Mapping is not authored on this page (it is per orderable SKU), and an empty value is
    //   IGNORED by the update — it never unmaps.
    mappedSellableSku: '',
    intendedTitle: listing.intendedTitle ?? '',
    intendedDescription: listing.intendedDescription ?? '',
    /*
      🔴 `PRD-198.c` / `PRD-202.c` — the OWN set, never the effective one. Where the listing
      holds no highlights of its own the box is empty and the fallback stays a fallback.
    */
    highlights: listing.highlightsAreFallback ? '' : listing.highlights.join('\n'),
    // 🔴 `PRD-202.b` — the raw override exactly as authored, never `effectiveTitleBn`.
    intendedTitleBn: listing.intendedTitleBn ?? '',
    intendedDescriptionBn: listing.intendedDescriptionBn ?? '',
    highlightsBn: listing.highlightsBnAreFallback ? '' : listing.highlightsBn.join('\n'),
    /*
      🔴 `PRD-201.c` — the parcel belongs to the ORDERABLE unit. A variation listing has no
      single parcel, so nothing is prefilled and the form refuses the edit rather than showing
      one SKU's carton as if it were the listing's.
    */
    packageWeightKg: sku?.packageWeightKg ?? '',
    packageLengthCm: sku?.packageLengthCm ?? '',
    packageWidthCm: sku?.packageWidthCm ?? '',
    packageHeightCm: sku?.packageHeightCm ?? '',
    packageContent: sku?.packageContent ?? '',
    /*
      🔴 `TEC-015` — money stays a STRING all the way through. It is never parsed into a
      JavaScript Number, which cannot represent decimal money exactly.
    */
    salePrice: listing.salePrice ?? '',
    promotionPrice: listing.promotionPrice ?? '',
    promotionStartsAt: toLocalInput(listing.promotionStartsAt),
    promotionEndsAt: toLocalInput(listing.promotionEndsAt),
    publishedMarketplaceStock: listing.listingStock ?? '',
    publicationIntent: listing.publicationIntent ?? EMPTY.publicationIntent,
    intendedChannelCategory: listing.intendedChannelCategory ?? '',
    /*
      🔴 RATIFIED — editable ONLY while the unit has no remote identity. It is prefilled
      either way so the round-trip is value-preserving: a published listing sends back the
      SKU it already has, which the backend recognises as no change at all.
    */
    channelSku: sku?.channelSku ?? '',
  };
}

/**
 * An instant, as the local wall-clock value a `datetime-local` control expects.
 *
 * <p>⚠ The operator scheduled a promotion in THEIR time, so it is shown in theirs. The stored
 * fact stays the instant; only the presentation is local, and the form converts it back on
 * save.
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
    + `T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
