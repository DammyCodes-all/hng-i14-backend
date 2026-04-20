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

export interface Profile {
  id: string;
  name: string;
  gender?: string | null;
  gender_probability?: number | null;
  age?: number | null;
  age_group?: string | null;
  country_id?: string | null;
  country_probability?: number | null;
  created_at: string;
}
