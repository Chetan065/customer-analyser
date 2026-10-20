"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Network, Filter, ArrowUpDown } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemesTable } from "@/components/themes/themes-table";
import { ThemeDrawer } from "@/components/themes/theme-drawer";
import type { Theme } from "@/lib/db/schema";

export default function ThemesPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [themes, setThemes] = React.useState<Theme[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [kindFilter, setKindFilter] = React.useState<"all" | "pain_point" | "feature_request">("all");
  const [selectedThemeId, setSelectedThemeId] = React.useState<string | null>(null);
  const [themeDrawerOpen, setThemeDrawerOpen] = React.useState(false);
  const [totalFeedback, setTotalFeedback] = React.useState(0);

  const fetchThemes = React.useCallback(async () => {
    setLoading(true);
    try {
      const url = kindFilter === "all" ? `/api/projects/${projectId}/themes` : `/api/projects/${projectId}/themes?kind=${kindFilter}`;
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.data) {
        setThemes(json.data.themes);
        setTotalFeedback(json.data.latestRun?.totalItems || json.data.themes.length);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [projectId, kindFilter]);

  React.useEffect(() => {
    fetchThemes();
  }, [fetchThemes]);

  const handleSelectTheme = (id: string) => {
    setSelectedThemeId(id);
    setThemeDrawerOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Recurring Themes & Clusters"
        description="Semantically clustered customer feedback groups ranked by priority score and business impact."
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={kindFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setKindFilter("all")}
              className="text-xs"
            >
              All Types
            </Button>
            <Button
              variant={kindFilter === "pain_point" ? "default" : "outline"}
              size="sm"
              onClick={() => setKindFilter("pain_point")}
              className="text-xs"
            >
              Pain Points Only
            </Button>
            <Button
              variant={kindFilter === "feature_request" ? "default" : "outline"}
              size="sm"
              onClick={() => setKindFilter("feature_request")}
              className="text-xs"
            >
              Feature Requests Only
            </Button>
          </div>

          <span className="text-xs text-muted-foreground">
            {themes.length} recurring theme(s) found
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="h-64 rounded-xl border bg-muted/30 animate-pulse" />
        ) : (
          <ThemesTable
            themes={themes}
            totalFeedbackCount={totalFeedback}
            onSelectTheme={handleSelectTheme}
          />
        )}
      </main>

      <ThemeDrawer
        themeId={selectedThemeId}
        open={themeDrawerOpen}
        onOpenChange={setThemeDrawerOpen}
      />
    </div>
  );
}
