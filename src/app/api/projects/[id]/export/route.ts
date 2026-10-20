import { NextRequest, NextResponse } from "next/server";
import { eq, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { feedbackItems, themes, recommendations, projects } from "@/lib/db/schema";
import { getProject, getLatestRunForProject } from "@/lib/db/queries";
import { errorResponse } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const project = await getProject(projectId);
    if (!project) {
      return errorResponse("Project not found", 404);
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";

    const latestRun = await getLatestRunForProject(projectId);

    const items = await db
      .select()
      .from(feedbackItems)
      .where(eq(feedbackItems.projectId, projectId));

    let runThemes: any[] = [];
    let runRecs: any[] = [];

    if (latestRun) {
      runThemes = await db
        .select()
        .from(themes)
        .where(eq(themes.runId, latestRun.id))
        .orderBy(desc(themes.priorityScore));

      runRecs = await db
        .select()
        .from(recommendations)
        .where(eq(recommendations.runId, latestRun.id))
        .orderBy(asc(recommendations.rank));
    }

    // Format 1: JSON
    if (format === "json") {
      const payload = {
        project,
        exportedAt: new Date().toISOString(),
        latestRun,
        summary: {
          totalFeedbackItems: items.length,
          analyzedItems: items.filter((i) => i.analysisStatus === "done").length,
          themesCount: runThemes.length,
          recommendationsCount: runRecs.length,
        },
        themes: runThemes,
        recommendations: runRecs,
        feedbackItems: items,
      };

      return new NextResponse(JSON.stringify(payload, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${project.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-analysis.json"`,
        },
      });
    }

    // Format 2: CSV (Feedback items with analyzed labels)
    if (format === "csv") {
      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const headers = [
        "id",
        "text",
        "rating",
        "source",
        "product_version",
        "occurred_at",
        "sentiment",
        "sentiment_score",
        "confidence",
        "emotion",
        "is_churn_risk",
        "summary",
      ];

      const csvRows = [headers.join(",")];
      for (const item of items) {
        csvRows.push(
          [
            escapeCsv(item.id),
            escapeCsv(item.text),
            escapeCsv(item.rating),
            escapeCsv(item.source),
            escapeCsv(item.productVersion),
            escapeCsv(item.occurredAt ? new Date(item.occurredAt).toISOString() : ""),
            escapeCsv(item.sentiment),
            escapeCsv(item.sentimentScore),
            escapeCsv(item.confidence),
            escapeCsv(item.emotion),
            escapeCsv(item.isChurnRisk ? "true" : "false"),
            escapeCsv(item.summary),
          ].join(",")
        );
      }

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${project.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-feedback.csv"`,
        },
      });
    }

    // Format 3: Markdown Report
    if (format === "md" || format === "markdown") {
      const analyzedCount = items.filter((i) => i.analysisStatus === "done").length;
      const posCount = items.filter((i) => i.sentiment === "positive").length;
      const negCount = items.filter((i) => i.sentiment === "negative").length;
      const neuCount = items.filter((i) => i.sentiment === "neutral").length;

      let md = `# Feedback Analysis Report: ${project.name}\n\n`;
      md += `*Generated on ${new Date().toLocaleDateString()} via Feedback Analyzer*\n\n`;

      md += `## 1. Executive Summary\n\n`;
      md += `- **Total Feedback Items**: ${items.length}\n`;
      md += `- **Analyzed Items**: ${analyzedCount}\n`;
      md += `- **Sentiment Breakdown**: ${posCount} Positive (${Math.round((posCount / Math.max(1, analyzedCount)) * 100)}%), ${neuCount} Neutral, ${negCount} Negative (${Math.round((negCount / Math.max(1, analyzedCount)) * 100)}%)\n`;
      if (latestRun?.summaryStats?.averageSentiment !== undefined) {
        md += `- **Average Sentiment Score**: ${latestRun.summaryStats.averageSentiment} (-1.00 to +1.00)\n`;
      }
      md += `\n---\n\n`;

      md += `## 2. Top Prioritized Themes\n\n`;
      if (runThemes.length === 0) {
        md += `*No themes analyzed yet.*\n\n`;
      } else {
        md += `| Theme | Type | Priority | Severity | Mentions | Avg Sentiment |\n`;
        md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        for (const t of runThemes.slice(0, 15)) {
          md += `| **${t.name}** | ${t.kind === "pain_point" ? "Pain Point" : "Feature Request"} | ${t.priorityScore}/100 | ${t.severityLabel} | ${t.mentions} | ${t.avgSentiment > 0 ? "+" : ""}${Number(t.avgSentiment).toFixed(2)} |\n`;
        }
        md += `\n`;
      }

      md += `## 3. Data-Driven AI Product Recommendations\n\n`;
      if (runRecs.length === 0) {
        md += `*No recommendations generated yet.*\n\n`;
      } else {
        for (const r of runRecs) {
          md += `### ${r.rank}. ${r.title}\n\n`;
          md += `> **Impact**: ${r.impact.toUpperCase()} | **Effort**: ${r.effort}\n\n`;
          md += `**Rationale**: ${r.rationale}\n\n`;
          if (Array.isArray(r.evidenceQuotes) && r.evidenceQuotes.length > 0) {
            md += `**Evidence Quotes**:\n`;
            for (const q of r.evidenceQuotes) {
              md += `- *"${q}"*\n`;
            }
            md += `\n`;
          }
        }
      }

      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${project.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-report.md"`,
        },
      });
    }

    return errorResponse("Invalid format requested. Supported formats: json, csv, md", 400);
  } catch (err: any) {
    return errorResponse(err.message || "Failed to generate export", 500);
  }
}
