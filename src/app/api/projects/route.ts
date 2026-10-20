import { NextRequest } from "next/server";
import { z } from "zod";
import { listProjects, createProject } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { successResponse, handleApiError } from "@/lib/api-response";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  description: z.string().max(500).optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    const projects = await listProjects(user?.id);
    return successResponse(projects);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const json = await req.json();
    const validated = createProjectSchema.parse(json);
    const project = await createProject({
      ...validated,
      userId: user?.id || null,
    });
    return successResponse(project, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
