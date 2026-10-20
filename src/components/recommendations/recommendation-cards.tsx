"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Copy,
  Check,
  Award,
  Layers,
  Quote,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/lib/db/schema";

interface RecommendationCardsProps {
  recommendations: Array<
    Recommendation & {
      linkedThemeNames?: string[];
    }
  >;
  onSelectTheme?: (themeId: string) => void;
}

export function RecommendationCards({
  recommendations,
  onSelectTheme,
}: RecommendationCardsProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopyMarkdown = (rec: Recommendation & { linkedThemeNames?: string[] }) => {
    let md = `### Recommendation: ${rec.title}\n\n`;
    md += `**Impact**: ${rec.impact.toUpperCase()} | **Effort**: ${rec.effort}\n\n`;
    md += `**Rationale**: ${rec.rationale}\n\n`;

    if (rec.linkedThemeNames && rec.linkedThemeNames.length > 0) {
      md += `**Linked Themes**: ${rec.linkedThemeNames.join(", ")}\n\n`;
    }

    if (Array.isArray(rec.evidenceQuotes) && rec.evidenceQuotes.length > 0) {
      md += `**Verbatim Evidence Quotes**:\n`;
      for (const quote of rec.evidenceQuotes) {
        md += `> "${quote}"\n\n`;
      }
    }

    navigator.clipboard.writeText(md);
    setCopiedId(rec.id);
    toast.success("Recommendation copied as Markdown!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (recommendations.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground border rounded-xl bg-card">
        No recommendations generated yet. Run the analysis pipeline to generate data-driven initiatives.
      </div>
    );
  }

  const renderImpactBadge = (impact: string) => {
    switch (impact) {
      case "high":
        return <Badge variant="critical">High Impact</Badge>;
      case "medium":
        return <Badge variant="high">Medium Impact</Badge>;
      default:
        return <Badge variant="low">Low Impact</Badge>;
    }
  };

  const renderEffortBadge = (effort: string) => {
    switch (effort) {
      case "S":
        return <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400">Effort: Small</Badge>;
      case "M":
        return <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">Effort: Medium</Badge>;
      default:
        return <Badge variant="outline" className="border-indigo-500/40 text-indigo-700 dark:text-indigo-400">Effort: Large</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {recommendations.map((rec, index) => (
        <Card
          key={rec.id}
          className="shadow-xs hover:border-primary/40 transition-colors overflow-hidden"
        >
          <CardHeader className="p-5 pb-3 bg-muted/15 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="h-7 w-7 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                  #{index + 1}
                </span>
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    {rec.title}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {renderImpactBadge(rec.impact)}
                    {renderEffortBadge(rec.effort)}
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyMarkdown(rec)}
                className="gap-1.5 text-xs shrink-0 self-start sm:self-center"
              >
                {copiedId === rec.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Copy Markdown</span>
                  </>
                )}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4 text-xs">
            {/* Rationale */}
            <div className="space-y-1">
              <span className="font-semibold text-foreground">Strategic Rationale: </span>
              <p className="text-muted-foreground leading-relaxed inline">
                {rec.rationale}
              </p>
            </div>

            {/* Linked Themes */}
            {Array.isArray(rec.themeIds) && rec.themeIds.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-foreground shrink-0">Linked Themes:</span>
                <div className="flex flex-wrap gap-1.5">
                  {rec.themeIds.map((tid, i) => (
                    <Badge
                      key={tid}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => onSelectTheme?.(tid)}
                    >
                      {rec.linkedThemeNames?.[i] || `Theme ${i + 1}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Verbatim Evidence Quotes */}
            {Array.isArray(rec.evidenceQuotes) && rec.evidenceQuotes.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <Quote className="h-3 w-3 text-primary" />
                  <span>Verbatim Customer Evidence ({rec.evidenceQuotes.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {rec.evidenceQuotes.map((quote, qIdx) => (
                    <div
                      key={qIdx}
                      className="p-2.5 rounded-lg bg-muted/40 border border-muted text-[11px] italic text-foreground leading-relaxed"
                    >
                      "{quote}"
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
