"use client";

import * as React from "react";
import {
  Search,
  Filter,
  Star,
  Calendar,
  AlertTriangle,
  Lightbulb,
  Smile,
  Frown,
  Meh,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { FeedbackItem } from "@/lib/db/schema";
import { formatScore } from "@/lib/utils";

interface FeedbackTableProps {
  projectId: string;
  themeIdFilter?: string;
  onRefreshTrigger?: number;
}

export function FeedbackTable({ projectId, themeIdFilter, onRefreshTrigger }: FeedbackTableProps) {
  const [items, setItems] = React.useState<FeedbackItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);

  // Filters
  const [q, setQ] = React.useState("");
  const [sentiment, setSentiment] = React.useState<string>("all");
  const [rating, setRating] = React.useState<string>("all");
  const [source, setSource] = React.useState<string>("all");

  // Selected item modal
  const [selectedItem, setSelectedItem] = React.useState<FeedbackItem | null>(null);

  const fetchFeedback = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
      });

      if (q.trim()) params.set("q", q.trim());
      if (sentiment !== "all") params.set("sentiment", sentiment);
      if (rating !== "all") params.set("rating", rating);
      if (source !== "all") params.set("source", source);
      if (themeIdFilter) params.set("themeId", themeIdFilter);

      const res = await fetch(`/api/projects/${projectId}/feedback?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setItems(json.data.items);
        setTotalPages(json.data.pagination.totalPages || 1);
        setTotalCount(json.data.pagination.total || 0);
      }
    } catch (err) {
      console.error("Failed to load feedback items", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, page, q, sentiment, rating, source, themeIdFilter]);

  React.useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback, onRefreshTrigger]);

  const renderSentimentBadge = (item: FeedbackItem) => {
    if (!item.sentiment) {
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground font-normal">
          Pending
        </Badge>
      );
    }

    if (item.sentiment === "positive") {
      return (
        <Badge variant="positive" className="text-[11px] gap-1">
          <Smile className="h-3 w-3" />
          <span>Positive ({formatScore(item.sentimentScore)})</span>
        </Badge>
      );
    }
    if (item.sentiment === "negative") {
      return (
        <Badge variant="negative" className="text-[11px] gap-1">
          <Frown className="h-3 w-3" />
          <span>Negative ({formatScore(item.sentimentScore)})</span>
        </Badge>
      );
    }
    return (
      <Badge variant="neutral" className="text-[11px] gap-1">
        <Meh className="h-3 w-3" />
        <span>Neutral ({formatScore(item.sentimentScore)})</span>
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search keywords in feedback..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sentiment Filter */}
          <select
            value={sentiment}
            onChange={(e) => {
              setSentiment(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-3 text-xs shadow-xs"
          >
            <option value="all">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>

          {/* Rating Filter */}
          <select
            value={rating}
            onChange={(e) => {
              setRating(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-3 text-xs shadow-xs"
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>

          {/* Source Filter */}
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border bg-background px-3 text-xs shadow-xs"
          >
            <option value="all">All Sources</option>
            <option value="G2">G2</option>
            <option value="Capterra">Capterra</option>
            <option value="App Store">App Store</option>
            <option value="Google Play">Google Play</option>
            <option value="Zendesk">Zendesk</option>
            <option value="Support Ticket">Support Ticket</option>
            <option value="In-App NPS">In-App NPS</option>
          </select>

          {(q || sentiment !== "all" || rating !== "all" || source !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setSentiment("all");
                setRating("all");
                setSource("all");
                setPage(1);
              }}
              className="text-xs h-9"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-28 text-xs">Date / Source</TableHead>
              <TableHead className="text-xs">Feedback Content</TableHead>
              <TableHead className="w-28 text-xs text-center">Rating</TableHead>
              <TableHead className="w-36 text-xs">Sentiment</TableHead>
              <TableHead className="w-24 text-xs text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5} className="py-4 text-center">
                    <div className="h-4 bg-muted animate-pulse rounded w-3/4 mx-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground text-sm">
                  No feedback items found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setSelectedItem(item)}
                >
                  <TableCell className="text-xs py-3 align-top">
                    <div className="font-medium text-foreground">
                      {item.occurredAt
                        ? new Date(item.occurredAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "No date"}
                    </div>
                    {item.source && (
                      <span className="text-[11px] text-muted-foreground">{item.source}</span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs py-3 align-top">
                    <p className="line-clamp-2 text-foreground font-normal leading-relaxed">
                      {item.text}
                    </p>
                    {item.isChurnRisk && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 font-semibold mt-1">
                        <AlertTriangle className="h-3 w-3" /> Churn Risk Signal
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs py-3 align-top text-center">
                    {item.rating ? (
                      <div className="inline-flex items-center gap-0.5 text-amber-500 font-medium">
                        <span>{item.rating}</span>
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>

                  <TableCell className="text-xs py-3 align-top">
                    {renderSentimentBadge(item)}
                    {item.emotion && (
                      <div className="text-[10px] text-muted-foreground mt-1 capitalize">
                        {item.emotion}
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="text-xs py-3 align-top text-right">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Bar */}
        <div className="p-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <div>
            Showing <strong>{items.length}</strong> of <strong>{totalCount}</strong> items
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 font-medium text-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(page + 1)}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Item Detail Dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        {selectedItem && (
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between pr-6">
                <span>Feedback Item Detail</span>
                {renderSentimentBadge(selectedItem)}
              </DialogTitle>
              <DialogDescription className="text-xs flex items-center gap-2 pt-1">
                <span>Source: {selectedItem.source || "Direct upload"}</span>
                <span>•</span>
                <span>
                  Date:{" "}
                  {selectedItem.occurredAt
                    ? new Date(selectedItem.occurredAt).toLocaleDateString()
                    : "Not specified"}
                </span>
                {selectedItem.productVersion && (
                  <>
                    <span>•</span>
                    <span>Version: {selectedItem.productVersion}</span>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Full Text */}
              <div className="bg-muted/40 p-4 rounded-lg border text-sm leading-relaxed text-foreground">
                "{selectedItem.text}"
              </div>

              {/* Analysis Summary if analyzed */}
              {selectedItem.analysisStatus === "done" ? (
                <div className="space-y-3">
                  {selectedItem.summary && (
                    <div className="text-xs">
                      <span className="font-semibold text-foreground">One-line Summary: </span>
                      <span className="text-muted-foreground">{selectedItem.summary}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="border rounded p-2.5">
                      <div className="text-muted-foreground text-[11px]">Sentiment Score</div>
                      <div className="font-semibold text-sm">
                        {formatScore(selectedItem.sentimentScore)} / 1.00
                      </div>
                    </div>
                    <div className="border rounded p-2.5">
                      <div className="text-muted-foreground text-[11px]">Primary Emotion</div>
                      <div className="font-semibold text-sm capitalize">
                        {selectedItem.emotion || "Neutral"}
                      </div>
                    </div>
                  </div>

                  {selectedItem.aspects && selectedItem.aspects.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold mb-1.5">Detected Aspects:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedItem.aspects.map((asp, i) => (
                          <Badge
                            key={i}
                            variant={
                              asp.sentiment === "positive"
                                ? "positive"
                                : asp.sentiment === "negative"
                                ? "negative"
                                : "neutral"
                            }
                            className="text-[11px]"
                          >
                            {asp.aspect}: {asp.sentiment}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedItem.isChurnRisk && (
                    <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-2.5 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>This item was flagged as a potential customer churn risk.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground p-3 bg-muted/20 rounded-lg text-center">
                  This item has not been analyzed yet. Run the AI pipeline to extract sentiment,
                  pain points, and themes.
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
