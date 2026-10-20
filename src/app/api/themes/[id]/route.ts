import { NextRequest } from "next/server";
import { getThemeDetail } from "@/lib/db/queries";
import { db } from "@/lib/db/client";
import { recommendations } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: themeId } = await params;
    const detail = await getThemeDetail(themeId);
    if (!detail) {
      return errorResponse("Theme not found", 404);
    }

    // Find if there is a linked recommendation that references this theme
    const allRecs = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.runId, detail.theme.runId));

    const linkedRecommendation = allRecs.find(
      (r) => Array.isArray(r.themeIds) && r.themeIds.includes(themeId)
    );

    return successResponse({
      ...detail,
      linkedRecommendation: linkedRecommendation || null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
