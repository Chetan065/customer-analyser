"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Lightbulb, Sparkles, Filter } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { RecommendationCards } from "@/components/recommendations/recommendation-cards";
import { ThemeDrawer } from "@/components/themes/theme-drawer";

export default function RecommendationsPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [recommendations, setRecommendations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedThemeId, setSelectedThemeId] = React.useState<string | null>(null);
  const [themeDrawerOpen, setThemeDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/projects/${projectId}/recommendations`)
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setRecommendations(json.data.recommendations || []);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleSelectTheme = (themeId: string) => {
    setSelectedThemeId(themeId);
    setThemeDrawerOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="AI Product Recommendations"
        description="Prioritized, data-grounded initiatives citing exact customer evidence quotes."
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{recommendations.length} Strategic Recommendations Formulated</span>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-xl border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : (
          <RecommendationCards
            recommendations={recommendations}
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
