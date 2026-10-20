import { NextRequest } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { successResponse, handleApiError } from "@/lib/api-response";

export async function POST(_req: NextRequest) {
  try {
    await destroySession();
    return successResponse({ loggedOut: true });
  } catch (err) {
    return handleApiError(err);
  }
}
