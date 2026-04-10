import { Injectable } from '@nestjs/common';
import { GenderizeResponse, NormalizedResponse } from 'src/types';

@Injectable()
export class ClassifyService {
  async classifyName(name: string): Promise<NormalizedResponse> {
    const res = await fetch(`https://api.genderize.io?name=${name}`);
    const data: GenderizeResponse = await res.json();
    return {
      status: 'success',
      data: {
        name,
        gender: data.gender,
        probability: data.probability,
        sample_size: data.count,
        is_confident: data.probability >= 0.7 && data.count >= 100,
        processed_at: new Date().toISOString(),
      },
    };
  }
}
