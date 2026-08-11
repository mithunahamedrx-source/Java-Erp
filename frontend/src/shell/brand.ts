/**
 * The application-display brand.
 *
 * <p>🔴 ONE canonical string, spelled `TrioLoo`. Every user-facing surface that presents the
 * shared application brand — sidebar brand block, login surface, document title — reads it
 * from here, so a variant spelling cannot drift into one surface while another stays right.
 *
 * <p>⚠ This is the DISPLAY brand only. It is deliberately not used to rewrite historical,
 * legal or business data, package identifiers, database names, storage keys or API paths —
 * those carry their own recorded identity and are not presentation.
 */
export const APPLICATION_BRAND = 'TrioLoo';
