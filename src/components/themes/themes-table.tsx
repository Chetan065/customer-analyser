"use client";

import * as React from "react";
import {
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  ChevronRight,
  ArrowUpRight,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/db/schema";
import { formatPercent, formatScore } from "@/lib/utils";

interface ThemesTableProps {
  themes: Theme[];
  totalFeedbackCount: number;
  onSelectTheme: (themeId: string) => void;
}

export function ThemesTable({
  themes,
  totalFeedbackCount,
  onSelectTheme,
}: ThemesTableProps) {
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

  if (themes.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground border rounded-xl bg-card">
        No recurring themes found. Run the analysis pipeline to cluster insights.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead className="w-12 text-center text-xs">#</TableHead>
            <TableHead className="text-xs">Theme & Summary</TableHead>
            <TableHead className="w-32 text-xs">Type</TableHead>
            <TableHead className="w-32 text-xs text-center">Mentions</TableHead>
            <TableHead className="w-28 text-xs text-center">Avg Sentiment</TableHead>
            <TableHead className="w-28 text-xs text-center">Severity</TableHead>
            <TableHead className="w-40 text-xs">Priority Score</TableHead>
            <TableHead className="w-12 text-xs"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {themes.map((theme, index) => {
            const mentionsPct =
              totalFeedbackCount > 0
                ? Math.round((theme.mentions / totalFeedbackCount) * 100)
                : 0;

            return (
              <TableRow
                key={theme.id}
                onClick={() => onSelectTheme(theme.id)}
                className="cursor-pointer hover:bg-muted/40 transition-colors group"
              >
                <TableCell className="text-xs text-center font-bold text-muted-foreground">
                  {index + 1}
                </TableCell>

                <TableCell className="text-xs py-3 max-w-md">
                  <div className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                    <span>{theme.name}</span>
                    <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                  </div>
                  <p className="text-muted-foreground text-[11px] line-clamp-1 mt-0.5">
                    {theme.summary}
                  </p>
                </TableCell>

                <TableCell className="text-xs">
                  <Badge
                    variant={theme.kind === "pain_point" ? "destructive" : "secondary"}
                    className="text-[11px] font-medium"
                  >
                    {theme.kind === "pain_point" ? "Pain Point" : "Feature Request"}
                  </Badge>
                </TableCell>

                <TableCell className="text-xs text-center font-medium">
                  <div>{theme.mentions}</div>
                  <div className="text-[10px] text-muted-foreground">{mentionsPct}% of feedback</div>
                </TableCell>

                <TableCell className="text-xs text-center font-medium">
                  <span
                    className={
                      theme.avgSentiment > 0.1
                        ? "text-emerald-600 font-semibold"
                        : theme.avgSentiment < -0.1
                        ? "text-rose-600 font-semibold"
                        : "text-amber-500 font-semibold"
                    }
                  >
                    {formatScore(theme.avgSentiment)}
                  </span>
                </TableCell>

                <TableCell className="text-xs text-center">
                  {renderSeverityBadge(theme.severityLabel)}
                </TableCell>

                <TableCell className="text-xs">
                  <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                    <span className="text-primary">{theme.priorityScore}</span>
                    <span className="text-muted-foreground text-[10px]">/ 100</span>
                  </div>
                  <Progress value={theme.priorityScore} className="h-2" />
                </TableCell>

                <TableCell className="text-xs text-right pr-4">
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
