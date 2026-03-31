import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import initSqlJs, { type BindParams, type Database, type QueryExecResult, type SqlJsStatic } from 'sql.js';

const require = createRequire(import.meta.url);

export class SqliteService {
  private sql?: SqlJsStatic;
  private db?: Database;
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async init() {
    if (this.db) {
      return this.db;
    }

    const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
    this.sql = await initSqlJs({
      locateFile: () => wasmPath,
    });

    await mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await access(this.filePath);
      const data = await readFile(this.filePath);
      this.db = new this.sql.Database(data);
    } catch {
      this.db = new this.sql.Database();
    }

    this.db.run('PRAGMA foreign_keys = ON;');
    return this.db;
  }

  get database() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return this.db;
  }

  query<T extends Record<string, unknown>>(sql: string, params: BindParams = []): T[] {
    const statement = this.database.prepare(sql, params);
    const rows: T[] = [];

    while (statement.step()) {
      rows.push(statement.getAsObject() as T);
    }

    statement.free();
    return rows;
  }

  exec(sql: string): QueryExecResult[] {
    return this.database.exec(sql);
  }

  run(sql: string, params: BindParams = []) {
    this.database.run(sql, params);
  }

  transaction<T>(callback: () => T) {
    this.run('BEGIN');
    try {
      const result = callback();
      this.run('COMMIT');
      return result;
    } catch (error) {
      this.run('ROLLBACK');
      throw error;
    }
  }

  async persist() {
    const data = this.database.export();
    await writeFile(this.filePath, Buffer.from(data));
  }
}
