import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { ensureDatabaseSchema } from "@/lib/db/bootstrap";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

const loginSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseSchema();
    const json = await req.json();
    const { email, password } = loginSchema.parse(json);

    // Look up user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      return errorResponse("Invalid email or password", 401);
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return errorResponse("Invalid email or password", 401);
    }

    // Create session and set cookie
    await createSession(user.id);

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
