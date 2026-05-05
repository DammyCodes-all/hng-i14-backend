import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
const csvParser: any = require('csv-parser');
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileEntity } from './profile.entity';
import {
  normalizeLower,
  normalizeName,
  normalizeUpper,
} from './profile.import.helpers';

type Summary = {
  status: 'success' | 'partial' | 'failed';
  total_rows: number;
  inserted: number;
  skipped: number;
  reasons: Record<string, number>;
};

@Injectable()
export class ProfileImportService {
  private readonly logger = new Logger(ProfileImportService.name);
  private readonly BATCH_SIZE = 1000;

  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
  ) {}

  async importCsvStream(input: Readable): Promise<Summary> {
    return new Promise<Summary>((resolve, reject) => {
      const parser = csvParser({ separator: ',', skipLines: 0, strict: false });

      let total = 0;
      let inserted = 0;
      let skipped = 0;

      const reasons: Record<string, number> = {} as Record<string, number>;

      const batch: Array<Record<string, any>> = [];
      let headerCount: number | null = null;

      const flushBatch = async () => {
        if (batch.length === 0) return;
        const current = batch.splice(0, batch.length);

        const names = current.map((r) => normalizeName(String(r.name)));

        const existing = await this.profileRepository
          .createQueryBuilder('p')
          .select('p.name', 'name')
          .where('p.name IN (:...names)', { names })
          .getRawMany();

        const existingSet = new Set(existing.map((e: any) => e.name));

        const toInsert = current.filter(
          (r) => !existingSet.has(normalizeName(String(r.name))),
        );
        const duplicatesCount = current.length - toInsert.length;

        if (duplicatesCount > 0) {
          skipped += duplicatesCount;
          reasons['duplicate_name'] =
            (reasons['duplicate_name'] || 0) + duplicatesCount;
        }

        if (toInsert.length === 0) return;

        const entities = toInsert.map((r) => {
          const e: Partial<ProfileEntity> = {};
          e.name = normalizeName(String(r.name));
          e.gender = normalizeLower(r.gender ?? null);
          e.gender_probability = r.gender_probability
            ? Number(r.gender_probability)
            : null;
          e.age = r.age ? Number(r.age) : null;
          e.age_group = normalizeLower(r.age_group ?? null);
          e.country_id = normalizeUpper(r.country_id ?? null);
          e.country_name = r.country_name
            ? String(r.country_name).trim()
            : null;
          e.country_probability = r.country_probability
            ? Number(r.country_probability)
            : null;
          return e;
        });

        try {
          await this.profileRepository
            .createQueryBuilder()
            .insert()
            .into(ProfileEntity)
            .values(entities)
            .orIgnore()
            .execute();

          inserted += entities.length;
        } catch (err) {
          // best-effort fallback: try per-row save to detect conflicts
          this.logger.warn(
            'Bulk insert failed, falling back to per-row save for this batch',
          );
          for (const e of entities) {
            try {
              await this.profileRepository.save(e as ProfileEntity);
              inserted += 1;
            } catch (inner) {
              skipped += 1;
              reasons['duplicate_name'] = (reasons['duplicate_name'] || 0) + 1;
            }
          }
        }
      };

      parser.on('headers', (headers: string[]) => {
        headerCount = headers.length;
      });

      parser.on('data', (row: Record<string, any>) => {
        total += 1;

        if (headerCount != null && Object.keys(row).length !== headerCount) {
          skipped += 1;
          reasons['malformed_row'] = (reasons['malformed_row'] || 0) + 1;
          return;
        }

        if (!row || !row.name || String(row.name).trim() === '') {
          skipped += 1;
          reasons['missing_fields'] = (reasons['missing_fields'] || 0) + 1;
          return;
        }

        if (row.age && Number(row.age) < 0) {
          skipped += 1;
          reasons['invalid_age'] = (reasons['invalid_age'] || 0) + 1;
          return;
        }

        if (row.gender && typeof row.gender === 'string') {
          const g = String(row.gender).trim().toLowerCase();
          if (g !== 'male' && g !== 'female' && g !== '') {
            skipped += 1;
            reasons['invalid_gender'] = (reasons['invalid_gender'] || 0) + 1;
            return;
          }
        }

        batch.push(row);

        if (batch.length >= this.BATCH_SIZE) {
          try {
            (input as Readable).pause();
          } catch {}

          flushBatch()
            .then(() => {
              try {
                (input as Readable).resume();
              } catch {}
            })
            .catch((err) => parser.emit('error', err));
        }
      });

      parser.on('error', (err) => {
        this.logger.error('CSV parse error', err.stack || err);
        reject(err);
      });

      parser.on('end', async () => {
        try {
          await flushBatch();
          resolve({
            status: 'success',
            total_rows: total,
            inserted,
            skipped,
            reasons,
          });
        } catch (err) {
          reject(err);
        }
      });

      input.pipe(parser as any);
    });
  }
}
