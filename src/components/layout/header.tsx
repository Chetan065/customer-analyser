"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Plus, Menu } from "lucide-react";
import { useMobileNav } from "./project-shell";

interface HeaderProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  onNewProject?: () => void;
  onOpenMobileNav?: () => void;
  user?: any;
}

export function Header({
  title,
  description,
  actions,
  onNewProject,
  onOpenMobileNav,
  user,
}: HeaderProps) {
  const contextOpenMobileNav = useMobileNav();
  const handleOpenMobile = onOpenMobileNav || (contextOpenMobileNav ?? undefined);

  return (
    <header className="h-16 border-b bg-card px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 gap-3 min-w-0">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {handleOpenMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0 h-9 w-9 text-muted-foreground"
            onClick={handleOpenMobile}
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div className="min-w-0">
          {title && (
            <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight truncate">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-xs text-muted-foreground truncate hidden sm:block">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {actions}
        <ThemeToggle />
        {onNewProject && (
          <Button size="sm" onClick={onNewProject} className="gap-1.5 shadow-xs text-xs">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Project</span>
          </Button>
        )}
        <div className="pl-1 sm:pl-2 border-l">
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
