# TrioLoo Invoice — design specification

**Artifact:** `TrioLoo Invoice.html` (Claude Design bundle, tracked in this folder)
**Owning contract:** [`ORDERS_SCREEN_CONTRACT.md`](../ORDERS_SCREEN_CONTRACT.md) `OSC-059`
**Written:** 2026-08-24 · **Transcribed from the bundle's own markup**, not from a screenshot

> ⚠ **THIS RECORDS WHAT THE DESIGN FIXES.** A mockup's sample data is a visual pattern to keep and
> a business claim to discard — the principle `design-reference/README.md` already states and
> `OSC-055.d` already applied to the Order Card.
>
> 🔴 **THIS INVOICE CARRIES MORE SAMPLE DATA THAN THE CARD DID, AND ONE PIECE OF IT IS A TAX RATE.**

---

## 1. Page geometry

| | |
|---|---|
| **Sheet** | `794px × 1123px` — **A4 at 96dpi**, so the design is print-shaped, not screen-shaped |
| **Ground** | `#f0f0f0` page, `#ffffff` sheet, `6px` radius, `0 4px 24px rgba(0,0,0,0.10)` |
| **Type** | `Hanken Grotesk` body · `Space Grotesk` for `INVOICE`, `Balance Due` and the footer line |
| **Padding** | `48px` horizontal throughout; header `36px` top |

⚠ **NEITHER TYPEFACE IS `Manrope`.** 🔴 **`DESIGN_CONSTITUTION.md` fixes Manrope for the
application UI.** ✅ **A printable is a different surface class and
`DOCUMENT_ARCHITECTURE.md` §15 decides NO typography at all** — *"no typography, colour, layout,
paper size, margin, QR, barcode, signature graphic or print CSS is decided here"*. ⚠ **So the
document face is genuinely undecided, and this design is the first proposal for it.**

---

## 2. Structure, in order

1. **Header** — logo slot · Trioloo address block · two status chips · `INVOICE` · reference lines
2. **Bill To** + **Bank Details**, side by side
3. **Items table** — `Item Description · Qty · Unit Price · Total`, black header row
4. **Warranty & Policies** + **Note** on the left; **totals** on the right
5. **Footer** — *Thank you for your purchase.* · `www.trioloo.com.bd`

### 2.1 The reference block — and the owner's ordering

The design's header carries **`No.`** then **`Parcel ID.`** then `Date` then `Due`.

✅ **THE PRODUCT OWNER'S DECISION, 2026-08-24, MATCHES AND EXTENDS THIS:** the **Trioloo invoice
number is the identity**, and the **booking id and the marketplace order number are REFERENCES that
sit AFTER it**.

| Line | Source | Issuing party |
|---|---|---|
| **`No.`** | `channel_order.trioloo_invoice_number` (`OSC-057`) | **Trioloo** |
| **Booking** | `shipment.consignment_id` | **Steadfast** |
| **Marketplace order** | `channel_order.external_order_id` | **Daraz** |

🔴 **`DB-013` — EACH REFERENCE NAMES ITS ISSUING PARTY.** ⚠ **The design labels one of them
`Parcel ID.` with no issuer, which is exactly the ambiguity `Phase 4` removed from the Order Card:
two parties may legitimately issue the same string.**

---

## 3. Real business data the design supplies

✅ **THESE ARE TRIOLOO'S OWN AND ARE NOT SAMPLE DATA.** They appear as literal text in the markup,
not as `{{ }}` placeholders, which is how the design distinguishes them.

| | |
|---|---|
| **Address** | R.B Tower 4th Floor (Lift-3), 56/9, Panthapath, Dhaka-1205, Bangladesh |
| **Phones** | 01805-026454 · 01805-026465 · 01894-830932 |
| **Email** | trioloobd@gmail.com · contract@trioloo.com.bd |
| **Bank** | Al-Arafah Islami Bank PLC, Panthapath, Dhaka |
| **A/C** | TRIOLOO — 0841020007385 |
| **Web** | www.trioloo.com.bd |

