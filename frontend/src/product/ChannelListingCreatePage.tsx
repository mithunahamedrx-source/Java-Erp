import { useNavigate } from 'react-router-dom';
import { ListingAuthoringForm, EMPTY } from './ListingAuthoringForm';
import { createChannelListing } from './channelListingApi';

/**
 * FRAME 09 — Add Listing.
 *
 * <p>🔴 THIS PAGE HOLDS NO FORM OF ITS OWN. Add and Edit are one authoring surface
 * ({@link ListingAuthoringForm}); this wrapper supplies only the two things that differ on
 * creation — an empty draft, and what a successful save means.
 *
 * <p>🔴 `PRD-185` — SAVE IS NOT PUSH. Creating records Trioloo's intended content and stops.
 * Nothing here contacts a channel, and there is deliberately no "save and publish": pushing
 * needs separate authority (`PRD-196.a`) and is a separate, explicit act.
 */
export default function ChannelListingCreatePage(): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <ListingAuthoringForm
      mode={{
        kind: 'create',
        initial: EMPTY,
        existing: null,
        onSubmit: async (body) => {
          const created = await createChannelListing(body);
          // ⚠ Straight to the listing that now exists — the operator's next question is
          //   always "what does it look like", never "shall I create another".
          navigate(`/inventory/products/listings/${created.id}`);
        },
      }}
    />
  );
}
