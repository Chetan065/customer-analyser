import * as React from "react";
import {
  Bot,
  User,
  Copy,
  Check,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GroundedQuoteCard } from "./grounded-quote-card";
import { KeyIssueCard } from "./key-issue-card";
import type { ChatStructuredPayload } from "@/lib/graph/chat/state";
import { cn } from "@/lib/utils";

interface ChatMessageItemProps {
  role: "user" | "assistant" | "system";
  content: string;
  structuredPayload?: {
    headline?: string;
    keyIssues?: Array<{
      title: string;
      description: string;
      severity: "critical" | "high" | "medium" | "low";
      frequencyCount?: number;
      affectedSegment?: string;
      quoteIds?: string[];
    }>;
    supportingComments?: Array<{
      quote: string;
      feedbackId?: string;
      rating?: number;
      customerSegment?: string;
      source?: string;
      isRepeatCustomer?: boolean;
      grounded?: boolean;
    }>;
    recommendedActions?: Array<{
      title: string;
      rationale: string;
      urgency: "immediate" | "near-term" | "backlog";
      expectedImpact: string;
    }>;
    caveats?: string[];
    followUpQuestions?: string[];
    metrics?: {
      totalAnalyzed: number;
      positiveCount: number;
      neutralCount: number;
      negativeCount: number;
      averageRating?: number | null;
      topSegment?: string;
    };
  } | null;
  filters?: {
    customerSegment?: string | null;
    isRepeatCustomer?: boolean | null;
    sentiment?: "positive" | "neutral" | "negative" | null;
  } | null;
  createdAt?: string | Date;
  onSelectFollowUp?: (question: string) => void;
}

