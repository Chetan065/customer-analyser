"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface HeaderProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  onNewProject?: () => void;
  user?: any;
}

export function Header({ title, description, actions, onNewProject, user }: HeaderProps) {
  return (
    <header className="h-16 border-b bg-card px-8 flex items-center justify-between sticky top-0 z-30">
      <div>
        {title && <h1 className="text-lg font-bold text-foreground tracking-tight">{title}</h1>}
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>

      <div className="flex items-center gap-3">
        {actions}
        <ThemeToggle />
        {onNewProject && (
          <Button size="sm" onClick={onNewProject} className="gap-1.5 shadow-xs">
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </Button>
        )}
        <div className="pl-2 border-l">
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
