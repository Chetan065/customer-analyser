"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquareText,
  Network,
  Lightbulb,
  Settings,
  FolderGit2,
  Plus,
  Sparkles,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

interface SidebarProps {
  currentProjectId?: string;
  projectName?: string;
  onNewProject?: () => void;
}

export function Sidebar({ currentProjectId, projectName, onNewProject }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = currentProjectId
    ? [
        {
          label: "Overview",
          href: `/projects/${currentProjectId}`,
          icon: LayoutDashboard,
          active: pathname === `/projects/${currentProjectId}`,
        },
        {
          label: "Feedback Explorer",
          href: `/projects/${currentProjectId}/feedback`,
          icon: MessageSquareText,
          active: pathname.startsWith(`/projects/${currentProjectId}/feedback`),
        },
        {
          label: "Themes & Clusters",
          href: `/projects/${currentProjectId}/themes`,
          icon: Network,
          active: pathname.startsWith(`/projects/${currentProjectId}/themes`),
        },
        {
          label: "AI Recommendations",
          href: `/projects/${currentProjectId}/recommendations`,
          icon: Lightbulb,
          active: pathname.startsWith(`/projects/${currentProjectId}/recommendations`),
        },
        {
          label: "Settings & Cost",
          href: `/projects/${currentProjectId}/settings`,
          icon: Settings,
          active: pathname.startsWith(`/projects/${currentProjectId}/settings`),
        },
      ]
    : [];

  return (
    <aside className="w-64 border-r bg-card flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="h-16 px-6 border-b flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-foreground">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <span className="text-base tracking-tight">Feedback</span>
            <span className="text-base font-semibold text-primary ml-1">IQ</span>
          </div>
        </Link>
      </div>

      {/* Project Banner / Selector */}
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5 px-1">
          <span>Active Project</span>
          <Link
            href="/projects"
            className="text-primary hover:underline flex items-center gap-1 text-[11px]"
          >
            All projects
          </Link>
        </div>
        <div className="flex items-center justify-between gap-2 bg-background border rounded-lg p-2 px-3 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <FolderGit2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate">
              {projectName || (currentProjectId ? "Current Project" : "Select a Project")}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                item.active
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer Info & User */}
      <div className="p-4 border-t text-xs text-muted-foreground space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Postgres + pgvector</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground/80">
          Powered by LangGraph & Google Gemini
        </p>
        <div className="pt-2 border-t">
          <UserMenu />
        </div>
      </div>
    </aside>
  );
}
