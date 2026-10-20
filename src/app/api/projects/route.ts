import { NextRequest } from "next/server";
import { z } from "zod";
import { listProjects, createProject } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureDatabaseSchema } from "@/lib/db/bootstrap";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  description: z.string().max(500).optional(),
});

export async function GET() {
  try {
    await ensureDatabaseSchema();
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse("Unauthorized. Please log in.", 401);
    }

    const projects = await listProjects(user.id);
    return successResponse(projects);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseSchema();
    const user = await getCurrentUser();
    if (!user) {
      return errorResponse("Please sign in or use demo account to create projects.", 401);
    }

    const json = await req.json();
    const validated = createProjectSchema.parse(json);

    const project = await createProject({
      name: validated.name.trim(),
      description: validated.description?.trim() || null,
      userId: user.id,
    });

    return successResponse(project, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
