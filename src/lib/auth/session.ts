import crypto from "crypto";
import { cookies } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions, users, type User } from "@/lib/db/schema";

export const SESSION_COOKIE_NAME = "fa_session";
export const SESSION_DURATION_DAYS = 30;

/**
 * Creates a new session in the database and sets an HTTP-only secure cookie.
 */
export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

/**
 * Retrieves the currently logged-in user from the session cookie.
 */
export async function getCurrentUser(): Promise<Omit<User, "passwordHash"> | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const [session] = await db
      .select({
        sessionId: sessions.id,
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          createdAt: users.createdAt,
        },
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())));

    if (!session) return null;

    return session.user;
  } catch (err) {
    console.error("Failed to get current user session:", err);
    return null;
  }
}

/**
 * Destroys the current session and clears the cookie.
 */
export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      await db.delete(sessions).where(eq(sessions.token, token));
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (err) {
    console.error("Failed to destroy session:", err);
  }
}
