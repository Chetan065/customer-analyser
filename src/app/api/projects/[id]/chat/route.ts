import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getProject, createChatThread, createChatMessage, getChatThreadWithMessages, updateChatThreadTitle } from "@/lib/db/queries";
import { runChatGraph } from "@/lib/graph/chat/graph";
import { errorResponse, handleApiError } from "@/lib/api-response";
import { ensureDatabaseSchema } from "@/lib/db/bootstrap";
import { z } from "zod";

const chatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  threadId: z.string().uuid().optional(),
  filters: z
    .object({
      customerSegment: z.string().nullable().optional(),
      isRepeatCustomer: z.boolean().nullable().optional(),
      sentiment: z.enum(["positive", "neutral", "negative"]).nullable().optional(),
    })
    .optional(),
});

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

    const body = await req.json();
    const parsed = chatRequestSchema.parse(body);

    // Find or create thread
    let threadId = parsed.threadId;
    let isFirstMessage = false;

    if (threadId) {
      const threadData = await getChatThreadWithMessages(threadId);
      if (!threadData || threadData.thread.projectId !== projectId) {
        threadId = undefined;
      } else {
        isFirstMessage = threadData.messages.length === 0;
      }
    }

    if (!threadId) {
      const newThread = await createChatThread(projectId, parsed.message.slice(0, 50));
      threadId = newThread.id;
      isFirstMessage = true;
    }

    // Load recent history
    const existing = await getChatThreadWithMessages(threadId);
    const history = (existing?.messages || []).slice(-6).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Record user message
    await createChatMessage({
      threadId,
      role: "user",
      content: parsed.message,
      filters: parsed.filters,
    });

    const isSSE = req.headers.get("accept")?.includes("text/event-stream");

    if (isSSE) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const sendEvent = (data: any) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            sendEvent({ type: "stage", stage: "understanding" });

            const finalState = await runChatGraph(
              {
                projectId,
                threadId,
                userMessage: parsed.message,
                history,
                manualFilters: parsed.filters,
              },
              (evt) => {
                sendEvent(evt);
              }
            );

            // Save assistant message to database
            const assistantMsg = await createChatMessage({
              threadId: threadId!,
              role: "assistant",
              content: finalState.finalPayload.headline || "Feedback analysis summary",
              structuredPayload: finalState.finalPayload,
              filters: parsed.filters,
            });

            // Update thread title if first message
            if (isFirstMessage && parsed.message) {
              const cleanTitle = parsed.message
                .replace(/^(what|how|why|which|can you|tell me|show me)\s+(is|are|the|about)\s+/i, "")
                .slice(0, 45);
              await updateChatThreadTitle(threadId!, cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1));
            }

            sendEvent({
              type: "done",
              threadId,
              messageId: assistantMsg.id,
              payload: finalState.finalPayload,
            });

            controller.close();
          } catch (err: any) {
            console.error("Error in SSE chat stream:", err);
            sendEvent({ type: "error", error: err.message || "Pipeline error" });
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    // Non-streaming JSON fallback
    const finalState = await runChatGraph({
      projectId,
      threadId,
      userMessage: parsed.message,
      history,
      manualFilters: parsed.filters,
    });

    // Save assistant message to database
    const assistantMsg = await createChatMessage({
      threadId,
      role: "assistant",
      content: finalState.finalPayload.headline || "Feedback analysis summary",
      structuredPayload: finalState.finalPayload,
      filters: parsed.filters,
    });

    if (isFirstMessage && parsed.message) {
      const cleanTitle = parsed.message
        .replace(/^(what|how|why|which|can you|tell me|show me)\s+(is|are|the|about)\s+/i, "")
        .slice(0, 45);
      await updateChatThreadTitle(threadId, cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1));
    }

    return NextResponse.json({
      success: true,
      data: {
        threadId,
        messageId: assistantMsg.id,
        userMessage: parsed.message,
        payload: finalState.finalPayload,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
