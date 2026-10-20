import { NextRequest } from "next/server";
import { ensureDatabaseSchema } from "@/lib/db/bootstrap";
import { neon } from "@neondatabase/serverless";
import { env } from "@/lib/env";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const force = req.nextUrl?.searchParams?.get("force") === "true";
    const initialized = await ensureDatabaseSchema(force);
    if (!initialized) {
      return errorResponse("Failed to initialize database schema. Check your DATABASE_URL in environment variables.", 500);
    }

    // Query tables in public schema
    const sql = neon(env.DATABASE_URL);
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;

    return successResponse({
      message: "Database tables and pgvector extension successfully verified.",
      tables: tables.map((t: any) => t.table_name),
    });
  } catch (err: any) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
