import * as React from "react";
import { Quote, CheckCircle2, Star, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SupportingComment } from "@/lib/graph/chat/state";

interface GroundedQuoteCardProps {
  comment: SupportingComment;
}

export function GroundedQuoteCard({ comment }: GroundedQuoteCardProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(comment.quote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg border border-border/80 bg-card/60 p-3.5 shadow-xs hover:border-primary/40 hover:bg-card transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {comment.grounded && (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs px-2 py-0.5 gap-1"
            >
              <CheckCircle2 className="h-3 w-3" />
              Verified Quote
            </Badge>
          )}

          {comment.isRepeatCustomer ? (
            <Badge variant="secondary" className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20 text-xs px-2 py-0.5">
              Repeat Customer
            </Badge>
          ) : comment.customerSegment ? (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {comment.customerSegment}
            </Badge>
          ) : null}

          {comment.source && (
            <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">
              {comment.source}
            </span>
          )}

          {comment.rating != null && (
            <div className="flex items-center text-xs font-medium text-amber-500">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500 mr-0.5" />
              {comment.rating}/5
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
          title="Copy quote"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>

      <div className="flex items-start gap-2">
        <Quote className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-foreground/90 italic leading-relaxed">
          &ldquo;{comment.quote}&rdquo;
        </p>
      </div>
    </div>
  );
}
