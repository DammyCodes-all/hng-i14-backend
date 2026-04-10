export interface GenderizeResponse {
  gender: string;
  probability: number;
  count: number;
  name: string;
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
