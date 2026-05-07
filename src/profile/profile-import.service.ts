import { Injectable, Logger } from '@nestjs/common';
import { Readable, Transform } from 'stream';
import csvParser from 'csv-parser';
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

type CsvRow = {
  name?: string;
  gender?: string;
  gender_probability?: string;
  age?: string;
  age_group?: string;
  country_id?: string;
  country_name?: string;
  country_probability?: string;
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
      const parser: Transform = csvParser({ separator: ',', strict: false });

      let total = 0;
      let inserted = 0;
      let skipped = 0;
      let encounteredError = false;
      let errorMessage: string | null = null;

      const reasons: Record<string, number> = {};

      const batch: CsvRow[] = [];
      let headerCount: number | null = null;

      const flushBatch = async (): Promise<void> => {
        if (batch.length === 0) return;
        const current = batch.splice(0, batch.length);

        const entities = current.map((r) => {
          const entity = new ProfileEntity();
          entity.name = normalizeName(r.name ?? '');
          entity.gender = normalizeLower(r.gender);
          entity.gender_probability =
            r.gender_probability != null && r.gender_probability !== ''
              ? Number(r.gender_probability)
              : null;
          entity.age = r.age != null && r.age !== '' ? Number(r.age) : null;
          entity.age_group = normalizeLower(r.age_group);
          entity.country_id = normalizeUpper(r.country_id);
          entity.country_name = r.country_name
            ? String(r.country_name).trim()
            : null;
          entity.country_probability =
            r.country_probability != null && r.country_probability !== ''
              ? Number(r.country_probability)
              : null;
          return entity;
        });

        try {
          const result = await this.profileRepository
            .createQueryBuilder()
            .insert()
            .into(ProfileEntity)
            .values(entities)
            .orIgnore()
            .execute();

          const insertedCount = result.identifiers.length;
          const duplicateCount = entities.length - insertedCount;

          inserted += insertedCount;
          if (duplicateCount > 0) {
            skipped += duplicateCount;
            reasons.duplicate_name =
              (reasons.duplicate_name || 0) + duplicateCount;
          }
        } catch {
          this.logger.warn(
            'Bulk insert failed, falling back to per-row save for this batch',
          );

          for (const entity of entities) {
            try {
              await this.profileRepository.save(entity);
              inserted += 1;
            } catch {
              skipped += 1;
              reasons.duplicate_name = (reasons.duplicate_name || 0) + 1;
            }
          }
        }
      };

      const finalize = async (): Promise<void> => {
        try {
          await flushBatch();

          resolve({
            status: encounteredError ? 'partial' : 'success',
            total_rows: total,
            inserted,
            skipped,
            reasons: errorMessage
              ? {
                  ...reasons,
                  stream_error: (reasons.stream_error || 0) + 1,
                }
              : reasons,
          });
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };

      parser.on('headers', (headers: string[]) => {
        headerCount = headers.length;
      });

      parser.on('data', (row: CsvRow) => {
        total += 1;

        if (headerCount != null && Object.keys(row).length !== headerCount) {
          skipped += 1;
          reasons.malformed_row = (reasons.malformed_row || 0) + 1;
          return;
        }

        if (!row.name || String(row.name).trim() === '') {
          skipped += 1;
          reasons.missing_fields = (reasons.missing_fields || 0) + 1;
          return;
        }

        if (row.age && (Number.isNaN(Number(row.age)) || Number(row.age) < 0)) {
          skipped += 1;
          reasons.invalid_age = (reasons.invalid_age || 0) + 1;
          return;
        }

        if (row.gender && typeof row.gender === 'string') {
          const g = String(row.gender).trim().toLowerCase();
          if (g !== 'male' && g !== 'female' && g !== '') {
            skipped += 1;
            reasons.invalid_gender = (reasons.invalid_gender || 0) + 1;
            return;
          }
        }

        batch.push(row);

        if (batch.length >= this.BATCH_SIZE) {
          parser.pause();

          flushBatch()
            .then(() => {
              parser.resume();
            })
            .catch((err: unknown) => {
              parser.emit(
                'error',
                err instanceof Error ? err : new Error(String(err)),
              );
            });
        }
      });

      parser.on('error', (err: unknown) => {
        encounteredError = true;
        errorMessage = err instanceof Error ? err.message : String(err);

        this.logger.error(
          'CSV parse error',
          err instanceof Error ? err.stack : undefined,
        );

        finalize().catch((finalizeErr: unknown) => {
          reject(
            finalizeErr instanceof Error
              ? finalizeErr
              : new Error(String(finalizeErr)),
          );
        });
      });

      parser.on('end', () => {
        finalize().catch((finalizeErr: unknown) => {
          reject(
            finalizeErr instanceof Error
              ? finalizeErr
              : new Error(String(finalizeErr)),
          );
        });
      });

      input.pipe(parser);
    });
  }
}
