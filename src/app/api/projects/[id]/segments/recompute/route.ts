import { NextRequest } from "next/server";
import { getProject } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { recomputeProjectSegments } from "@/lib/ingest/segments";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse("Unauthorized. Please log in.", 401);
    }

    const { id: projectId } = await params;
    const project = await getProject(projectId, user.id);
    if (!project) {
      return errorResponse("Project not found", 404);
    }

    const result = await recomputeProjectSegments(projectId);
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}
