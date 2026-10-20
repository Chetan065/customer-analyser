import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

const registerSchema = z.object({
  email: z.string().email("Invalid email address").toLowerCase().trim(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required").max(60).trim(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { email, password, name } = registerSchema.parse(json);

    // Check if email already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    if (existing) {
      return errorResponse("An account with this email already exists", 409);
    }

    const passwordHash = hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
      })
      .returning();

    // Automatically create session and set auth cookie
    await createSession(newUser.id);

    return successResponse(
      {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
        },
      },
      201
    );
  } catch (err) {
    return handleApiError(err);
  }
}
