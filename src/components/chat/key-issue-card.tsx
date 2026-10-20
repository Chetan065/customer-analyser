import * as React from "react";
import { AlertCircle, Flame, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { KeyIssue } from "@/lib/graph/chat/state";

interface KeyIssueCardProps {
  issue: KeyIssue;
}

export function KeyIssueCard({ issue }: KeyIssueCardProps) {
  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return (
          <Badge variant="destructive" className="gap-1 text-xs px-2 py-0.5">
            <Flame className="h-3 w-3" /> Critical
          </Badge>
        );
      case "high":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1 text-xs px-2 py-0.5">
            <AlertTriangle className="h-3 w-3" /> High Severity
          </Badge>
        );
      case "medium":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 gap-1 text-xs px-2 py-0.5">
            <AlertCircle className="h-3 w-3" /> Medium
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1 text-xs px-2 py-0.5">
            <Info className="h-3 w-3" /> Low
          </Badge>
        );
    }
  };

  return (
    <div className="rounded-lg border border-border/70 bg-card p-3.5 shadow-xs space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-sm text-foreground">{issue.title}</h4>
        <div className="flex items-center gap-1.5">
          {getSeverityBadge(issue.severity)}
          {issue.frequencyCount != null && (
            <Badge variant="secondary" className="text-xs">
              {issue.frequencyCount} mentions
            </Badge>
          )}
        </div>
      </div>

      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
        {issue.description}
      </p>

      {issue.affectedSegment && (
        <div className="pt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Segment affected:</span>
          <span className="bg-muted px-1.5 py-0.5 rounded text-foreground/80">
            {issue.affectedSegment}
          </span>
        </div>
      )}
    </div>
  );
}
