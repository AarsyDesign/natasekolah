/**
 * Utilitas highlight potongan teks yang cocok dengan kueri pencarian
 * (Phase 12.1 — Search UX).
 *
 * Desain:
 * - Murni (tanpa DOM) supaya bisa diuji unit test di Node.
 * - Case-insensitive dan mentolerir spasi berlebih di kueri.
 * - Mengembalikan segmen teks berurutan; konsumen tinggal merender
 *   segmen `matched` dengan <mark> di UI (aman — tidak ada innerHTML).
 */

export interface SearchHighlightSegment {
  text: string;
  matched: boolean;
}

/** Normalisasi kueri: trim, rapatkan spasi, huruf kecil. */
export function normalizeHighlightQuery(raw: string): string {
  return (raw || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Pecah `text` menjadi segmen yang cocok / tidak cocok dengan `query`.
 *
 * - Query kosong / < 2 karakter → satu segmen non-match penuh.
 * - Kecocokan dihitung pada teks yang sudah dinormalisasi tetapi offset
 *   dikembalikan ke posisi asli (spasi berlebih di teks tidak menggeser
 *   highlight keliru).
 */
export function highlightSearchMatches(
  text: string,
  query: string
): SearchHighlightSegment[] {
  const source = text || "";
  const q = normalizeHighlightQuery(query);

  if (q.length < 2 || source.length === 0) {
    return source ? [{ text: source, matched: false }] : [];
  }

  const segments: SearchHighlightSegment[] = [];
  const haystack = source.toLowerCase();

  let cursor = 0;
  let index = haystack.indexOf(q, cursor);
  while (index !== -1) {
    if (index > cursor) {
      segments.push({ text: source.slice(cursor, index), matched: false });
    }
    segments.push({ text: source.slice(index, index + q.length), matched: true });
    cursor = index + q.length;
    index = haystack.indexOf(q, cursor);
  }

  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), matched: false });
  }

  return segments.length > 0
    ? segments
    : [{ text: source, matched: false }];
}

/** True bila setidaknya satu bagian dari `text` cocok dengan `query`. */
export function hasSearchMatch(text: string, query: string): boolean {
  return highlightSearchMatches(text, query).some((s) => s.matched);
}
