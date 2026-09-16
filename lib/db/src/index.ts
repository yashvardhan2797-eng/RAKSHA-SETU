import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

/**
 * True when a database is configured. The api-server runs an in-memory
 * fallback when this is false, so local demos and CI need no Postgres.
 */
export const usingDatabase = (): boolean => Boolean(process.env.DATABASE_URL);

let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function init(): ReturnType<typeof drizzle> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  if (!_db || !_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
    _db = drizzle(_pool, { schema });
  }
  return _db;
}

function lazy<T extends object>(factory: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const real = factory() as unknown as Record<string | symbol, unknown>;
      const value = real[prop];
      return typeof value === "function" ? (value as () => unknown).bind(real) : value;
    },
  });
}

/** Lazy Drizzle client — connects on first use, not on import. */
export const db = lazy(() => init());
/** Lazy pg pool — same lifecycle as db. */
export const pool = lazy(() => _pool!);

export * from "./schema";
