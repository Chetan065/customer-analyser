import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { successResponse, handleApiError } from "@/lib/api-response";

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    return successResponse({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
