import { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { themes } from "@/lib/db/schema";
import { getLatestRunForProject, getProject } from "@/lib/db/queries";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = await getProject(projectId);
    if (!project) {
      return errorResponse("Project not found", 404);
    }

    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind"); // 'pain_point' | 'feature_request' | null

    const latestRun = await getLatestRunForProject(projectId);
    if (!latestRun) {
      return successResponse({ themes: [], latestRun: null });
    }

    const conditions = [eq(themes.runId, latestRun.id)];
    if (kind && (kind === "pain_point" || kind === "feature_request")) {
      conditions.push(eq(themes.kind, kind));
    }

    const result = await db
      .select()
      .from(themes)
      .where(eq(themes.runId, latestRun.id))
      .orderBy(desc(themes.priorityScore));

    const filtered = kind ? result.filter((t) => t.kind === kind) : result;

    return successResponse({
      themes: filtered,
      latestRun,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
