import { NextRequest } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { recommendations, themes } from "@/lib/db/schema";
import { getLatestRunForProject, getProject } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export async function GET(
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

    const latestRun = await getLatestRunForProject(projectId);
    if (!latestRun) {
      return successResponse({ recommendations: [], latestRun: null });
    }

    const recs = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.runId, latestRun.id))
      .orderBy(asc(recommendations.rank));

    // Also fetch theme metadata to display theme names on recommendation cards
    const allThemes = await db
      .select({ id: themes.id, name: themes.kind, title: themes.name })
      .from(themes)
      .where(eq(themes.runId, latestRun.id));

    const themeLookup = new Map(allThemes.map((t) => [t.id, t.title]));

    const enriched = recs.map((r) => ({
      ...r,
      linkedThemeNames: (r.themeIds || []).map((tid) => themeLookup.get(tid) || "Linked Theme"),
    }));

    return successResponse({
      recommendations: enriched,
      latestRun,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
