import { NextRequest } from "next/server";
import { executeNextStep } from "@/lib/graph/pipeline-steps";
import { successResponse, handleApiError } from "@/lib/api-response";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const stepResult = await executeNextStep(runId);
    return successResponse(stepResult);
  } catch (err) {
    return handleApiError(err);
  }
}
