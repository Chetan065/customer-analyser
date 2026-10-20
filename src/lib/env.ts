import { z } from "zod";

const envSchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("text-embedding-004"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required to connect to Neon Postgres"),
  AUTH_SECRET: z.string().default("feedback-analyzer-secret-key-change-in-production"),
});

export type Env = z.infer<typeof envSchema> & {
  resolvedApiKey: string;
};

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004",
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET ?? "feedback-analyzer-secret-key-change-in-production",
  });

  if (!result.success) {
    const errorMessages = result.error.issues
      .map((issue) => ` - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    if (process.env.SKIP_ENV_VALIDATION === "1" || process.env.NODE_ENV === "test") {
      return {
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || "test-key",
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004",
        DATABASE_URL: process.env.DATABASE_URL || "postgresql://mock:mock@localhost:5432/mock",
        AUTH_SECRET: "mock-secret",
        resolvedApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "test-key",
      };
    }

    throw new Error(
      `\n❌ Invalid or missing environment configuration:\n${errorMessages}\n\n👉 Please configure these variables in your .env.local file or deployment environment settings.\n`
    );
  }

  const rawData = result.data;
  const resolvedApiKey =
    rawData.GEMINI_API_KEY ||
    rawData.GOOGLE_API_KEY ||
    rawData.OPENAI_API_KEY ||
    "";

  if (!resolvedApiKey && process.env.SKIP_ENV_VALIDATION !== "1" && process.env.NODE_ENV !== "test") {
    console.warn("⚠️ Warning: Neither GEMINI_API_KEY nor GOOGLE_API_KEY was found in environment. Set GEMINI_API_KEY in .env.local.");
  }

  cachedEnv = {
    ...rawData,
    resolvedApiKey,
  };

  return cachedEnv;
}

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    const current = getEnv();
    return current[prop as keyof Env];
  },
});
