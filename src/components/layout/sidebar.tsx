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
  Sparkles,
  BotMessageSquare,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  currentProjectId?: string;
  projectName?: string;
  onNewProject?: () => void;
  className?: string;
  onClose?: () => void;
}

export function Sidebar({
  currentProjectId,
  projectName,
  onNewProject,
  className,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  const navItems = currentProjectId
    ? [
        {
          label: "Overview",
          href: `/projects/${currentProjectId}`,
          icon: LayoutDashboard,
          active: pathname === `/projects/${currentProjectId}`,
        },
        {
          label: "Ask PulseIQ",
          href: `/projects/${currentProjectId}/chat`,
          icon: BotMessageSquare,
          active: pathname.startsWith(`/projects/${currentProjectId}/chat`),
          highlight: true,
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
    <aside
      className={cn(
        "w-64 border-r bg-card flex flex-col h-[100dvh] sticky top-0 shrink-0",
        className
      )}
    >
      {/* Brand & Mobile Close */}
      <div className="h-16 px-5 border-b flex items-center justify-between">
        <Link
          href="/"
          onClick={onClose}
          className="flex items-center gap-2.5 font-bold text-foreground min-w-0"
        >
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-xs shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="truncate">
            <span className="text-base tracking-tight">Pulse</span>
            <span className="text-base font-semibold text-primary ml-1">IQ</span>
          </div>
        </Link>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8 text-muted-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        )}
      </div>

      {/* Project Banner / Selector */}
      <div className="p-3.5 border-b bg-muted/30">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5 px-1">
          <span>Active Project</span>
          <Link
            href="/"
            onClick={onClose}
            className="text-primary hover:underline flex items-center gap-1 text-[11px]"
          >
            All projects
          </Link>
        </div>
        <div className="flex items-center justify-between gap-2 bg-background border rounded-lg p-2 px-3 shadow-xs min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <FolderGit2 className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-medium truncate">
              {projectName || (currentProjectId ? "Current Project" : "Select a Project")}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                item.active
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : item.highlight
                  ? "text-primary hover:bg-primary/10 font-semibold"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.highlight && !item.active && (
                <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  New
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer User */}
      <div className="p-3.5 border-t mt-auto">
        <UserMenu />
      </div>
    </aside>
  );
}
