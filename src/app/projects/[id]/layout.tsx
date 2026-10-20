import * as React from "react";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/db/queries";
import { ensureDatabaseSchema } from "@/lib/db/bootstrap";
import { ProjectShell } from "@/components/layout/project-shell";

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
    <ProjectShell projectId={project.id} projectName={project.name}>
      {children}
    </ProjectShell>
  );
}
