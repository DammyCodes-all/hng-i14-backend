/**
 * Types used across the service.
 *
 * This file also exports a small helper `fetchCountryName` which resolves a
 * two-letter country code (ISO alpha-2) to a human-readable name using the
 * VerifyMe countries endpoint:
 *   GET https://vapi.verifyme.ng/v1/countries/:id
 *
 * The helper is intentionally small and returns `null` on any failure so callers
 * can decide whether to treat the absence of a country name as fatal.
 */

export interface GenderizeResponse {
  gender: string | null;
  probability: number | null;
  count: number | null;
  name: string;
}

export interface AgifyResponse {
  age: number | null;
  name: string;
  count?: number | null;
}

export interface CountryResponse {
  count?: number;
  name?: string;
  country?: {
    country_id?: string;
    probability?: number;
  }[];
}

/**
 * VerifyMe countries API response shape (simplified)
 * Example:
 * {
 *   "status": "success",
 *   "data": {
 *     "id": "1",
 *     "code": "NG",
 *     "name": "Nigeria"
 *   }
 * }
 */
export interface VerifyMeCountryResponse {
  status: string;
  data?: {
    id?: string;
    code?: string;
    name?: string;
  } | null;
}

/**
 * Normalized response used by the classify endpoint.
 */
export interface NormalizedResponse {
  status: string;
  data: {
    name: string;
    gender: string | null;
    probability: number | null;
    is_confident: boolean;
    processed_at: string;
  };
}

/**
 * Profile object returned by the API.
 *
 * Note:
 * - `id` is a string UUID.
 * - `country_name` is optional and may be null when not available.
 */
export interface Profile {
  id: string;
  name: string;
  gender?: string | null;
  gender_probability?: number | null;
  age?: number | null;
  age_group?: string | null;
  country_id?: string | null;
  country_name?: string | null;
  country_probability?: number | null;
  created_at: string;
}

/**
 * Helper: Fetch country name from VerifyMe API.
 *
 * - Accepts a country id / code (commonly ISO alpha-2 like "NG").
 * - Returns the country name (e.g. "Nigeria") or `null` on any failure.
 *
 * Note: This helper is intentionally permissive: network or parsing errors
 * result in `null` so callers may choose to continue without a country name.
 */
export async function fetchCountryName(
  countryId: string,
): Promise<string | null> {
  if (!countryId) return null;

  try {
    const code = encodeURIComponent(countryId.toUpperCase());
    const res = await fetch(`https://vapi.verifyme.ng/v1/countries/${code}`);

    if (!res.ok) return null;

    // Attempt to parse the known response shape
    const body = (await res.json()) as VerifyMeCountryResponse | null;
    return body?.data?.name ?? null;
  } catch {
    return null;
  }
}
