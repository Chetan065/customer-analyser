import * as React from "react";
import { Send, Square, Sparkles, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string, filters: {
    customerSegment?: string | null;
    isRepeatCustomer?: boolean | null;
    sentiment?: "positive" | "neutral" | "negative" | null;
  }) => void;
  isLoading: boolean;
  onStop?: () => void;
  className?: string;
}

export function ChatInput({ onSendMessage, isLoading, onStop, className }: ChatInputProps) {
  const [message, setMessage] = React.useState("");
  const [repeatFilter, setRepeatFilter] = React.useState<"all" | "repeat" | "new">("all");
  const [sentimentFilter, setSentimentFilter] = React.useState<"all" | "negative" | "positive">("all");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!message.trim() || isLoading) return;

    const filters = {
      isRepeatCustomer: repeatFilter === "repeat" ? true : repeatFilter === "new" ? false : null,
      sentiment: sentimentFilter === "all" ? null : sentimentFilter,
    };

    onSendMessage(message.trim(), filters);
    setMessage("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Auto-adjust height
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  return (
    <div className={cn("p-3 sm:p-4 bg-background/95 backdrop-blur-sm border-t border-border", className)}>
      <div className="max-w-4xl mx-auto space-y-2.5">
        {/* Filter chips bar */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground flex items-center gap-1 font-medium mr-1">
            <Filter className="h-3 w-3" /> Filters:
          </span>

          {/* Repeat customer toggle */}
          <button
            type="button"
            onClick={() => setRepeatFilter(repeatFilter === "repeat" ? "all" : "repeat")}
            className={cn(
              "px-2.5 py-1 rounded-full border text-xs font-medium transition-all",
              repeatFilter === "repeat"
                ? "bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300"
                : "border-border/70 hover:bg-muted text-muted-foreground"
            )}
          >
            Repeat Customers
          </button>

          <button
            type="button"
            onClick={() => setRepeatFilter(repeatFilter === "new" ? "all" : "new")}
            className={cn(
              "px-2.5 py-1 rounded-full border text-xs font-medium transition-all",
              repeatFilter === "new"
                ? "bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300"
                : "border-border/70 hover:bg-muted text-muted-foreground"
            )}
          >
            New Customers
          </button>

          {/* Sentiment toggle */}
          <button
            type="button"
            onClick={() => setSentimentFilter(sentimentFilter === "negative" ? "all" : "negative")}
            className={cn(
              "px-2.5 py-1 rounded-full border text-xs font-medium transition-all",
              sentimentFilter === "negative"
                ? "bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-300"
                : "border-border/70 hover:bg-muted text-muted-foreground"
            )}
          >
            Negative Sentiment
          </button>

          <button
            type="button"
            onClick={() => setSentimentFilter(sentimentFilter === "positive" ? "all" : "positive")}
            className={cn(
              "px-2.5 py-1 rounded-full border text-xs font-medium transition-all",
              sentimentFilter === "positive"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "border-border/70 hover:bg-muted text-muted-foreground"
            )}
          >
            Positive Sentiment
          </button>

          {(repeatFilter !== "all" || sentimentFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setRepeatFilter("all");
                setSentimentFilter("all");
              }}
              className="text-muted-foreground hover:text-foreground text-xs underline ml-1"
            >
              Reset
            </button>
          )}
        </div>

        {/* Input area */}
        <div className="relative rounded-xl border border-input bg-card shadow-xs focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your feedback (e.g., 'What are the top complaints among repeat customers?')..."
            className="w-full resize-none bg-transparent px-4 py-3 pr-24 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-40"
          />

          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            {isLoading ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="h-8 gap-1.5 px-3 text-xs"
                onClick={onStop}
              >
                <Square className="h-3 w-3 fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs font-medium"
                disabled={!message.trim()}
                onClick={handleSubmit}
              >
                <span>Ask</span>
                <Send className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
          <span>PulseIQ analyzes feedback items & themes using LangGraph</span>
          <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
        </div>
      </div>
    </div>
  );
}
