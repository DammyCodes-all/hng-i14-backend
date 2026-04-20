/**
 * Types used across the service.
 *
 * Notes:
 * - External APIs may return null for some fields; types are therefore permissive.
 * - Profile.id is a string in runtime (UUID), using `string` avoids coupling to a crypto type.
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
  // count may be missing in some responses; allow undefined/null
  count?: number | null;
}

export interface CountryResponse {
  // Some responses may omit top-level fields; be permissive
  count?: number;
  name?: string;
  country?: {
    country_id?: string;
    probability?: number;
  }[];
}

export interface NormalizedResponse {
  status: string;
  data: {
    name: string;
    gender: string | null;
    probability: number | null;
    sample_size: number | null;
    is_confident: boolean;
    processed_at: string;
  };
}

export interface Profile {
  // Use string for UUIDs to avoid TypeScript issues with crypto UUID types across runtimes.
  id: string;
  name: string;
  gender: string | null;
  gender_probability: number | null;
  sample_size: number | null;
  age: number;
  age_group: string;
  // nationality fields may be absent for some profiles
  country_id?: string;
  country_probability?: number | null;
  created_at: string;
}
