/**
 * DISPLAY-ONLY instant formatting.
 *
 * 🔴 The server's instant is authoritative and is never altered. These helpers change only
 * how a moment READS, and an unparseable value is passed through verbatim rather than
 * replaced with a guess.
 */

/** e.g. `28 Jul 2026, 16:04`. */
export function formatMoment(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : at.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

/** e.g. `13 Aug, 08:15` — the compact form a dense list uses. */
export function formatShortMoment(iso: string | null | undefined): string | null {
  if (!iso) {
    return null;
  }
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? iso
    : at.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
