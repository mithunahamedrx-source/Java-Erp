# Brand asset provenance

`trioloo-logo-black.png` — the ONE canonical application logo. The sidebar brand region and
the authentication surface both render it through `src/shell/ApplicationBrand.tsx`. There is
no second logo asset and no second brand implementation.

## Source

| | |
|---|---|
| **Original file** | `ChatGPT_Image_Aug_11__2026__08_28_30_AM-removebg-preview.png` |
| **Original location** | `Company Profile\TrioLoo Technology\Docoment\Logo\Logo 2\Web Logos\2nd logo\New folder` |
| **Original SHA-256** | `6C00C84DEEC5FB5EC30D37431D98C3600AD04C0A9311438677839CC3E7949A4C` |
| **Canvas** | `643 × 184` px · aspect ratio `3.4946` |
| **Artwork bounding box** | `604 × 120` px at `x=22..625`, `y=29..148` |

## Why a derived variant exists

The approved source is a **white / reverse** artwork — mean RGB of every opaque pixel is
`252, 252, 252`. Both surfaces that display it are `#FFFFFF`, so it measures **≈1.03:1** and is
effectively invisible.

No black variant of this lockup exists in the brand kit. The other black files in it
(`TRIOLOO 01.png`, `TRIOLOO 05.png`, `TRIOLOO font Black.png`, `TRIOLOO icon Black.png`) are a
**different logo design** — an angular arrow mark with different typography — or separate icon
and wordmark files, not a complete composed lockup. None is a substitute.

## How the variant was produced

The RGB channels were set to `0, 0, 0` while the **alpha channel was copied byte-for-byte**
from the source. Coverage and antialiasing live entirely in alpha, so the geometry is
mathematically unchanged.

Verified after generation:

- alpha channel identical to source — **0 mismatches** across all 118,312 pixels
- **0** of 16,324 opaque pixels are non-black
- content bounding box still `604 × 120` at the same coordinates
- canvas still `643 × 184`

Nothing was redrawn, retyped, recomposed, cropped, stretched or repositioned.

## Rules

- 🔴 Do not recreate, redraw, crop, stretch or distort this asset.
- 🔴 Do not separate the icon from the wordmark, and never render "TRIOLOO" as HTML/CSS text
  beside it.
- 🔴 Do not place a container shape behind it.
- Size it by declaring **one** dimension and letting the other derive, so the aspect ratio
  cannot drift.
- If the brand kit later supplies a true black master of this lockup, replace this file and
  update this record.
