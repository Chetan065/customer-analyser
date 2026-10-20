"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Plus, UploadCloud, MessageSquareText } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { FeedbackTable } from "@/components/feedback/feedback-table";
import { ImportModal } from "@/components/feedback/import-modal";

export default function FeedbackExplorerPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [importOpen, setImportOpen] = React.useState(false);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Feedback Explorer"
        description="Filter, search, inspect raw customer feedback, sentiment scores, and detected tags."
        actions={
          <Button onClick={() => setImportOpen(true)} className="gap-2 shadow-xs">
            <UploadCloud className="h-4 w-4" />
            <span>Import Feedback</span>
          </Button>
        }
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        <FeedbackTable
          projectId={projectId}
          onRefreshTrigger={refreshTrigger}
        />
      </main>

      <ImportModal
        projectId={projectId}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportSuccess={() => setRefreshTrigger((prev) => prev + 1)}
      />
    </div>
  );
}
