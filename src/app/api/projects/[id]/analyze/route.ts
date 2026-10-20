import { NextRequest } from "next/server";
import { getProject, createAnalysisRun } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { feedbackItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

    // Count items in project
    const items = await db
      .select({ id: feedbackItems.id })
      .from(feedbackItems)
      .where(eq(feedbackItems.projectId, projectId));

    if (items.length === 0) {
      return errorResponse("No feedback items found in this project. Please import feedback first.", 400);
    }

    // Reset items to pending if re-analyzing
    await db
      .update(feedbackItems)
      .set({ analysisStatus: "pending" })
      .where(eq(feedbackItems.projectId, projectId));

    const run = await createAnalysisRun(projectId, items.length);

    return successResponse(
      {
        runId: run.id,
        status: run.status,
        stage: run.stage,
        progress: run.progress,
        totalItems: items.length,
      },
      201
    );
  } catch (err) {
    return handleApiError(err);
  }
}
