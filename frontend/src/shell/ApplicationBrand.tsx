import { APPLICATION_BRAND } from './brand';
import logoUrl from '../assets/brand/trioloo-logo-black.png';

/**
 * The ONE brand presentation.
 *
 * <p>🔴 The COMPLETE original logo, rendered as a SINGLE image asset. It is never recreated,
 * redrawn, cropped, distorted or stretched, its icon and wordmark are never separated, no text
 * is placed beside it, and nothing is drawn behind it.
 *
 * <p>The asset is the BLACK presentation variant. The approved source is a white/reverse
 * artwork that measures ≈1.03:1 against the `#FFFFFF` brand surface — invisible. The variant
 * was produced by setting the RGB channels to black while copying the source's ALPHA channel
 * byte-for-byte, so shape, coverage, antialiasing, proportions and the icon+wordmark lockup
 * are mathematically unchanged. 🔴 Deliberately NOT a runtime CSS filter: the colour is baked
 * into the asset, so nothing depends on filter support or stacking context at render time.
 * See `README.md` beside the asset for provenance.
 *
 * <p>The previous composition — a `26px` ink circle plus a separately rendered `TrioLoo`
 * text wordmark — is CANCELLED. The brand region is now the logo and nothing else.
 *
 * <p>Both surfaces that show application branding consume THIS component: the sidebar brand
 * region and the authentication surface. There is one asset and one implementation.
 *
 * <p><b>Sizing.</b> Only `height` is declared; `width: auto` lets the browser derive the rest,
 * so the original `643 × 184` aspect ratio (`3.4946`) cannot be distorted by a future edit.
 * The heights are chosen OPTICALLY rather than from the canvas: the artwork occupies only
 * `604 × 120` of its canvas, so roughly 35% of the file's height is transparent padding and a
 * naive canvas-height fit would render the mark far smaller than it looks.
 */
export default function ApplicationBrand({
  surface = 'sidebar',
}: {
  readonly surface?: 'sidebar' | 'auth';
}): React.JSX.Element {
  /*
    🔴 `RULE 3.7.c` v2.13.0 — THE MARK IS SECONDARY TO THE WORKSPACE. It is reduced ~10%
    and softened, so it identifies the product without competing with the operator's data for
    attention. Superseded: sidebar 40px, auth 50px, full opacity.

    ⚠ ARTWORK UNTOUCHED. Only `height` is declared and `width: auto` derives the rest, so the
    643 × 184 aspect ratio cannot be distorted; the file itself is not re-rendered or cropped.

    Sidebar: 36px canvas -> ~23px of visible mark inside the 64px brand block (§3.7).
    Auth: larger, because the login card has room and the logo is the only branding there.
  */
  const height = surface === 'sidebar' ? 36 : 45;

  const logo = (
    <img
      src={logoUrl}
      alt={APPLICATION_BRAND}
      data-testid="application-logo"
      style={{
        height: `${height}px`,
        width: 'auto',
        /*
          🔴 HIERARCHY, NOT DISABLEMENT. 0.86 reads as deliberately quiet; anything lower
          starts to look washed out or switched off, which is a different message entirely.
        */
        opacity: 0.86,
        // Belt and braces: even if a parent ever constrains the width, the aspect ratio holds
        // and the logo shrinks rather than squashing.
        maxWidth: '100%',
        objectFit: 'contain',
        display: 'block',
      }}
    />
  );

  if (surface === 'auth') {
    return (
      <div data-testid="application-brand" style={{ display: 'flex', justifyContent: 'center' }}>
        {logo}
      </div>
    );
  }

  return (
    <div
      data-testid="application-brand"
      style={{
        height: 'var(--brand-block-height)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        borderBottom: '1px solid var(--color-divider-inner)',
      }}
    >
      {logo}
    </div>
  );
}
