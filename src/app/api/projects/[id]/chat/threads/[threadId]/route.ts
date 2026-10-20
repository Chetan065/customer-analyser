import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getProject, getChatThreadWithMessages, updateChatThreadTitle, deleteChatThread } from "@/lib/db/queries";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { ensureDatabaseSchema } from "@/lib/db/bootstrap";
import { z } from "zod";

const updateThreadSchema = z.object({
  title: z.string().min(1, "Title cannot be empty"),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  try {
    await ensureDatabaseSchema();
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse("Unauthorized. Please log in.", 401);
    }

    const { id: projectId, threadId } = await params;
    const project = await getProject(projectId, user.id);
    if (!project) {
      return errorResponse("Project not found", 404);
    }

    const threadData = await getChatThreadWithMessages(threadId);
    if (!threadData || threadData.thread.projectId !== projectId) {
      return errorResponse("Thread not found", 404);
    }

    return successResponse(threadData);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  try {
    await ensureDatabaseSchema();
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse("Unauthorized. Please log in.", 401);
    }

    const { id: projectId, threadId } = await params;
    const project = await getProject(projectId, user.id);
    if (!project) {
      return errorResponse("Project not found", 404);
    }

    const threadData = await getChatThreadWithMessages(threadId);
    if (!threadData || threadData.thread.projectId !== projectId) {
      return errorResponse("Thread not found", 404);
    }

    const body = await req.json();
    const { title } = updateThreadSchema.parse(body);

    const updated = await updateChatThreadTitle(threadId, title);
    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; threadId: string }> }
) {
  try {
    await ensureDatabaseSchema();
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse("Unauthorized. Please log in.", 401);
    }

    const { id: projectId, threadId } = await params;
    const project = await getProject(projectId, user.id);
    if (!project) {
      return errorResponse("Project not found", 404);
    }

    const threadData = await getChatThreadWithMessages(threadId);
    if (!threadData || threadData.thread.projectId !== projectId) {
      return errorResponse("Thread not found", 404);
    }

    const deleted = await deleteChatThread(threadId);
    return successResponse({ deleted });
  } catch (err) {
    return handleApiError(err);
  }
}
