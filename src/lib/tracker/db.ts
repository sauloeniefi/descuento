import { Pool, types } from "pg";

types.setTypeParser(types.builtins.NUMERIC, (v) => parseFloat(v));
types.setTypeParser(types.builtins.INT8, (v) => parseInt(v, 10));

const globalForDb = globalThis as unknown as { trackerPool?: Pool };

export function getDb(): Pool {
  globalForDb.trackerPool ??= new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://descuento:descuento@localhost:5432/descuento",
  });
  return globalForDb.trackerPool;
}
