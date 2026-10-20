"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Sparkles,
  CheckCircle2,
  CircleDashed,
  AlertCircle,
  BrainCircuit,
  Binary,
  Layers,
  Award,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface AnalysisRunnerDialogProps {
  projectId: string;
  runId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

const STEPS = [
  { id: "queued", label: "Initialize", icon: Sparkles },
  { id: "classify", label: "Classify Sentiment", icon: BrainCircuit },
  { id: "embed", label: "Generate Embeddings", icon: Binary },
  { id: "cluster", label: "Cluster Themes", icon: Layers },
  { id: "recommend", label: "AI Recommendations", icon: Award },
];

export function AnalysisRunnerDialog({
  projectId,
  runId,
  open,
  onOpenChange,
  onCompleted,
}: AnalysisRunnerDialogProps) {
  const [isRunning, setIsRunning] = React.useState(false);
  const [stage, setStage] = React.useState("queued");
  const [progress, setProgress] = React.useState(0);
  const [statusMessage, setStatusMessage] = React.useState("Preparing pipeline execution...");
  const [isCompleted, setIsCompleted] = React.useState(false);
  const [hasError, setHasError] = React.useState<string | null>(null);

  const abortRef = React.useRef(false);

  // Stepper loop function
  const runLoop = React.useCallback(async (id: string) => {
    setIsRunning(true);
    abortRef.current = false;
    setHasError(null);
    setIsCompleted(false);

    try {
      while (!abortRef.current) {
        const res = await fetch(`/api/runs/${id}/step`, {
          method: "POST",
        });

        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error?.message || "Step execution failed");
        }

        const data = json.data;
        setStage(data.stage);
        setProgress(data.progress);
        setStatusMessage(data.message || "Processing...");

        if (data.status === "completed" || data.stage === "done" || data.progress >= 100) {
          setIsCompleted(true);
          setIsRunning(false);
          setProgress(100);
          toast.success("Analysis pipeline finished successfully!");
          onCompleted?.();
          break;
        }

        if (data.status === "failed") {
          throw new Error(data.message || "Pipeline execution failed");
        }

        // Small breathing delay between serverless step invocations
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    } catch (err: any) {
      if (!abortRef.current) {
        console.error("Step execution error:", err);
        setHasError(err.message || "Execution encountered an error.");
        setIsRunning(false);
      }
    }
  }, [onCompleted]);

  React.useEffect(() => {
    if (open && runId) {
      runLoop(runId);
    } else {
      abortRef.current = true;
      setIsRunning(false);
    }
  }, [open, runId, runLoop]);

  const getStepStatus = (stepId: string) => {
    const stepOrder = ["queued", "classify", "embed", "cluster", "recommend", "done"];
    const currentIdx = stepOrder.indexOf(stage);
    const stepIdx = stepOrder.indexOf(stepId);

    if (isCompleted || currentIdx > stepIdx) return "completed";
    if (currentIdx === stepIdx) return "active";
    return "pending";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen && isRunning) {
          if (confirm("Analysis is running in the background. Are you sure you want to close this dialog?")) {
            abortRef.current = true;
            onOpenChange(false);
          }
        } else {
          onOpenChange(newOpen);
        }
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {isCompleted ? "Analysis Complete!" : "Analyzing Feedback Pipeline"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Executing LangGraph multi-stage intelligence pipeline on Neon Postgres + pgvector.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress Bar & Percentage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Overall Progress</span>
              <span className="text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2.5" />
            <p className="text-xs text-muted-foreground truncate font-mono pt-1">
              {statusMessage}
            </p>
          </div>

          {/* Stepper Grid */}
          <div className="space-y-2.5 border rounded-xl p-4 bg-muted/20">
            {STEPS.map((step) => {
              const status = getStepStatus(step.id);
              const Icon = step.icon;

              return (
                <div
                  key={step.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg text-xs transition-colors ${
                    status === "active"
                      ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                      : status === "completed"
                      ? "text-emerald-700 dark:text-emerald-400 font-medium"
                      : "text-muted-foreground/70"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{step.label}</span>
                  </div>

                  <div>
                    {status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : status === "active" ? (
                      <CircleDashed className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Waiting</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error Message if any */}
          {hasError && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-3 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Execution error:</p>
                <p>{hasError}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {isCompleted ? (
            <Button onClick={() => onOpenChange(false)} className="gap-2">
              <span>View Insights Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                abortRef.current = true;
                onOpenChange(false);
              }}
            >
              {isRunning ? "Run in Background" : "Close"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
