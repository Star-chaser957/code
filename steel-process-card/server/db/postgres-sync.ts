import { MessageChannel, Worker, receiveMessageOnPort } from 'node:worker_threads';
import type { DatabaseClient, BindParams } from './client';

type WorkerPayload =
  | { type: 'init' }
  | {
      type: 'query' | 'run' | 'exec';
      sql: string;
      params?: BindParams;
    };

type WorkerReply =
  | { ok: true; result: unknown }
  | {
      ok: false;
      error: {
        message: string;
        code?: string;
        detail?: string;
      };
    };

export class PostgresSyncService implements DatabaseClient {
  private readonly connectionString: string;
  private worker?: Worker;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async init() {
    if (this.worker) {
      return;
    }

    this.worker = new Worker(new URL('./postgres-sync-worker.ts', import.meta.url), {
      execArgv: ['--import', 'tsx/esm'],
      workerData: {
        connectionString: this.connectionString,
      },
    });

    this.request({ type: 'init' });
  }

  query<T extends Record<string, unknown>>(sql: string, params: BindParams = []): T[] {
    return this.request<T[]>({ type: 'query', sql, params });
  }

  exec(sql: string) {
    return this.request({ type: 'exec', sql });
  }

  run(sql: string, params: BindParams = []) {
    this.request({ type: 'run', sql, params });
  }

  transaction<T>(callback: () => T) {
    this.run('BEGIN');
    try {
      const result = callback();
      this.run('COMMIT');
      return result;
    } catch (error) {
      try {
        this.run('ROLLBACK');
      } catch {
        // Ignore rollback errors after the original failure.
      }
      throw error;
    }
  }

  async persist() {
    return Promise.resolve();
  }

  listColumns(table: string) {
    const rows = this.query<{ column_name: string }>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ?
      `,
      [table],
    );

    return rows.map((row) => row.column_name);
  }

  private request<T>(payload: WorkerPayload): T {
    if (!this.worker) {
      throw new Error('PostgreSQL worker is not initialized.');
    }

    const signalBuffer = new SharedArrayBuffer(4);
    const signal = new Int32Array(signalBuffer);
    const channel = new MessageChannel();

    this.worker.postMessage(
      {
        ...payload,
        signal: signalBuffer,
        port: channel.port2,
      },
      [channel.port2],
    );

    Atomics.wait(signal, 0, 0);

    const received = receiveMessageOnPort(channel.port1);
    channel.port1.close();

    if (!received?.message) {
      throw new Error('No response received from PostgreSQL worker.');
    }

    const message = received.message as WorkerReply;
    if (!message.ok) {
      throw new Error(message.error.message);
    }

    return message.result as T;
  }
}
