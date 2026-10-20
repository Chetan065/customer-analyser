import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { successResponse, handleApiError } from "@/lib/api-response";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "src", "data", "sample-reviews.csv");
    const csvContent = fs.readFileSync(filePath, "utf8");
    return successResponse({
      filename: "sample-reviews.csv",
      content: csvContent,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
