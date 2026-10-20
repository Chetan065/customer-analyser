import { NextRequest } from "next/server";
import { getFilteredFeedback, getProject } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
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

    const { searchParams } = new URL(req.url);
    const sentiment = (searchParams.get("sentiment") || "all") as any;
    const ratingRaw = searchParams.get("rating");
    const rating = ratingRaw && ratingRaw !== "all" ? parseInt(ratingRaw, 10) : "all";
    const source = searchParams.get("source") || "all";
    const q = searchParams.get("q") || undefined;
    const themeId = searchParams.get("themeId") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const data = await getFilteredFeedback({
      projectId,
      sentiment,
      rating,
      source,
      q,
      themeId,
      page,
      limit,
    });

    return successResponse(data);
  } catch (err) {
    return handleApiError(err);
  }
}
