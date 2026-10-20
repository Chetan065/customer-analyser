import Papa from "papaparse";
import { normalizeText, computeTextHash, detectLanguageLite, type NormalizedItem } from "./normalize";

export const MAX_UPLOAD_ITEMS = 2000;

export interface ColumnMapping {
  textColumn: string;
  ratingColumn?: string;
  sourceColumn?: string;
  productVersionColumn?: string;
  occurredAtColumn?: string;
}

export interface CsvPreview {
  headers: string[];
  suggestedMapping: ColumnMapping;
  previewRows: Record<string, string>[];
  totalRows: number;
  exceedsLimit: boolean;
}

export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  const findHeader = (patterns: string[]): string | undefined => {
    for (const pattern of patterns) {
      const idx = lowerHeaders.findIndex((h) => h.includes(pattern));
      if (idx !== -1) return headers[idx];
    }
    return undefined;
  };

  const textCol =
    findHeader(["review", "feedback", "comment", "text", "content", "body", "message", "description"]) ||
    headers[0] ||
    "";

  const ratingCol = findHeader(["rating", "score", "stars", "star"]);
  const sourceCol = findHeader(["source", "channel", "platform", "origin", "type"]);
  const versionCol = findHeader(["version", "product_version", "app_version", "release", "build"]);
  const dateCol = findHeader(["occurred_at", "date", "created_at", "timestamp", "time", "created"]);

  return {
    textColumn: textCol,
    ratingColumn: ratingCol,
    sourceColumn: sourceCol,
    productVersionColumn: versionCol,
    occurredAtColumn: dateCol,
  };
}

export function previewCsv(csvContent: string): CsvPreview {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: "greedy",
  });

  const headers = parsed.meta.fields || [];
  const rows = parsed.data.filter((r) => Object.values(r).some((v) => v && String(v).trim().length > 0));
  const suggestedMapping = autoDetectColumnMapping(headers);

  return {
    headers,
    suggestedMapping,
    previewRows: rows.slice(0, 20),
    totalRows: rows.length,
    exceedsLimit: rows.length > MAX_UPLOAD_ITEMS,
  };
}

export function parseCsvWithMapping(
  csvContent: string,
  mapping: ColumnMapping
): { items: NormalizedItem[]; skippedEmpty: number } {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: "greedy",
  });

  const rows = parsed.data;
  const items: NormalizedItem[] = [];
  let skippedEmpty = 0;

  for (const row of rows) {
    if (items.length >= MAX_UPLOAD_ITEMS) {
      break;
    }

    const rawText = mapping.textColumn ? row[mapping.textColumn] : "";
    const cleanText = normalizeText(rawText);

    if (!cleanText || cleanText.length < 3) {
      skippedEmpty++;
      continue;
    }

    let rating: number | null = null;
    if (mapping.ratingColumn && row[mapping.ratingColumn]) {
      const parsedRating = parseInt(String(row[mapping.ratingColumn]).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsedRating) && parsedRating >= 1 && parsedRating <= 5) {
        rating = parsedRating;
      }
    }

    let occurredAt: Date | null = null;
    if (mapping.occurredAtColumn && row[mapping.occurredAtColumn]) {
      const parsedDate = new Date(row[mapping.occurredAtColumn]);
      if (!isNaN(parsedDate.getTime())) {
        occurredAt = parsedDate;
      }
    }

    const source = mapping.sourceColumn && row[mapping.sourceColumn] ? String(row[mapping.sourceColumn]).trim() : null;
    const productVersion =
      mapping.productVersionColumn && row[mapping.productVersionColumn]
        ? String(row[mapping.productVersionColumn]).trim()
        : null;

    items.push({
      text: cleanText,
      textHash: computeTextHash(cleanText),
      rating,
      source,
      productVersion,
      occurredAt,
      language: detectLanguageLite(cleanText),
    });
  }

  return { items, skippedEmpty };
}

/**
 * Parses raw pasted text where items are separated either by blank lines or newlines.
 */
export function parsePastedText(rawInput: string): NormalizedItem[] {
  if (!rawInput.trim()) return [];

  // If there are double newlines, treat each chunk as a review. Otherwise each non-empty line.
  const hasParagraphs = /\n\s*\n/.test(rawInput);
  const rawChunks = hasParagraphs
    ? rawInput.split(/\n\s*\n/)
    : rawInput.split(/\n/);

  const items: NormalizedItem[] = [];

  for (const chunk of rawChunks) {
    if (items.length >= MAX_UPLOAD_ITEMS) break;

    const cleaned = normalizeText(chunk);
    if (cleaned.length >= 3) {
      items.push({
        text: cleaned,
        textHash: computeTextHash(cleaned),
        language: detectLanguageLite(cleaned),
      });
    }
  }

  return items;
}
