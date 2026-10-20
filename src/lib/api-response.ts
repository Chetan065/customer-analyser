import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function errorResponse(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      data: null,
      error: {
        message,
        details: details || null,
      },
    },
    { status }
  );
}

export function handleApiError(err: unknown) {
  console.error("API error:", err);

  if (err instanceof ZodError) {
    return errorResponse(
      "Validation failed: " + err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
      400,
      err.issues
    );
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  return errorResponse(message, 500);
}
