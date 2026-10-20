import * as React from "react";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/db/queries";
import { ensureDatabaseSchema } from "@/lib/db/bootstrap";
import { Sidebar } from "@/components/layout/sidebar";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await ensureDatabaseSchema();
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar currentProjectId={project.id} projectName={project.name} />
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}
