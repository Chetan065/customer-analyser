import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { env } from "../env";
import { ensureDatabaseSchema } from "./bootstrap";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  // Trigger background schema ensure on first client initialization
  ensureDatabaseSchema().catch(() => {});
  const sql = neon(env.DATABASE_URL);
  dbInstance = drizzle(sql, { schema });
  return dbInstance;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop: string | symbol) {
    const instance = getDb();
    // @ts-expect-error dynamic proxy
    return instance[prop];
  },
});
