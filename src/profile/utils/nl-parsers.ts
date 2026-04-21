export type FromCountryResult = {
  country_id?: string;
  country_name?: string;
} | null;

export function parseAboveValue(
  text: string | undefined | null,
): number | null {
  if (!text) return null;
  const m = text.match(/(?:above|over|more than|older than| >)\s*(\d+)\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? null : n;
}

export function parseBelowValue(
  text: string | undefined | null,
): number | null {
  if (!text) return null;
  const m = text.match(/(?:below|under|less than|younger than|<)\s*(\d+)\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? null : n;
}

export function parseFromCountry(
  text: string | undefined | null,
): FromCountryResult {
  if (!text) return null;

  // capture the token(s) following 'from' (up to a reasonable length)
  const m = text.match(/\bfrom\s+([A-Za-z][A-Za-z\s\.\-']{0,60})/i);
  if (!m) return null;

  let candidate = m[1].trim();

  // remove leading 'the' (e.g. "from the United Kingdom")
  candidate = candidate.replace(/^\s*the\s+/i, '').trim();
  if (!candidate) return null;

  // compact (remove dots/spaces) for code detection (e.g. "U.S." -> "US")
  const compact = candidate.replace(/[\.\s]+/g, '');

  // if compact is 2-3 letters, treat as country code
  if (/^[A-Za-z]{2,3}$/.test(compact)) {
    return { country_id: compact.toUpperCase() };
  }

  // otherwise return the lowercased candidate string for LIKE matching
  return { country_name: candidate.toLowerCase() };
}
