"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  FolderPlus,
  ArrowRight,
  MessageSquare,
  BarChart,
  Layers,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import { toast } from "sonner";

interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  feedbackCount: number;
  runCount: number;
}

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = React.useState<ProjectItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newProjectOpen, setNewProjectOpen] = React.useState(false);
  const [creatingSample, setCreatingSample] = React.useState(false);

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      const json = await res.json();
      if (res.ok && json.data) {
        setProjects(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateSampleProject = async () => {
    setCreatingSample(true);
    try {
      // 1. Create project
      const projRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "CloudFlow Project Management SaaS",
          description: "Sample workspace containing customer reviews from G2, Capterra, and App Store.",
        }),
      });

      const projJson = await projRes.json();
      if (!projRes.ok || projJson.error) {
        throw new Error(projJson.error?.message || "Failed to create project");
      }

      const projectId = projJson.data.id;

      // 2. Ingest sample data
      const importRes = await fetch(`/api/projects/${projectId}/feedback/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "sample" }),
      });

      const importJson = await importRes.json();
      if (!importRes.ok || importJson.error) {
        throw new Error(importJson.error?.message || "Failed to import sample feedback");
      }

      toast.success("Sample project created with 157 reviews!");
      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to setup sample project");
      setCreatingSample(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project and all its feedback/analyses?")) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Project deleted");
        setProjects((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (err) {
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation */}
      <header className="border-b bg-card px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-foreground">Pulse</span>
            <span className="font-bold text-base text-primary ml-1">IQ</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button onClick={() => setNewProjectOpen(true)} className="gap-2 shadow-xs">
            <FolderPlus className="h-4 w-4" />
            <span>New Project</span>
          </Button>
          <div className="pl-2 border-l">
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Hero & Projects */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-8 space-y-8">
        {/* Banner */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-3 w-3" />
              <span>AI Customer Feedback Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Turn unstructured reviews into prioritized product roadmaps
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ingest feedback, classify sentiment, cluster recurring pain points and feature requests,
              and receive evidence-grounded AI recommendations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Button
              size="lg"
              variant="default"
              onClick={handleCreateSampleProject}
              disabled={creatingSample}
              className="gap-2 shadow-sm font-semibold"
            >
              <Sparkles className="h-4 w-4" />
              <span>{creatingSample ? "Creating Demo..." : "Quick Demo: CloudFlow SaaS"}</span>
            </Button>
          </div>
        </div>

        {/* Projects Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Your Projects</h2>
            <span className="text-xs text-muted-foreground">{projects.length} project(s)</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-40 rounded-xl border bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed p-12 text-center space-y-4 bg-muted/20">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <FolderPlus className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">No projects yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Create a new project or start instantly with the pre-loaded 157-review sample dataset.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <Button onClick={() => setNewProjectOpen(true)} variant="outline" size="sm">
                  Create Empty Project
                </Button>
                <Button onClick={handleCreateSampleProject} size="sm" disabled={creatingSample}>
                  Load Demo Project
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group block"
                >
                  <Card className="h-full hover:border-primary/50 hover:shadow-md transition-all duration-200">
                    <CardHeader className="p-5 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base group-hover:text-primary transition-colors line-clamp-1">
                          {project.name}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDeleteProject(e, project.id)}
                          title="Delete Project"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <CardDescription className="text-xs line-clamp-2 mt-1">
                        {project.description || "No description provided."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 pt-0">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-4 border-t mt-3">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-primary" />
                          <span>{project.feedbackCount} items</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-primary" />
                          <span>{project.runCount} run(s)</span>
                        </div>
                        <span className="ml-auto text-[11px]">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        onCreated={(id) => router.push(`/projects/${id}`)}
      />
    </div>
  );
}
