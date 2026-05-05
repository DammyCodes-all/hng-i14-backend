import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class SchemaRepairService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchemaRepairService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.repairTimestampColumns();
    await this.repairProfileNameUniqueness();
  }

  private async repairTimestampColumns(): Promise<void> {
    const runner = this.dataSource.createQueryRunner();

    try {
      await runner.connect();

      const tables = (await runner.query(
        `
          SELECT DISTINCT table_schema, table_name, column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND column_name IN ('created_at', 'updated_at')
          ORDER BY table_name, column_name
        `,
      )) as Array<{
        table_schema: string;
        table_name: string;
        column_name: string;
      }>;

      for (const column of tables) {
        const qualifiedTable = `${this.quoteIdentifier(column.table_schema)}.${this.quoteIdentifier(column.table_name)}`;
        const quotedColumn = this.quoteIdentifier(column.column_name);

        await runner.query(
          `UPDATE ${qualifiedTable} SET ${quotedColumn} = CURRENT_TIMESTAMP WHERE ${quotedColumn} IS NULL`,
        );

        await runner.query(
          `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${quotedColumn} SET DEFAULT CURRENT_TIMESTAMP`,
        );

        await runner.query(
          `ALTER TABLE ${qualifiedTable} ALTER COLUMN ${quotedColumn} SET NOT NULL`,
        );
      }

      this.logger.log(
        `Repaired timestamp defaults for ${tables.length} column(s)`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to repair timestamp defaults',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async repairProfileNameUniqueness(): Promise<void> {
    const runner = this.dataSource.createQueryRunner();

    try {
      await runner.connect();

      await runner.startTransaction();

      await runner.query(`
        WITH ranked AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY name
              ORDER BY created_at ASC NULLS LAST, id ASC
            ) AS rn
          FROM profiles
        )
        DELETE FROM profiles
        WHERE id IN (
          SELECT id
          FROM ranked
          WHERE rn > 1
        )
      `);

      await runner.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_profiles_name_unique" ON "profiles" ("name")`,
      );

      await runner.query(`DROP INDEX IF EXISTS "IDX_profiles_name"`);

      await runner.commitTransaction();
      this.logger.log('Repaired profile name uniqueness');
    } catch (error) {
      await runner.rollbackTransaction();
      this.logger.error(
        'Failed to repair profile name uniqueness',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    } finally {
      await runner.release();
    }
  }

  private quoteIdentifier(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }
}