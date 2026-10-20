"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export const MobileNavContext = React.createContext<(() => void) | null>(null);

export function useMobileNav() {
  return React.useContext(MobileNavContext);
}

interface ProjectShellProps {
  projectId: string;
  projectName: string;
  children: React.ReactNode;
}

export function ProjectShell({
  projectId,
  projectName,
  children,
}: ProjectShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Desktop Sidebar */}
      <Sidebar
        currentProjectId={projectId}
        projectName={projectName}
        className="hidden md:flex"
      />

      {/* Mobile Slide-out Drawer */}
      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent className="p-0 border-r w-72 max-w-[85vw] h-[100dvh] top-0 left-0 translate-x-0 translate-y-0 rounded-none sm:rounded-none bg-card shadow-2xl [&>button]:hidden">
          <Sidebar
            currentProjectId={projectId}
            projectName={projectName}
            onClose={() => setMobileNavOpen(false)}
            className="w-full border-r-0 h-full"
          />
        </DialogContent>
      </Dialog>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <MobileNavContext.Provider value={() => setMobileNavOpen(true)}>
          {children}
        </MobileNavContext.Provider>
      </div>
    </div>
  );
}
