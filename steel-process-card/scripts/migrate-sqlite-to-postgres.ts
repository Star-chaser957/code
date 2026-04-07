import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { Client } from 'pg';
import { SqliteService } from '../server/db/sqlite';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptRoot, '..');

const sqliteFilePath = process.env.SQLITE_FILE_PATH
  ? path.isAbsolute(process.env.SQLITE_FILE_PATH)
    ? process.env.SQLITE_FILE_PATH
    : path.resolve(projectRoot, process.env.SQLITE_FILE_PATH)
  : path.join(projectRoot, 'server', 'data', 'process-cards.sqlite');

const postgresUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? '';

if (!postgresUrl.trim()) {
  console.error('Missing POSTGRES_URL or DATABASE_URL in environment.');
  process.exit(1);
}

const tableOrder = [
  'process_cards',
  'operation_definitions',
  'operation_option_definitions',
  'card_operations',
  'card_operation_selected_options',
  'operation_details',
  'department_options',
  'users',
  'user_roles',
  'sessions',
  'process_card_approval_logs',
  'audit_logs',
] as const;

const truncateOrder = [
  'audit_logs',
  'process_card_approval_logs',
  'sessions',
  'user_roles',
  'users',
  'department_options',
  'operation_details',
  'card_operation_selected_options',
  'card_operations',
  'operation_option_definitions',
  'operation_definitions',
  'process_cards',
] as const;

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function getRowId(row: Record<string, unknown>) {
  return typeof row.id === 'string' ? row.id : '';
}

async function main() {
  const sqlite = new SqliteService(sqliteFilePath);
  await sqlite.init();

  const schemaSql = await readFile(path.join(projectRoot, 'server', 'db', 'schema.postgres.sql'), 'utf8');
  const client = new Client({ connectionString: postgresUrl });

  await client.connect();

  try {
    console.log(`Using SQLite source: ${sqliteFilePath}`);
    console.log('Connecting to PostgreSQL and applying schema...');

    await client.query('BEGIN');
    await client.query(schemaSql);
    await client.query(`TRUNCATE TABLE ${truncateOrder.join(', ')} CASCADE`);

    const importedIds = new Map<string, Set<string>>();

    for (const table of tableOrder) {
      const rows = sqlite.query<Record<string, unknown>>(`SELECT * FROM ${table}`);
      let filteredRows = rows;

      if (table === 'card_operations') {
        const cardIds = importedIds.get('process_cards') ?? new Set<string>();
        filteredRows = rows.filter((row) => cardIds.has(String(row.card_id ?? '')));
      }

      if (table === 'card_operation_selected_options') {
        const operationIds = importedIds.get('card_operations') ?? new Set<string>();
        filteredRows = rows.filter((row) => operationIds.has(String(row.card_operation_id ?? '')));
      }

      if (table === 'operation_details') {
        const operationIds = importedIds.get('card_operations') ?? new Set<string>();
        filteredRows = rows.filter((row) => operationIds.has(String(row.card_operation_id ?? '')));
      }

      if (table === 'user_roles' || table === 'sessions') {
        const userIds = importedIds.get('users') ?? new Set<string>();
        filteredRows = rows.filter((row) => userIds.has(String(row.user_id ?? '')));
      }

      if (table === 'process_card_approval_logs') {
        const cardIds = importedIds.get('process_cards') ?? new Set<string>();
        const userIds = importedIds.get('users') ?? new Set<string>();
        filteredRows = rows.filter(
          (row) =>
            cardIds.has(String(row.card_id ?? '')) &&
            userIds.has(String(row.actor_user_id ?? '')) &&
            (!String(row.target_user_id ?? '') || userIds.has(String(row.target_user_id ?? ''))),
        );
      }

      if (rows.length === 0) {
        console.log(`Skipping ${table}: 0 rows`);
        continue;
      }

      if (filteredRows.length === 0) {
        console.log(`Skipping ${table}: 0 valid rows after FK filtering (${rows.length} source rows)`);
        importedIds.set(table, new Set<string>());
        continue;
      }

      const columns = Object.keys(filteredRows[0]);
      const quotedColumns = columns.map(quoteIdentifier).join(', ');

      for (const row of filteredRows) {
        const values = columns.map((column) => row[column] ?? null);
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        await client.query(
          `INSERT INTO ${table} (${quotedColumns}) VALUES (${placeholders})`,
          values,
        );
      }

      importedIds.set(
        table,
        new Set<string>(filteredRows.map(getRowId).filter(Boolean)),
      );

      const skippedCount = rows.length - filteredRows.length;
      console.log(
        `Migrated ${table}: ${filteredRows.length} rows${skippedCount > 0 ? `, skipped ${skippedCount} invalid rows` : ''}`,
      );
    }

    await client.query('COMMIT');
    console.log('SQLite data migrated to PostgreSQL successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
