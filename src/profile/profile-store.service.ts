import { Injectable } from '@nestjs/common';
import type { Profile } from '../types';

/**
 * Simple in-memory store for Profile objects.
 *
 * Notes:
 * - Profile.id is treated as a string (UUID) across the app to avoid coupling to crypto UUID types.
 * - Methods use `string` for id parameters and return types.
 * - This store is intentionally lightweight and synchronous to match the Stage 1 assessment.
 */
@Injectable()
export class ProfileStoreService {
  private store: Profile[] = [];

  constructor() {}

  /**
   * Persist a profile to the in-memory store.
   * If a profile with the same id already exists, it will be replaced.
   */
  save(profile: Profile): void {
    const idx = this.store.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      this.store[idx] = profile;
    } else {
      this.store.push(profile);
    }
  }

  /**
   * Find a profile by its string id.
   * Returns undefined if not found.
   */
  findById(id: string): Profile | undefined {
    return this.store.find((p) => p.id === id);
  }

  /**
   * Find a profile by name (case-sensitive).
   * Returns undefined if not found.
   *
   * Note: Controller/service layers can normalize name casing if case-insensitive lookup is desired.
   */
  findByName(name: string): Profile | undefined {
    return this.store.find((p) => p.name === name);
  }

  /**
   * Return all profiles.
   * A shallow copy is returned to avoid accidental external mutations of the internal array.
   */
  findAll(): Profile[] {
    return [...this.store];
  }

  /**
   * Delete a profile by id. If the id does not exist no error is thrown.
   */
  deleteById(id: string): void {
    this.store = this.store.filter((p) => p.id !== id);
  }
}
