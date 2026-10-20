"use client";

import * as React from "react";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, ClipboardCopy, Sparkles, AlertCircle, Check, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { CsvPreview, ColumnMapping } from "@/lib/ingest/csv";

interface ImportModalProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess?: () => void;
}

export function ImportModal({
  projectId,
  open,
  onOpenChange,
  onImportSuccess,
}: ImportModalProps) {
  const [activeTab, setActiveTab] = React.useState<"csv" | "paste" | "sample">("csv");
  const [loading, setLoading] = React.useState(false);

  // CSV upload state
  const [csvContent, setCsvContent] = React.useState<string>("");
  const [csvFileName, setCsvFileName] = React.useState<string>("");
  const [csvPreview, setCsvPreview] = React.useState<CsvPreview | null>(null);
  const [mapping, setMapping] = React.useState<ColumnMapping>({ textColumn: "" });
  const [dragOver, setDragOver] = React.useState(false);

  // Paste state
  const [pastedText, setPastedText] = React.useState("");

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }

    setCsvFileName(file.name);
    setLoading(true);

    try {
      const text = await file.text();
      setCsvContent(text);

      const res = await fetch(`/api/projects/${projectId}/feedback/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent: text }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to preview CSV");
      }

      const preview: CsvPreview = json.data;
      setCsvPreview(preview);
      setMapping(preview.suggestedMapping);

      if (preview.exceedsLimit) {
        toast.warning("File contains over 2,000 rows. Ingestion is capped at the first 2,000 items.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to read CSV file");
    } finally {
      setLoading(false);
    }
  };

  const handleCsvImport = async () => {
    if (!csvContent || !mapping.textColumn) {
      toast.error("Please select a text column for the feedback items");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/feedback/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "csv",
          csvContent,
          mapping,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to import CSV");
      }

      toast.success(json.data.message);
      onOpenChange(false);
      resetState();
      onImportSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePasteImport = async () => {
    if (!pastedText.trim()) {
      toast.error("Please enter or paste feedback text");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/feedback/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "paste",
          rawText: pastedText,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to import feedback");
      }

      toast.success(json.data.message);
      onOpenChange(false);
      resetState();
      onImportSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSampleImport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/feedback/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "sample",
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Failed to load sample dataset");
      }

      toast.success(json.data.message);
      onOpenChange(false);
      resetState();
      onImportSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Sample import failed");
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setCsvContent("");
    setCsvFileName("");
    setCsvPreview(null);
    setMapping({ textColumn: "" });
    setPastedText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Import Customer Feedback</DialogTitle>
          <DialogDescription>
            Add raw reviews, support tickets, survey responses, or app store comments.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="w-full mt-2"
        >
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="csv" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span>CSV Upload</span>
            </TabsTrigger>
            <TabsTrigger value="paste" className="gap-2">
              <ClipboardCopy className="h-4 w-4" />
              <span>Paste Text</span>
            </TabsTrigger>
            <TabsTrigger value="sample" className="gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Sample Dataset</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: CSV UPLOAD */}
          <TabsContent value="csv" className="space-y-4 pt-3">
            {!csvPreview ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleFile(e.dataTransfer.files[0]);
                  }
                }}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
              >
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Drag & drop your feedback CSV file here</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports up to 2,000 rows. Auto-detects columns for text, rating, and date.
                    </p>
                  </div>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" type="button" disabled={loading} asChild>
                      <span>Browse File</span>
                    </Button>
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleFile(e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Column Mapping Section */}
                <div className="bg-muted/40 p-4 rounded-xl border space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold">Map Columns ({csvFileName})</h4>
                      <p className="text-xs text-muted-foreground">
                        {csvPreview.totalRows} rows detected. Map your CSV columns to the feedback fields.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCsvPreview(null);
                        setCsvContent("");
                      }}
                    >
                      Change File
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <Label className="text-xs font-medium">
                        Feedback Text <span className="text-red-500">*</span>
                      </Label>
                      <select
                        className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-xs shadow-xs"
                        value={mapping.textColumn || ""}
                        onChange={(e) => setMapping({ ...mapping, textColumn: e.target.value })}
                      >
                        <option value="">Select column...</option>
                        {csvPreview.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-medium">Rating (1-5, Optional)</Label>
                      <select
                        className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-xs shadow-xs"
                        value={mapping.ratingColumn || ""}
                        onChange={(e) =>
                          setMapping({ ...mapping, ratingColumn: e.target.value || undefined })
                        }
                      >
                        <option value="">(None)</option>
                        {csvPreview.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-medium">Date / Time (Optional)</Label>
                      <select
                        className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-xs shadow-xs"
                        value={mapping.occurredAtColumn || ""}
                        onChange={(e) =>
                          setMapping({ ...mapping, occurredAtColumn: e.target.value || undefined })
                        }
                      >
                        <option value="">(None)</option>
                        {csvPreview.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label className="text-xs font-medium">Source / Platform (Optional)</Label>
                      <select
                        className="mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-xs shadow-xs"
                        value={mapping.sourceColumn || ""}
                        onChange={(e) =>
                          setMapping({ ...mapping, sourceColumn: e.target.value || undefined })
                        }
                      >
                        <option value="">(None)</option>
                        {csvPreview.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Table Preview (First 20 rows) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Previewing first {Math.min(20, csvPreview.previewRows.length)} rows
                    </span>
                    {csvPreview.exceedsLimit && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Capped at 2,000 rows
                      </Badge>
                    )}
                  </div>

                  <div className="border rounded-lg max-h-48 overflow-auto text-xs">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {csvPreview.headers.slice(0, 5).map((h) => (
                            <TableHead key={h} className="text-xs py-2">
                              {h}
                              {mapping.textColumn === h && " (Text)"}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvPreview.previewRows.slice(0, 10).map((row, idx) => (
                          <TableRow key={idx}>
                            {csvPreview.headers.slice(0, 5).map((h) => (
                              <TableCell key={h} className="py-1.5 truncate max-w-xs">
                                {row[h]}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCsvImport} disabled={loading || !mapping.textColumn}>
                    {loading ? "Importing..." : `Import ${Math.min(2000, csvPreview.totalRows)} Items`}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: PASTE TEXT */}
          <TabsContent value="paste" className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label htmlFor="paste-area">Paste Feedback Items</Label>
              <Textarea
                id="paste-area"
                placeholder="Paste customer reviews or ticket comments here. Separate items with blank lines or newlines..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={10}
                className="font-mono text-xs leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">
                Each paragraph or separate line will be imported as an individual feedback item.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handlePasteImport} disabled={loading || !pastedText.trim()}>
                {loading ? "Importing..." : "Import Pasted Feedback"}
              </Button>
            </div>
          </TabsContent>

          {/* TAB 3: SAMPLE DATASET */}
          <TabsContent value="sample" className="space-y-4 pt-3">
            <div className="border rounded-xl p-6 bg-primary/5 space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">CloudFlow SaaS Sample Dataset</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Instantly load <strong>157 realistic customer reviews</strong> containing recurring bugs
                    (CSV export crash, Google Calendar sync token expiry, mobile notifications), pricing
                    complaints with churn risk, feature requests (native Slack bot, automated recurring tasks,
                    mobile dark mode), and mixed sentiment.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="bg-background border rounded-lg p-2.5">
                  <div className="font-bold text-foreground text-sm">157</div>
                  <div className="text-muted-foreground text-[11px]">Curated Reviews</div>
                </div>
                <div className="bg-background border rounded-lg p-2.5">
                  <div className="font-bold text-foreground text-sm">6 Sources</div>
                  <div className="text-muted-foreground text-[11px]">G2, Capterra, App Store...</div>
                </div>
                <div className="bg-background border rounded-lg p-2.5">
                  <div className="font-bold text-foreground text-sm">3 Months</div>
                  <div className="text-muted-foreground text-[11px]">Time Series Dates</div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSampleImport} disabled={loading} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>{loading ? "Importing Sample Dataset..." : "Load Sample Dataset (157 Reviews)"}</span>
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
