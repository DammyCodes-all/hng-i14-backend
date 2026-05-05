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
    for (const columnName of ['created_at', 'updated_at']) {
      await this.repairTimestampColumn(columnName);
    }
  }

  private async repairTimestampColumn(columnName: string): Promise<void> {
    const runner = this.dataSource.createQueryRunner();

    try {
      await runner.connect();

      const tables = (await runner.query(
        `
          SELECT DISTINCT table_schema, table_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND column_name = $1
          ORDER BY table_name
        `,
        [columnName],
      )) as Array<{ table_schema: string; table_name: string }>;

      for (const table of tables) {
        const qualifiedTable = `${this.quoteIdentifier(table.table_schema)}.${this.quoteIdentifier(table.table_name)}`;
        const quotedColumn = this.quoteIdentifier(columnName);

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
        `Repaired ${columnName} defaults for ${tables.length} table(s)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to repair ${columnName} defaults`,
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