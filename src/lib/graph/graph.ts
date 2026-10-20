import { StateGraph, START, END } from "@langchain/langgraph";
import { AnalysisGraphAnnotation, type AnalysisGraphState } from "./state";
import {
  stepClassifyBatch,
  stepEmbedInsights,
  stepClusterAndLabel,
  stepGenerateRecommendations,
} from "./pipeline-steps";
import { db } from "@/lib/db/client";
import { analysisRuns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Builds the LangGraph workflow graph for feedback analysis orchestration.
 */
export function buildFeedbackAnalysisGraph() {
  const workflow = new StateGraph(AnalysisGraphAnnotation)
    // 1. Normalize input
    .addNode("normalizeInput", async (state: AnalysisGraphState) => {
      return {
        stage: "normalize",
        progress: 5,
      };
    })
    // 2. Extract structured insights (batched)
    .addNode("extractInsights", async (state: AnalysisGraphState) => {
      const [run] = await db
        .select()
        .from(analysisRuns)
        .where(eq(analysisRuns.id, state.runId));

      if (run) {
        await stepClassifyBatch(run);
      }
      return {
        stage: "classify",
        progress: 50,
      };
    })
    // 3. Embed items
    .addNode("embedItems", async (state: AnalysisGraphState) => {
      const [run] = await db
        .select()
        .from(analysisRuns)
        .where(eq(analysisRuns.id, state.runId));

      if (run) {
        await stepEmbedInsights(run);
      }
      return {
        stage: "embed",
        progress: 70,
      };
    })
    // 4. Cluster & Label Themes + Score Priority
    .addNode("clusterAndLabel", async (state: AnalysisGraphState) => {
      const [run] = await db
        .select()
        .from(analysisRuns)
        .where(eq(analysisRuns.id, state.runId));

      if (run) {
        await stepClusterAndLabel(run);
      }
      return {
        stage: "cluster",
        progress: 85,
      };
    })
    // 5. Generate Recommendations
    .addNode("generateRecommendations", async (state: AnalysisGraphState) => {
      const [run] = await db
        .select()
        .from(analysisRuns)
        .where(eq(analysisRuns.id, state.runId));

      if (run) {
        await stepGenerateRecommendations(run);
      }
      return {
        stage: "done",
        progress: 100,
      };
    });

  // Construct edges: START -> normalizeInput -> extractInsights -> embedItems -> clusterAndLabel -> generateRecommendations -> END
  workflow.addEdge(START, "normalizeInput");
  workflow.addEdge("normalizeInput", "extractInsights");
  workflow.addEdge("extractInsights", "embedItems");
  workflow.addEdge("embedItems", "clusterAndLabel");
  workflow.addEdge("clusterAndLabel", "generateRecommendations");
  workflow.addEdge("generateRecommendations", END);

  return workflow.compile();
}

export const feedbackAnalysisGraph = buildFeedbackAnalysisGraph();
