import { NextRequest } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { createProject, insertFeedbackBatch } from "@/lib/db/queries";
import { ensureDatabaseSchema } from "@/lib/db/bootstrap";
import { parseCsvWithMapping } from "@/lib/ingest/csv";
import { successResponse, handleApiError } from "@/lib/api-response";

export async function POST(_req: NextRequest) {
  try {
    await ensureDatabaseSchema();

    // 1. Generate a completely isolated demo user unique to this visitor/browser
    const demoSuffix = Math.random().toString(36).substring(2, 8);
    const demoEmail = `demo-${demoSuffix}@pulseiq.internal`;
    const demoName = `Demo Explorer #${demoSuffix.toUpperCase()}`;
    const demoPassword = crypto.randomUUID();
    const passwordHash = hashPassword(demoPassword);

    const [user] = await db
      .insert(users)
      .values({
        email: demoEmail,
        passwordHash,
        name: demoName,
      })
      .returning();

    // 2. Establish authenticated session
    await createSession(user.id);

    // 3. Pre-create a dedicated, isolated demo project owned strictly by this user
    const project = await createProject({
      userId: user.id,
      name: "CloudFlow SaaS (Demo)",
      description: "Sample customer reviews across G2, Capterra, and App Store.",
    });

    // 4. Ingest sample reviews so the workspace is immediately ready to explore and analyze
    const sampleCsvPath = path.join(process.cwd(), "src/data/sample-reviews.csv");
    if (fs.existsSync(sampleCsvPath)) {
      const csvContent = fs.readFileSync(sampleCsvPath, "utf-8");
      const { items } = parseCsvWithMapping(csvContent, {
        textColumn: "text",
        ratingColumn: "rating",
        sourceColumn: "source",
        productVersionColumn: "product_version",
        occurredAtColumn: "occurred_at",
      });
      if (items.length > 0) {
        await insertFeedbackBatch(project.id, items);
      }
    }

    return successResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        projectId: project.id,
      },
      201
    );
  } catch (err) {
    return handleApiError(err);
  }
}
