import type { UUID } from 'crypto';

export interface GenderizeResponse {
  gender: string;
  probability: number;
  count: number;
  name: string;
}

export interface AgifyResponse {
  age: number;
  name: string;
  count: number;
}

export interface CountryResponse {
  count: number;
  name: string;
  country: {
    country_id: string;
    probability: number;
  }[];
}

export interface NormalizedResponse {
  status: string;
  data: {
    name: string;
    gender: string;
    probability: number;
    sample_size: number;
    is_confident: boolean;
    processed_at: string;
  };
}

export interface Profile {
  id: UUID;
  name: string;
  gender: string;
  gender_probability: number;
  sample_size: number;
  age: number;
  age_group: string;
  country_id: string;
  country_probability: number;
  created_at: string;
}