export function ChatMessageItem({
  role,
  content,
  structuredPayload,
  filters,
  createdAt,
  onSelectFollowUp,
}: ChatMessageItemProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyMarkdown = () => {
    if (!structuredPayload) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }

    const p = structuredPayload;
    let md = `### ${p.headline}\n\n`;

    if (p.metrics) {
      md += `**Data Analyzed**: ${p.metrics.totalAnalyzed} items | Positive: ${p.metrics.positiveCount} | Neutral: ${p.metrics.neutralCount} | Negative: ${p.metrics.negativeCount}\n\n`;
    }

    if (p.keyIssues?.length) {
      md += `#### Key Issues\n`;
      p.keyIssues.forEach((issue) => {
        md += `- **${issue.title}** (${issue.severity?.toUpperCase()} severity, ${issue.affectedSegment || "All"}): ${issue.description}\n`;
      });
      md += `\n`;
    }

    if (p.supportingComments?.length) {
      md += `#### Supporting Customer Evidence\n`;
      p.supportingComments.forEach((c) => {
        md += `> "${c.quote}" — *${c.customerSegment || (c.isRepeatCustomer ? "Repeat Customer" : "Customer")}${c.source ? `, ${c.source}` : ""}*\n\n`;
      });
    }

    if (p.recommendedActions?.length) {
      md += `#### Recommended Actions\n`;
      p.recommendedActions.forEach((a) => {
        md += `- **${a.title}** [${a.urgency}]: ${a.rationale} (Impact: ${a.expectedImpact})\n`;
      });
      md += `\n`;
    }

    if (p.caveats?.length) {
      md += `*Caveats:*\n`;
      p.caveats.forEach((cav) => {
        md += `- ${cav}\n`;
      });
    }

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (role === "user") {
    return (
      <div className="flex justify-end gap-3 mb-6">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl bg-primary text-primary-foreground px-4 py-3 shadow-xs">
          <p className="text-sm sm:text-base font-normal whitespace-pre-wrap leading-relaxed">{content}</p>

          {filters && (filters.isRepeatCustomer !== undefined || filters.customerSegment || filters.sentiment) && (
            <div className="mt-2 pt-2 border-t border-primary-foreground/20 flex flex-wrap gap-1.5 text-xs opacity-90">
              {filters.isRepeatCustomer === true && (
                <span className="bg-primary-foreground/20 px-2 py-0.5 rounded-full font-medium">
                  Repeat Customers
                </span>
              )}
              {filters.isRepeatCustomer === false && (
                <span className="bg-primary-foreground/20 px-2 py-0.5 rounded-full font-medium">
                  New Customers
                </span>
              )}
              {filters.customerSegment && (
                <span className="bg-primary-foreground/20 px-2 py-0.5 rounded-full font-medium">
                  Segment: {filters.customerSegment}
                </span>
              )}
              {filters.sentiment && (
                <span className="bg-primary-foreground/20 px-2 py-0.5 rounded-full font-medium capitalize">
                  {filters.sentiment} Sentiment
                </span>
              )}
            </div>
          )}
        </div>
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Assistant response
  return (
    <div className="flex items-start gap-3 mb-8 w-full">
      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-4">
        {/* Top bar with copy action */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            PulseIQ Intelligence
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
            onClick={handleCopyMarkdown}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Markdown"}
          </Button>
        </div>

        {/* Headline card */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
          <h3 className="font-semibold text-base sm:text-lg text-foreground leading-snug">
            {structuredPayload?.headline || content}
          </h3>

          {/* Metrics summary bar */}
          {structuredPayload?.metrics && structuredPayload.metrics.totalAnalyzed > 0 && (
            <div className="mt-3 pt-3 border-t border-primary/10 flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                {structuredPayload.metrics.totalAnalyzed} items analyzed
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <TrendingUp className="h-3 w-3" />
                {structuredPayload.metrics.positiveCount} positive
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                <TrendingDown className="h-3 w-3" />
                {structuredPayload.metrics.negativeCount} negative
              </span>
              {structuredPayload.metrics.averageRating != null && (
                <>
                  <span>•</span>
                  <span>Avg Rating: <strong>{structuredPayload.metrics.averageRating}★</strong></span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Key Issues */}
        {structuredPayload?.keyIssues && structuredPayload.keyIssues.length > 0 && (
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Key Root Causes & Issues
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {structuredPayload.keyIssues.map((issue, idx) => (
                <KeyIssueCard key={idx} issue={issue} />
              ))}
            </div>
          </div>
        )}

        {/* Supporting Verified Quotes */}
        {structuredPayload?.supportingComments && structuredPayload.supportingComments.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Grounded Customer Evidence Quotes
              </h4>
              <span className="text-xs text-muted-foreground">
                {structuredPayload.supportingComments.length} verified quotes
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {structuredPayload.supportingComments.map((comment, idx) => (
                <GroundedQuoteCard key={idx} comment={{ ...comment, grounded: comment.grounded ?? true }} />
              ))}
            </div>
          </div>
        )}

        {/* Recommended Actions */}
        {structuredPayload?.recommendedActions && structuredPayload.recommendedActions.length > 0 && (
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              Prioritized Product Recommendations
            </h4>
            <div className="space-y-2">
              {structuredPayload.recommendedActions.map((action, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border/80 bg-card/70 p-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{action.title}</span>
                      <Badge
                        variant={action.urgency === "immediate" ? "destructive" : "secondary"}
                        className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0"
                      >
                        {action.urgency}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{action.rationale}</p>
                  </div>
                  {action.expectedImpact && (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md shrink-0 self-start sm:self-center">
                      Impact: {action.expectedImpact}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Caveats */}
        {structuredPayload?.caveats && structuredPayload.caveats.length > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />
              Analysis Notes & Constraints
            </div>
            <ul className="list-disc list-inside space-y-0.5 opacity-90 pl-1">
              {structuredPayload.caveats.map((cav, idx) => (
                <li key={idx}>{cav}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Follow up question suggestions */}
        {structuredPayload?.followUpQuestions && structuredPayload.followUpQuestions.length > 0 && onSelectFollowUp && (
          <div className="pt-2 space-y-2">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <HelpCircle className="h-3 w-3" />
              Suggested Follow-up Questions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {structuredPayload.followUpQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectFollowUp(q)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border/70 bg-card hover:bg-muted/80 hover:border-primary/40 text-foreground transition-all text-left"
                >
                  <span>{q}</span>
                  <ArrowRight className="h-2.5 w-2.5 opacity-60" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
