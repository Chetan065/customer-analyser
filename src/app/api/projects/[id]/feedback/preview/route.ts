import { NextRequest } from "next/server";
import { z } from "zod";
import { previewCsv } from "@/lib/ingest/csv";
import { successResponse, handleApiError } from "@/lib/api-response";

const previewSchema = z.object({
  csvContent: z.string().min(1, "CSV content cannot be empty"),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { csvContent } = previewSchema.parse(json);
    const preview = previewCsv(csvContent);
    return successResponse(preview);
  } catch (err) {
    return handleApiError(err);
  }
}
