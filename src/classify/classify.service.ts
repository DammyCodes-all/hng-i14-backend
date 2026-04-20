import { Injectable } from '@nestjs/common';
import { GenderizeResponse, NormalizedResponse } from 'src/types';

@Injectable()
export class ClassifyService {
  async classifyName(name: string): Promise<NormalizedResponse> {
    const encoded = encodeURIComponent(name);
    // Create a typed fetch wrapper to avoid unsafe `any` usage from globalThis.
    // We cast the global value to a known function signature so subsequent calls are typed.
    const fetchFn = (globalThis as any).fetch as (
      input: RequestInfo,
      init?: RequestInit,
    ) => Promise<Response>;
    const res = await fetchFn(`https://api.genderize.io?name=${encoded}`);
    if (!res.ok) {
      // Normalize errors at this boundary; caller/controller should map to appropriate HTTP response.
      throw new Error(`Genderize returned status ${res.status}`);
    }
    const data: GenderizeResponse = await res.json();

    // Normalize nullable fields coming from the external API
    const probability = data.probability ?? 0;
    const sample_size = data.count ?? 0;

    return {
      status: 'success',
      data: {
        name,
        gender: data.gender ?? null,
        probability,
        sample_size,
        is_confident: probability >= 0.7 && sample_size >= 100,
        processed_at: new Date().toISOString(),
      },
    };
  }
}
