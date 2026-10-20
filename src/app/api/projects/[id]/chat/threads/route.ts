import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getProject, listChatThreads, createChatThread } from "@/lib/db/queries";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { ensureDatabaseSchema } from "@/lib/db/bootstrap";
import { z } from "zod";

const createThreadSchema = z.object({
  title: z.string().optional().default("New Conversation"),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseSchema();
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse("Unauthorized. Please log in.", 401);
    }

    const { id: projectId } = await params;
    const project = await getProject(projectId, user.id);
    if (!project) {
      return errorResponse("Project not found", 404);
    }

    const threads = await listChatThreads(projectId);
    return successResponse(threads);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseSchema();
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse("Unauthorized. Please log in.", 401);
    }

    const { id: projectId } = await params;
    const project = await getProject(projectId, user.id);
    if (!project) {
      return errorResponse("Project not found", 404);
    }

    let title = "New Conversation";
    try {
      const body = await req.json();
      const parsed = createThreadSchema.parse(body);
      title = parsed.title;
    } catch {
      // Use default title
    }

    const thread = await createChatThread(projectId, title);
    return successResponse(thread);
  } catch (err) {
    return handleApiError(err);
  }
}
