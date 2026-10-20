"use client";

import * as React from "react";
import {
  X,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  Smile,
  Frown,
  Meh,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Theme } from "@/lib/db/schema";
import { formatPercent, formatScore } from "@/lib/utils";

interface ThemeDrawerProps {
  themeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFeedbackItem?: (feedbackId: string) => void;
}

export function ThemeDrawer({
  themeId,
  open,
  onOpenChange,
  onSelectFeedbackItem,
}: ThemeDrawerProps) {
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<{
    theme: Theme;
    items: Array<{
      insightId: string;
      text: string;
      kind: string;
      severity: number | null;
      feedbackId: string;
      feedbackText: string;
      rating: number | null;
      sentiment: string | null;
      sentimentScore: number | null;
      occurredAt: string | null;
      source: string | null;
    }>;
    linkedRecommendation: any | null;
  } | null>(null);

  React.useEffect(() => {
    if (!open || !themeId) {
      setData(null);
      return;
    }

    setLoading(true);
    fetch(`/api/themes/${themeId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setData(json.data);
        }
      })
      .catch((err) => console.error("Failed to load theme detail", err))
      .finally(() => setLoading(false));
  }, [open, themeId]);

  if (!open || !themeId) return null;

  const theme = data?.theme;

  const renderSeverityBadge = (label: string) => {
    switch (label) {
      case "Critical":
        return <Badge variant="critical">Critical</Badge>;
      case "High":
        return <Badge variant="high">High</Badge>;
      case "Medium":
        return <Badge variant="medium">Medium</Badge>;
      default:
        return <Badge variant="low">Low</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        {loading || !theme ? (
          <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
            Loading theme intelligence and quotes...
          </div>
        ) : (
          <div className="space-y-6">
            <DialogHeader className="border-b pb-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={theme.kind === "pain_point" ? "destructive" : "secondary"}>
                    {theme.kind === "pain_point" ? "Pain Point" : "Feature Request"}
                  </Badge>
                  {renderSeverityBadge(theme.severityLabel)}
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">Priority Score: </span>
                  <span className="text-sm font-bold text-primary">{theme.priorityScore}/100</span>
                </div>
              </div>

              <DialogTitle className="text-xl font-bold tracking-tight text-foreground pt-2">
                {theme.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
                {theme.summary}
              </DialogDescription>
            </DialogHeader>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/30 border rounded-lg p-3 text-center">
                <div className="text-[11px] text-muted-foreground font-medium">Total Mentions</div>
                <div className="text-lg font-bold text-foreground mt-0.5">{theme.mentions}</div>
              </div>
              <div className="bg-muted/30 border rounded-lg p-3 text-center">
                <div className="text-[11px] text-muted-foreground font-medium">Avg Sentiment</div>
                <div
                  className={`text-lg font-bold mt-0.5 ${
                    theme.avgSentiment > 0.1
                      ? "text-emerald-600"
                      : theme.avgSentiment < -0.1
                      ? "text-rose-600"
                      : "text-amber-500"
                  }`}
                >
                  {formatScore(theme.avgSentiment)}
                </div>
              </div>
              <div className="bg-muted/30 border rounded-lg p-3 text-center">
                <div className="text-[11px] text-muted-foreground font-medium">Severity Score</div>
                <div className="text-lg font-bold text-foreground mt-0.5">
                  {Math.round(theme.severityScore * 100)}%
                </div>
              </div>
            </div>

            {/* Linked Strategic AI Recommendation (if available) */}
            {data?.linkedRecommendation && (
              <div className="border border-primary/30 bg-primary/5 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Sparkles className="h-4 w-4" />
                  <span>Linked Product Recommendation</span>
                </div>
                <h4 className="text-sm font-bold text-foreground">
                  {data.linkedRecommendation.title}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {data.linkedRecommendation.rationale}
                </p>
                <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                  <span>Impact: <strong className="text-foreground uppercase">{data.linkedRecommendation.impact}</strong></span>
                  <span>•</span>
                  <span>Effort: <strong className="text-foreground">{data.linkedRecommendation.effort}</strong></span>
                </div>
              </div>
            )}

            {/* Representative Quotes & Traceability */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Representative Feedback & Evidence ({data?.items.length || 0})
                </h4>
                <span className="text-[11px] text-muted-foreground">Click quote to view source</span>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {data?.items.map((item) => (
                  <div
                    key={item.insightId}
                    onClick={() => {
                      onOpenChange(false);
                      onSelectFeedbackItem?.(item.feedbackId);
                    }}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors cursor-pointer text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <span>{item.source || "Customer"}</span>
                        {item.rating && (
                          <span className="text-amber-500">({item.rating}★)</span>
                        )}
                      </div>
                      <span>
                        {item.occurredAt
                          ? new Date(item.occurredAt).toLocaleDateString()
                          : ""}
                      </span>
                    </div>

                    <p className="text-foreground italic leading-relaxed">
                      "{item.feedbackText}"
                    </p>

                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-primary font-medium flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        <span>Source item: {item.feedbackId.slice(0, 8)}...</span>
                      </span>
                      {item.sentiment && (
                        <span
                          className={`capitalize font-semibold ${
                            item.sentiment === "positive"
                              ? "text-emerald-600"
                              : item.sentiment === "negative"
                              ? "text-rose-600"
                              : "text-amber-500"
                          }`}
                        >
                          {item.sentiment}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
