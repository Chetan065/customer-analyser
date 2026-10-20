"use client";

import * as React from "react";
import { AlertCircle, Lightbulb, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Theme } from "@/lib/db/schema";

interface PainVsFeaturesProps {
  themes: Theme[];
  onSelectTheme: (themeId: string) => void;
}

export function PainVsFeatures({ themes, onSelectTheme }: PainVsFeaturesProps) {
  const painPoints = themes
    .filter((t) => t.kind === "pain_point")
    .slice(0, 10);

  const featureRequests = themes
    .filter((t) => t.kind === "feature_request")
    .slice(0, 10);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 1. Pain Points */}
      <Card className="shadow-xs border-rose-500/20">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertCircle className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-bold">Top Pain Points & Friction</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {painPoints.length} ranked
            </Badge>
          </div>
          <CardDescription className="text-xs mt-1">
            Ranked bugs and workflow obstacles with highest churn risk and severity.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {painPoints.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No pain points identified yet.
            </div>
          ) : (
            <div className="divide-y text-xs">
              {painPoints.map((theme, i) => (
                <div
                  key={theme.id}
                  onClick={() => onSelectTheme(theme.id)}
                  className="p-3.5 hover:bg-muted/40 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="font-bold text-muted-foreground w-4 mt-0.5 text-center">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {theme.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {theme.summary}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                      {theme.priorityScore} pts
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Feature Requests */}
      <Card className="shadow-xs border-indigo-500/20">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Lightbulb className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-bold">Top Feature Requests</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {featureRequests.length} ranked
            </Badge>
          </div>
          <CardDescription className="text-xs mt-1">
            Highest-demand capabilities and customer enhancement suggestions.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {featureRequests.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No feature requests identified yet.
            </div>
          ) : (
            <div className="divide-y text-xs">
              {featureRequests.map((theme, i) => (
                <div
                  key={theme.id}
                  onClick={() => onSelectTheme(theme.id)}
                  className="p-3.5 hover:bg-muted/40 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="font-bold text-muted-foreground w-4 mt-0.5 text-center">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {theme.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {theme.summary}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900">
                      {theme.priorityScore} pts
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
