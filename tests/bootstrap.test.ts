import { describe, it, expect } from "vitest";
import { ensureDatabaseSchema } from "@/lib/db/bootstrap";
import { neon } from "@neondatabase/serverless";
import { env } from "@/lib/env";

describe("Database Bootstrap & Schema Verification", () => {
  it("successfully bootstraps all tables in Neon Postgres", async () => {
    if (!env.DATABASE_URL || env.DATABASE_URL.includes("localhost:5432/mock")) {
      console.log("Skipping bootstrap test in mock environment");
      return;
    }

    const initialized = await ensureDatabaseSchema(true);
    expect(initialized).toBe(true);

    const sql = neon(env.DATABASE_URL);
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;

    const tableNames = tables.map((t: any) => t.table_name);
    console.log("Verified Neon Postgres tables:", tableNames);

    expect(tableNames).toContain("users");
    expect(tableNames).toContain("sessions");
    expect(tableNames).toContain("projects");
    expect(tableNames).toContain("feedback_items");
    expect(tableNames).toContain("analysis_runs");
    expect(tableNames).toContain("themes");
    expect(tableNames).toContain("insights");
    expect(tableNames).toContain("recommendations");
  }, 30000);
});
