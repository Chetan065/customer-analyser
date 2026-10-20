import { NextRequest } from "next/server";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { getProject, insertFeedbackBatch } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureDatabaseSchema } from "@/lib/db/bootstrap";
import { parseCsvWithMapping, parsePastedText, autoDetectColumnMapping, MAX_UPLOAD_ITEMS } from "@/lib/ingest/csv";
import type { NormalizedItem } from "@/lib/ingest/normalize";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

const importSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("csv"),
    csvContent: z.string().min(1, "CSV content cannot be empty"),
    mapping: z.object({
      textColumn: z.string().min(1, "Text column selection is required"),
      ratingColumn: z.string().optional(),
      sourceColumn: z.string().optional(),
      productVersionColumn: z.string().optional(),
      occurredAtColumn: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal("paste"),
    rawText: z.string().min(1, "Pasted text cannot be empty"),
  }),
  z.object({
    type: z.literal("sample"),
  }),
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseSchema();
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse("Unauthorized. Please log in.", 401);
    }

    const { id: projectId } = await params;
    const project = await getProject(projectId, user.id);
    if (!project) {
      return errorResponse("Project not found", 404);
    }

    const json = await req.json();
    const payload = importSchema.parse(json);

    let itemsToInsert: NormalizedItem[] = [];

    if (payload.type === "csv") {
      const { items } = parseCsvWithMapping(payload.csvContent, payload.mapping);
      itemsToInsert = items;
    } else if (payload.type === "paste") {
      itemsToInsert = parsePastedText(payload.rawText);
    } else if (payload.type === "sample") {
      const filePath = path.join(process.cwd(), "src", "data", "sample-reviews.csv");
      const sampleCsv = fs.readFileSync(filePath, "utf8");
      const mapping = {
        textColumn: "text",
        ratingColumn: "rating",
        sourceColumn: "source",
        productVersionColumn: "product_version",
        occurredAtColumn: "occurred_at",
      };
      const { items } = parseCsvWithMapping(sampleCsv, mapping);
      itemsToInsert = items;
    }

    if (itemsToInsert.length === 0) {
      return errorResponse("No valid feedback items found to import.", 400);
    }

    if (itemsToInsert.length > MAX_UPLOAD_ITEMS) {
      itemsToInsert = itemsToInsert.slice(0, MAX_UPLOAD_ITEMS);
    }

    const result = await insertFeedbackBatch(
      projectId,
      itemsToInsert.map((item) => ({
        text: item.text,
        textHash: item.textHash,
        rating: item.rating ?? null,
        source: item.source ?? null,
        productVersion: item.productVersion ?? null,
        occurredAt: item.occurredAt ?? null,
        analysisStatus: "pending",
      }))
    );

    return successResponse({
      ...result,
      message: `Successfully processed ${result.totalProvided} items (${result.insertedCount} imported, ${result.duplicateCount} duplicates skipped).`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
