import { NextRequest } from "next/server";
import { getProject, deleteProject } from "@/lib/db/queries";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) {
      return errorResponse("Project not found", 404);
    }
    return successResponse(project);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteProject(id);
    if (!deleted) {
      return errorResponse("Project not found or already deleted", 404);
    }
    return successResponse({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
