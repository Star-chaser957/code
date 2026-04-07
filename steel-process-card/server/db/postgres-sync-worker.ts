import { parentPort, workerData } from 'node:worker_threads';
import type { MessagePort } from 'node:worker_threads';
import { Client } from 'pg';

type WorkerRequest =
  | {
      type: 'init';
      signal: SharedArrayBuffer;
      port: MessagePort;
    }
  | {
      type: 'query' | 'run' | 'exec';
      sql: string;
      params?: Array<string | number | null>;
      signal: SharedArrayBuffer;
      port: MessagePort;
    };

type WorkerResponse =
  | { ok: true; result: unknown }
  | {
      ok: false;
      error: {
        message: string;
        code?: string;
        detail?: string;
      };
    };

const client = new Client({
  connectionString: workerData.connectionString as string,
});

let initialized = false;

function replacePlaceholders(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function normalizeSql(input: string) {
  return replacePlaceholders(input)
    .replace(/GROUP_CONCAT\(ur\.role_code\) AS workflow_roles/g, "STRING_AGG(ur.role_code, ',') AS workflow_roles")
    .replace(
      /GROUP_CONCAT\(DISTINCT co\.operation_code\) AS enabled_operation_codes/g,
      "STRING_AGG(DISTINCT co.operation_code, ',') AS enabled_operation_codes",
    )
    .replace(
      /GROUP_CONCAT\(DISTINCT CASE WHEN co\.operation_code = 'heat-treatment' THEN od\.detail_type END\) AS heat_treatment_types/g,
      "STRING_AGG(DISTINCT CASE WHEN co.operation_code = 'heat-treatment' THEN od.detail_type END, ',') AS heat_treatment_types",
    )
    .replace(/\bGROUP BY c\.id\b/g, 'GROUP BY c.id, handler.display_name');
}

function respond(request: WorkerRequest, payload: WorkerResponse) {
  const signal = new Int32Array(request.signal);
  request.port.postMessage(payload);
  request.port.close();
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0);
}

async function ensureConnected() {
  if (initialized) {
    return;
  }

  await client.connect();
  initialized = true;
}

if (!parentPort) {
  throw new Error('PostgreSQL worker requires a parent port.');
}

parentPort.on('message', async (request: WorkerRequest) => {
  try {
    await ensureConnected();

    if (request.type === 'init') {
      respond(request, { ok: true, result: null });
      return;
    }

    const result = await client.query(normalizeSql(request.sql), request.params ?? []);
    respond(request, {
      ok: true,
      result: request.type === 'query' ? result.rows : null,
    });
  } catch (error) {
    const reason = error as { message?: string; code?: string; detail?: string };
    respond(request, {
      ok: false,
      error: {
        message: reason.message ?? 'PostgreSQL request failed.',
        code: reason.code,
        detail: reason.detail,
      },
    });
  }
});
