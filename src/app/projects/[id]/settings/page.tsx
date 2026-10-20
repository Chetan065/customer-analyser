"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Settings,
  DollarSign,
  Coins,
  Cpu,
  Trash2,
  Database,
  Layers,
  Sparkles,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();

  const [project, setProject] = React.useState<any>(null);
  const [latestRun, setLatestRun] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/projects/${projectId}/overview`)
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setProject(json.data.project);
          setLatestRun(json.data.latestRun);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to permanently delete this project? This will delete all feedback, embeddings, and themes.")) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Project deleted successfully");
        router.push("/");
      } else {
        throw new Error("Failed to delete project");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete project");
      setDeleting(false);
    }
  };

  const estimatedCost = latestRun?.summaryStats?.estimatedCostUsd ?? 0;
  const processedItems = latestRun?.summaryStats?.totalProcessed ?? 0;

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Project Settings & AI Economics"
        description="Configuration, LLM token and cost telemetry, and database infrastructure."
      />

      <main className="flex-1 p-8 space-y-6 max-w-4xl">
        {/* Cost & Token Telemetry Card */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">AI Cost & Token Telemetry</CardTitle>
                <CardDescription className="text-xs">
                  Estimated model usage costs based on Google Gemini (gemini-2.5-flash and text-embedding-004) pricing.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border bg-muted/20">
                <div className="text-xs text-muted-foreground font-medium">Estimated Run Cost</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  ${estimatedCost.toFixed(4)}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Approx ~$0.0003 / item (Gemini Flash)
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-muted/20">
                <div className="text-xs text-muted-foreground font-medium">Processed Feedback Items</div>
                <div className="text-2xl font-bold text-foreground mt-1">
                  {processedItems}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Extracted & embedded
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-muted/20">
                <div className="text-xs text-muted-foreground font-medium">Embedding Vectors</div>
                <div className="text-2xl font-bold text-foreground mt-1">
                  768 dim
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Neon pgvector (text-embedding-004)
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed pt-2">
              Telemetry is computed deterministically after each pipeline stage. Batched structured outputs
              (15-20 items per LLM call) keep token overhead low and minimize inference latency.
            </p>
          </CardContent>
        </Card>

        {/* Database & Infrastructure Card */}
        <Card className="shadow-xs">
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">Storage & Vector Extension</CardTitle>
                <CardDescription className="text-xs">
                  Serverless database connection details and pgvector extension status.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-3 text-xs">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Database Engine</span>
              <span className="font-semibold text-foreground">Neon Serverless Postgres (HTTP Pooler)</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Vector Extension</span>
              <Badge variant="positive" className="text-xs">pgvector (1536 dim) Active</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">ORM & Migrations</span>
              <span className="font-semibold text-foreground">Drizzle ORM + drizzle-kit</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Pipeline Runtime</span>
              <span className="font-semibold text-foreground">LangGraph JS (Serverless chunked runner)</span>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="shadow-xs border-destructive/30">
          <CardHeader className="pb-3 border-b bg-destructive/5">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              <CardTitle className="text-base font-bold text-destructive">Danger Zone</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Permanently delete this project, all feedback items, cluster themes, and AI recommendations.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Once deleted, all project data is unrecoverable.
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>{deleting ? "Deleting..." : "Delete Project"}</span>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