⚠ **THEY ARE STILL CONFIGURATION, NOT CONSTANTS.** **A bank account number compiled into a
printable is changed by a deployment; the same number in configuration is changed by a person who
owns it.**

---

## 4. 🔴 Sample data — what must NOT be taken from this design

| The design shows | Why it is not implemented from here |
|---|---|
| **`vatRate = 7.5`** | 🔴 **A TAX RATE, AND THE MOST DANGEROUS VALUE IN THIS FILE.** It is hard-coded in `renderVals()` **beside the sample Lenovo/Samsung line items and a `charges = 800`** — the same block, the same status as those. **`GAP-003` records that NO tax model exists: no rate, no BIN, no Mushak requirement, no calculation.** ⚠ **`BD-307` permits VAT to be DISPLAYED as an invoice field while the ERP maintains no VAT accounts, which makes the FIELD legitimate and the NUMBER still undecided.** 🔴 **Bangladesh has more than one lawful rate and which applies is a legal question about Trioloo's registration and product categories — not something to read off a mockup.** |
| **Four sample line items** | Lenovo, Samsung, Dell, Logitech with prices. Obvious sample. |
| **`charges = 800`** | Delivery & handling. `DLV §13` owns the customer delivery charge; no figure is fixed. |
| **`Collected Advance`** | 🔴 **PARTIAL PAYMENT AT CREATION IS EXACTLY WHAT `GAP-035` LEAVES OPEN**, and `§11.3`'s `NOT_DUE` says payment is not due before delivery. ⚠ The row is a real business question, not a rendering detail. |
| **`Due` date — *Jul 12, 2026*** | **No payment-term rule exists anywhere in the corpus.** A due date implies one. |
| **`invoiceNo: 'TRL-2026-0418'`** | Superseded — `OSC-057` fixes the format as `TR0001` upward. |
| **Warranty bullets** | *"minimum 3-year manufacturer's warranty"*, *"7 days with product replacement"*. ⚠ **Warranty terms are `WARRANTY_ARCHITECTURE.md`'s**, and a printable must render them from their owner rather than restate them. |
| **`paymentStatus` enum** | `Paid` / `Partially Paid` / `Due` — ⚠ **NOT `SM-5`.** `SM-5` has eleven states and `OSC-056.b` already fixed which three this system can honestly show. |
| **`deliveryStatus` enum** | `Delivered` / `Shipped` / `Processing` / `Pending` — ⚠ **NOT `SM-4`**, which has fourteen. `Shipped` and `Processing` are not `SM-4` states at all. |

---

## 5. What the design gets right and should be kept

✅ **The economic hierarchy.** Subtotal, charges and VAT are quiet; **`Balance Due` is an
ink-filled block at `22px`** — the one number a customer looks for.
✅ **Two status chips, side by side, never merged** — payment and delivery as separate facts, which
is `BR-171`/`UX-182`'s own principle arriving independently.
✅ **`font-variant-numeric: tabular-nums`** on the totals column.
✅ **Bank details on the invoice**, which is how a COD-heavy business gets paid by transfer.
✅ **Warranty and Note given real space** rather than being footnotes.

---

## 6. Layout obligations

🔴 **A printable is not a workspace.** `RULE 7.4`'s structured-row non-wrap and `UX-265`'s
`overflow-x` prohibition govern operational UI; **a document is paginated, and its columns are
fixed by the sheet.** ⚠ **The items table must break across pages without orphaning a row's
figures from its description.**

🔴 **`INV-39.2` — THE CONTENT IS SNAPSHOTTED.** **An invoice must render identically years later,
so it renders from the `E-039` snapshot and never re-derives a price, an address or a total from
live records** (`PRN-022` — one deterministic authoritative source, and the rendering never becomes
that source).
