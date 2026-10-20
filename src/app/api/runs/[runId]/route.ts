import { NextRequest } from "next/server";
import { getAnalysisRun } from "@/lib/db/queries";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const run = await getAnalysisRun(runId);
    if (!run) {
      return errorResponse("Analysis run not found", 404);
    }
    return successResponse(run);
  } catch (err) {
    return handleApiError(err);
  }
}
