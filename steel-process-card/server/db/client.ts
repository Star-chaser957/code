import { appConfig } from '../config';
import { PostgresSyncService } from './postgres-sync';
import { SqliteService } from './sqlite';

export type BindParams = Array<string | number | null>;

export interface DatabaseClient {
  init(): Promise<unknown>;
  query<T extends Record<string, unknown>>(sql: string, params?: BindParams): T[];
  exec(sql: string): unknown;
  run(sql: string, params?: BindParams): void;
  transaction<T>(callback: () => T): T;
  persist(): Promise<void>;
  listColumns(table: string): string[];
}

export function createDatabaseClient(): DatabaseClient {
  if (appConfig.dbClient === 'postgres') {
    return new PostgresSyncService(appConfig.postgresUrl);
  }

  return new SqliteService(appConfig.sqliteFilePath);
}
