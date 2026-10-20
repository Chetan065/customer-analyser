import { StateGraph, START, END } from "@langchain/langgraph";
import { ChatGraphAnnotation, type ChatGraphState } from "./state";
import {
  nodeUnderstandQuery,
  nodePlanRetrieval,
  nodeRetrieve,
  nodeAnalyzeSubset,
  nodeSynthesize,
  nodeVerifyGrounding,
} from "./nodes";

/**
 * Builds the LangGraph workflow for conversational insights query execution.
 */
export function buildChatGraph() {
  const workflow = new StateGraph(ChatGraphAnnotation)
    .addNode("understandQuery", nodeUnderstandQuery)
    .addNode("planRetrieval", nodePlanRetrieval)
    .addNode("retrieve", nodeRetrieve)
    .addNode("analyzeSubset", nodeAnalyzeSubset)
    .addNode("synthesize", nodeSynthesize)
    .addNode("verifyGrounding", nodeVerifyGrounding)
    .addEdge(START, "understandQuery")
    .addEdge("understandQuery", "planRetrieval")
    .addEdge("planRetrieval", "retrieve")
    .addEdge("retrieve", "analyzeSubset")
    .addEdge("analyzeSubset", "synthesize")
    .addEdge("synthesize", "verifyGrounding")
    .addEdge("verifyGrounding", END);

  return workflow.compile();
}

/**
 * Executes the chat graph and invokes onProgress callback if streaming SSE is desired.
 */
export async function runChatGraph(
  initialState: {
    projectId: string;
    threadId?: string;
    userMessage: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    manualFilters?: {
      customerSegment?: string | null;
      isRepeatCustomer?: boolean | null;
      sentiment?: "positive" | "neutral" | "negative" | null;
    };
  },
  onProgress?: (event: { type: "stage" | "chunk"; stage?: string; count?: number; text?: string }) => void
): Promise<ChatGraphState> {
  const graph = buildChatGraph();

  // Execute step by step or invoke
  if (!onProgress) {
    const result = await graph.invoke({
      projectId: initialState.projectId,
      threadId: initialState.threadId || "",
      userMessage: initialState.userMessage,
      history: initialState.history || [],
      manualFilters: initialState.manualFilters || {},
    });
    return result as ChatGraphState;
  }

  // If onProgress is provided, stream states
  onProgress({ type: "stage", stage: "understanding" });

  let currentState: Partial<ChatGraphState> = {
    projectId: initialState.projectId,
    threadId: initialState.threadId || "",
    userMessage: initialState.userMessage,
    history: initialState.history || [],
    manualFilters: initialState.manualFilters || {},
  };

  const stream = await graph.stream(currentState, { streamMode: "updates" });

  for await (const chunk of stream) {
    const nodeName = Object.keys(chunk)[0];
    const update = (chunk as Record<string, any>)[nodeName];

    currentState = { ...currentState, ...update };

    if (nodeName === "understandQuery") {
      onProgress({ type: "stage", stage: "planning" });
    } else if (nodeName === "planRetrieval") {
      onProgress({ type: "stage", stage: "retrieving" });
    } else if (nodeName === "retrieve") {
      const count = update?.retrievedItems?.length ?? 0;
      onProgress({ type: "stage", stage: "retrieving", count });
    } else if (nodeName === "analyzeSubset") {
      onProgress({ type: "stage", stage: "analyzing" });
    } else if (nodeName === "synthesize") {
      onProgress({ type: "stage", stage: "verifying" });
    }
  }

  return currentState as ChatGraphState;
}
