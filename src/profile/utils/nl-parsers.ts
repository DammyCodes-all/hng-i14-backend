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

  // Capture everything after "from [the]" — up to 60 characters
  const m = text.match(/\bfrom\s+(?:the\s+)?([A-Za-z][A-Za-z\s.\-']{0,60})/i);
  if (!m) return null;

  let candidate = m[1].trim();

  candidate = candidate
    .replace(
      /\s+(?:above|below|over|under|older|younger|less|more|aged?|and|with|\d).*/i,
      '',
    )
    .trim();

  if (!candidate) return null;

  const compact = candidate.replace(/[\s.]+/g, '');

  // 2 pure letters → treat as ISO country code
  if (/^[A-Za-z]{2}$/.test(compact)) {
    return { country_id: compact.toUpperCase() };
  }

  // Longer string → return lowercased name for LIKE matching
  return { country_name: candidate.toLowerCase() };
}
