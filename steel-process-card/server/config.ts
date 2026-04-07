import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { z } from 'zod';

const configRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(configRoot, '..');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DB_CLIENT: z.enum(['sqlite', 'postgres']).default('sqlite'),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().trim().default('*'),
  SQLITE_FILE_PATH: z.string().trim().default(path.join(projectRoot, 'server', 'data', 'process-cards.sqlite')),
  POSTGRES_URL: z.string().trim().default(''),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24 * 7),
  SEED_DEFAULT_USERS: z
    .string()
    .trim()
    .default('true')
    .transform((value) => value.toLowerCase() !== 'false'),
  SEED_DEMO_CARD: z
    .string()
    .trim()
    .default('true')
    .transform((value) => value.toLowerCase() !== 'false'),
  SERVER_LOG_ENABLED: z
    .string()
    .trim()
    .default('false')
    .transform((value) => value.toLowerCase() === 'true'),
});

const env = envSchema.parse(process.env);

const corsOrigin =
  env.CORS_ORIGIN === '*'
    ? true
    : env.CORS_ORIGIN.split(',')
        .map((item) => item.trim())
        .filter(Boolean);

export const appConfig = {
  nodeEnv: env.NODE_ENV,
  dbClient: env.DB_CLIENT,
  host: env.HOST,
  port: env.PORT,
  corsOrigin,
  corsOriginRaw: env.CORS_ORIGIN,
  sqliteFilePath: path.isAbsolute(env.SQLITE_FILE_PATH)
    ? env.SQLITE_FILE_PATH
    : path.resolve(projectRoot, env.SQLITE_FILE_PATH),
  postgresUrl: env.POSTGRES_URL,
  sessionTtlHours: env.SESSION_TTL_HOURS,
  seedDefaultUsers: env.SEED_DEFAULT_USERS,
  seedDemoCard: env.SEED_DEMO_CARD,
  serverLogEnabled: env.SERVER_LOG_ENABLED,
} as const;

export { projectRoot, configRoot };
