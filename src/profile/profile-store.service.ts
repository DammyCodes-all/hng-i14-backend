import { Injectable } from '@nestjs/common';
import type { UUID } from 'crypto';
import type { Profile } from '../types';

@Injectable()
export class ProfileStoreService {
  private store: Profile[] = [];

  constructor() {}

  save(profile: Profile): void {
    this.store.push(profile);
  }

  findById(id: UUID): Profile | undefined {
    return this.store.find((p) => p.id === id);
  }

  findByName(name: string): Profile | undefined {
    return this.store.find((p) => p.name === name);
  }

  findAll(): Profile[] {
    return this.store;
  }

  deleteById(id: UUID): void {
    this.store = this.store.filter((p) => p.id !== id);
  }
}
