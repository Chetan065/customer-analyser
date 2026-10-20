"use client";

import * as React from "react";
import {
  Sparkles,
  Download,
  Calendar,
  Clock,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  FileText,
  FileCode,
  Smile,
  Frown,
  Meh,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { formatPercent, formatScore } from "@/lib/utils";

interface SummaryHeaderProps {
  projectId: string;
  projectName: string;
  stats: {
    totalItems: number;
    analyzedCount: number;
    overallSentimentScore: number;
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
    positivePct: number;
    neutralPct: number;
    negativePct: number;
    churnRiskCount: number;
    minDate: string | null;
    maxDate: string | null;
  };
  lastAnalyzedAt?: string | null;
  onRunAnalysis: () => void;
  isRunning?: boolean;
}

export function SummaryHeader({
  projectId,
  projectName,
  stats,
  lastAnalyzedAt,
  onRunAnalysis,
  isRunning,
}: SummaryHeaderProps) {
  const formatDateRange = () => {
    if (!stats.minDate || !stats.maxDate) return "All time";
    const start = new Date(stats.minDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const end = new Date(stats.maxDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${start} - ${end}`;
  };

  const getSentimentTone = (score: number) => {
    if (score > 0.2) return { label: "Positive", color: "text-emerald-600 dark:text-emerald-400" };
    if (score < -0.2) return { label: "Negative", color: "text-rose-600 dark:text-rose-400" };
    return { label: "Neutral / Mixed", color: "text-amber-600 dark:text-amber-400" };
  };

  const tone = getSentimentTone(stats.overallSentimentScore);

  return (
    <div className="space-y-4">
      {/* Top Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 border-b min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">{projectName}</h1>
            <Badge variant="outline" className="text-xs shrink-0">
              Project Insights
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground mt-1">
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>{formatDateRange()}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="truncate">
                {lastAnalyzedAt
                  ? `Analyzed ${new Date(lastAnalyzedAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}`
                  : "Not yet analyzed"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Info Popover: How Scoring Works */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 sm:h-9">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden xs:inline">How Scores Work</span>
                <span className="xs:hidden">Scores</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-xs space-y-2.5 p-4" align="end">
              <div className="font-semibold text-sm">Deterministic Priority Formula</div>
              <p className="text-muted-foreground leading-relaxed">
                Themes are ranked mathematically in code using a weighted blend of 5 objective signals:
              </p>
              <div className="bg-muted p-2 rounded-md font-mono text-[11px] leading-relaxed">
                priorityScore = 100 × (0.40×normFreq + 0.30×severity + 0.15×negativity + 0.10×churn + 0.05×recency)
              </div>
              <ul className="space-y-1 text-muted-foreground list-disc pl-4">
                <li><strong>Frequency (40%)</strong>: Share of feedback mentioning this theme.</li>
                <li><strong>Severity (30%)</strong>: Average pain severity (1-5) or sentiment proxy.</li>
                <li><strong>Negativity (15%)</strong>: Sentiment negative deflection (-1 to +1).</li>
                <li><strong>Churn Risk (10%)</strong>: Ratio of users threatening to cancel.</li>
                <li><strong>Recency (5%)</strong>: Velocity in the recent 30% of the date range.</li>
              </ul>
            </PopoverContent>
          </Popover>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 sm:h-9">
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              <DropdownMenuItem asChild>
                <a href={`/api/projects/${projectId}/export?format=md`} download className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Executive Markdown Report (.md)</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/projects/${projectId}/export?format=csv`} download className="flex items-center gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Labeled Feedback CSV (.csv)</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/projects/${projectId}/export?format=json`} download className="flex items-center gap-2 cursor-pointer">
                  <FileCode className="h-4 w-4 text-amber-600" />
                  <span>Full Intelligence JSON (.json)</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Run / Re-run Button */}
          <Button
            size="sm"
            onClick={onRunAnalysis}
            disabled={isRunning || stats.totalItems === 0}
            className="gap-2 shadow-xs font-semibold text-xs h-8 sm:h-9"
          >
            <Sparkles className="h-4 w-4" />
            <span>{lastAnalyzedAt ? "Re-run" : "Analyze"}</span>
          </Button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Feedback */}
        <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-xs min-w-0">
          <div className="text-xs font-medium text-muted-foreground truncate">Total Ingested Feedback</div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-1 truncate">
            {stats.totalItems.toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 truncate">
            {stats.analyzedCount} analyzed ({Math.round((stats.analyzedCount / Math.max(1, stats.totalItems)) * 100)}%)
          </div>
        </div>

        {/* Overall Sentiment */}
        <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-xs min-w-0">
          <div className="text-xs font-medium text-muted-foreground truncate">Overall Sentiment Score</div>
          <div className={`text-xl sm:text-2xl font-bold tracking-tight mt-1 truncate ${tone.color}`}>
            {formatScore(stats.overallSentimentScore)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 truncate">
            Tone: <span className="font-medium text-foreground">{tone.label}</span>
          </div>
        </div>

        {/* Sentiment Ratios */}
        <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-xs min-w-0">
          <div className="text-xs font-medium text-muted-foreground truncate">Sentiment Breakdown</div>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-1 truncate">
            <span className="text-emerald-600 font-bold text-base sm:text-lg">{stats.positivePct}%</span>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="text-amber-500 font-bold text-base sm:text-lg">{stats.neutralPct}%</span>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="text-rose-600 font-bold text-base sm:text-lg">{stats.negativePct}%</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5 truncate">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Pos
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0 ml-1" /> Neu
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500 shrink-0 ml-1" /> Neg
          </div>
        </div>

        {/* Churn Risk */}
        <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-xs min-w-0">
          <div className="text-xs font-medium text-muted-foreground truncate">Churn Risk Alerts</div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-red-600 dark:text-red-400 mt-1 truncate">
            {stats.churnRiskCount}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 truncate">
            {stats.analyzedCount > 0
              ? `${Math.round((stats.churnRiskCount / stats.analyzedCount) * 100)}% of users`
              : "No flags"}
          </div>
        </div>
      </div>
    </div>
  );
}
