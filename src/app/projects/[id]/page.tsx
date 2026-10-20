"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  UploadCloud,
  Layers,
  ArrowRight,
  Lightbulb,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  ListOrdered,
  BotMessageSquare,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SummaryHeader } from "@/components/dashboard/summary-header";
import { SentimentOverview } from "@/components/charts/sentiment-overview";
import { AspectSentimentChart } from "@/components/charts/aspect-sentiment-chart";
import { ThemesTable } from "@/components/themes/themes-table";
import { PainVsFeatures } from "@/components/dashboard/pain-vs-features";
import { RecommendationCards } from "@/components/recommendations/recommendation-cards";
import { ThemeDrawer } from "@/components/themes/theme-drawer";
import { AnalysisRunnerDialog } from "@/components/analysis/analysis-runner-dialog";
import { ImportModal } from "@/components/feedback/import-modal";
import { FeedbackTable } from "@/components/feedback/feedback-table";

export default function ProjectDashboardPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<any>(null);

  // Modals & drawers
  const [analysisDialogOpen, setAnalysisDialogOpen] = React.useState(false);
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [selectedThemeId, setSelectedThemeId] = React.useState<string | null>(null);
  const [themeDrawerOpen, setThemeDrawerOpen] = React.useState(false);

  const fetchOverview = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/overview`);
      const json = await res.json();
      if (res.ok && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to load dashboard overview", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleStartAnalysis = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/analyze`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to start analysis");
      }

      setActiveRunId(json.data.runId);
      setAnalysisDialogOpen(true);
    } catch (err: any) {
      alert(err.message || "Failed to initiate analysis");
    }
  };

  const handleThemeClick = (themeId: string) => {
    setSelectedThemeId(themeId);
    setThemeDrawerOpen(true);
  };

  if (loading) {
    return (
      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full animate-pulse">
        <div className="h-20 bg-muted/40 rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted/40 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-muted/40 rounded-xl" />
      </div>
    );
  }

  const project = data?.project;
  const stats = data?.stats;
  const themes = data?.themes || [];
  const recommendations = data?.recommendations || [];
  const hasFeedback = (stats?.totalItems || 0) > 0;
  const hasAnalysis = (stats?.analyzedCount || 0) > 0;
  const isLowSampleSize = hasFeedback && stats.totalItems < 10;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title={project?.name}
        description="Comprehensive sentiment intelligence, ranked problem clusters, and product roadmap recommendations."
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">
        {/* State 1: Completely Empty Project Onboarding */}
        {!hasFeedback ? (
          <div className="border-2 border-dashed rounded-2xl p-12 text-center space-y-6 max-w-2xl mx-auto my-12 bg-card">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <UploadCloud className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Welcome to your new feedback workspace!
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Follow 3 simple steps to transform customer feedback into actionable product roadmap decisions:
              </p>
            </div>

            {/* 3-Step Onboarding Guide */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="p-4 rounded-xl border bg-muted/20 space-y-1.5">
                <div className="h-6 w-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <div className="font-semibold text-xs text-foreground">Add Feedback</div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Upload a CSV or load the pre-built 157-item CloudFlow SaaS reviews.
                </p>
              </div>

              <div className="p-4 rounded-xl border bg-muted/20 space-y-1.5">
                <div className="h-6 w-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <div className="font-semibold text-xs text-foreground">Run Analysis</div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  AI extracts sentiments, clusters pain points, and vectors embeddings.
                </p>
              </div>

              <div className="p-4 rounded-xl border bg-muted/20 space-y-1.5">
                <div className="h-6 w-6 rounded-full bg-primary/20 text-primary font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <div className="font-semibold text-xs text-foreground">Explore Insights</div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Review ranked themes and copy verified strategic recommendations.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button onClick={() => setImportModalOpen(true)} size="lg" className="gap-2 font-semibold">
                <UploadCloud className="h-4 w-4" />
                <span>Import Feedback to Get Started</span>
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Low sample size warning banner */}
            {isLowSampleSize && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-3.5 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Low Sample Size Notice:</strong> This project has only {stats.totalItems} feedback items.
                  Aggregate sentiment scores and cluster percentages may have wide error margins until more data is added.
                </span>
              </div>
            )}

            {/* 1. Summary Header */}
            <SummaryHeader
              projectId={projectId}
              projectName={project?.name || "Project"}
              stats={stats}
              lastAnalyzedAt={data?.latestRun?.finishedAt}
              onRunAnalysis={handleStartAnalysis}
            />

            {/* State 2: Has feedback but not yet analyzed */}
            {!hasAnalysis ? (
              <div className="rounded-xl border bg-primary/5 p-8 text-center space-y-4">
                <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mx-auto shadow-sm">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-foreground">
                    {stats.totalItems} Feedback Items Ready for Analysis
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Click the button below to launch the LangGraph intelligence pipeline. It will classify
                    sentiment, embed pain points, cluster themes, and formulate prioritized recommendations.
                  </p>
                </div>
                <Button onClick={handleStartAnalysis} size="lg" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>Start AI Analysis Pipeline</span>
                </Button>
              </div>
            ) : (
              <>
                {/* 2. Sentiment Overview Charts */}
                <SentimentOverview
                  distribution={data?.sentimentDistribution || []}
                  sentimentOverTime={data?.sentimentOverTime || []}
                />

                {/* 3. Priority Matrix / Ranked Theme List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold tracking-tight text-foreground">
                        Priority Matrix: Ranked Customer Themes
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Themes grouped by semantic clustering and scored using frequency, severity, churn risk, and recency.
                      </p>
                    </div>
                    <Link
                      href={`/projects/${projectId}/themes`}
                      className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                    >
                      <span>View all themes</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  <ThemesTable
                    themes={themes.slice(0, 8)}
                    totalFeedbackCount={stats.totalItems}
                    onSelectTheme={handleThemeClick}
                  />
                </div>

                {/* 4. Pain Points vs Feature Requests */}
                <PainVsFeatures
                  themes={themes}
                  onSelectTheme={handleThemeClick}
                />

                {/* 5. Aspect Sentiment Breakdown */}
                <AspectSentimentChart aspects={data?.aspectSentiment || []} />

                {/* 6. AI Recommendations */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold tracking-tight text-foreground">
                        Data-Driven Product Recommendations
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Strategic action initiatives grounded in high-frequency customer themes with verbatim evidence quotes.
                      </p>
                    </div>
                    <Link
                      href={`/projects/${projectId}/recommendations`}
                      className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                    >
                      <span>All recommendations</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  <RecommendationCards
                    recommendations={recommendations.slice(0, 4)}
                    onSelectTheme={handleThemeClick}
                  />
                </div>

                {/* 7. Feedback Explorer Preview */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold tracking-tight text-foreground">
                        Raw Feedback Explorer
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Search and filter through the complete feedback repository.
                      </p>
                    </div>
                    <Link
                      href={`/projects/${projectId}/feedback`}
                      className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                    >
                      <span>Open full explorer</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>

                  <FeedbackTable projectId={projectId} />
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Analysis Stepper Runner Dialog */}
      <AnalysisRunnerDialog
        projectId={projectId}
        runId={activeRunId}
        open={analysisDialogOpen}
        onOpenChange={setAnalysisDialogOpen}
        onCompleted={fetchOverview}
      />

      {/* Import Modal */}
      <ImportModal
        projectId={projectId}
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImportSuccess={fetchOverview}
      />

      {/* Theme Detail Drawer */}
      <ThemeDrawer
        themeId={selectedThemeId}
        open={themeDrawerOpen}
        onOpenChange={setThemeDrawerOpen}
      />

      {/* Floating Ask PulseIQ Button */}
      <div className="fixed bottom-6 right-6 z-30">
        <Link
          href={`/projects/${projectId}/chat`}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all"
        >
          <BotMessageSquare className="h-4 w-4" />
          <span>Ask PulseIQ</span>
        </Link>
      </div>
    </div>
  );
}
