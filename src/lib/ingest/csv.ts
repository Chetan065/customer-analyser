import Papa from "papaparse";
import { normalizeText, computeTextHash, detectLanguageLite, type NormalizedItem } from "./normalize";
import { deriveCustomerSegment } from "./segments";

export const MAX_UPLOAD_ITEMS = 2000;

export interface ColumnMapping {
  textColumn: string;
  ratingColumn?: string;
  sourceColumn?: string;
  productVersionColumn?: string;
  occurredAtColumn?: string;
  // Phase 2: Customer Identity & Segments
  customerIdColumn?: string;
  orderCountColumn?: string;
  customerSegmentColumn?: string;
  regionColumn?: string;
  productColumn?: string;
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
      const idx = lowerHeaders.findIndex((h) => h === pattern || h.includes(pattern));
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

  // Phase 2 dimensions
  const customerIdCol = findHeader(["customer_id", "user_id", "client_id", "account_id", "customer", "uid"]);
  const orderCountCol = findHeader(["order_count", "orders", "purchase_count", "purchases", "transactions"]);
  const segmentCol = findHeader(["customer_segment", "segment", "tier", "plan", "user_type", "cohort", "type"]);
  const regionCol = findHeader(["region", "country", "geo", "location", "locale"]);
  const productCol = findHeader(["product_name", "product", "app_name", "app"]);

  return {
    textColumn: textCol,
    ratingColumn: ratingCol,
    sourceColumn: sourceCol,
    productVersionColumn: versionCol,
    occurredAtColumn: dateCol,
    customerIdColumn: customerIdCol,
    orderCountColumn: orderCountCol,
    customerSegmentColumn: segmentCol,
    regionColumn: regionCol,
    productColumn: productCol,
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

  // Track customer ID frequency within batch
  const customerFreq = new Map<string, number>();
  if (mapping.customerIdColumn) {
    for (const row of rows) {
      const cid = row[mapping.customerIdColumn];
      if (cid && String(cid).trim()) {
        const clean = String(cid).trim();
        customerFreq.set(clean, (customerFreq.get(clean) || 0) + 1);
      }
    }
  }

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

    // Phase 2: Segments & Identity
    const customerId = mapping.customerIdColumn && row[mapping.customerIdColumn]
      ? String(row[mapping.customerIdColumn]).trim()
      : null;

    let orderCount: number | null = null;
    if (mapping.orderCountColumn && row[mapping.orderCountColumn]) {
      const parsedOrders = parseInt(String(row[mapping.orderCountColumn]).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsedOrders) && parsedOrders >= 0) {
        orderCount = parsedOrders;
      }
    }

    const customerSegment = mapping.customerSegmentColumn && row[mapping.customerSegmentColumn]
      ? String(row[mapping.customerSegmentColumn]).trim()
      : null;

    const region = mapping.regionColumn && row[mapping.regionColumn]
      ? String(row[mapping.regionColumn]).trim()
      : null;

    const product = mapping.productColumn && row[mapping.productColumn]
      ? String(row[mapping.productColumn]).trim()
      : null;

    // Derive segment attributes
    const derived = deriveCustomerSegment({
      customerId,
      orderCount,
      customerSegment,
      knownCustomerFrequency: customerFreq,
    });

    items.push({
      text: cleanText,
      textHash: computeTextHash(cleanText),
      rating,
      source,
      productVersion,
      occurredAt,
      language: detectLanguageLite(cleanText),
      customerId,
      orderCount,
      isRepeatCustomer: derived.isRepeatCustomer,
      customerSegment: derived.customerSegment,
      region,
      product,
    });
  }

  return { items, skippedEmpty };
}

export function parsePastedText(rawPasted: string): NormalizedItem[] {
  if (!rawPasted) return [];

  const rawChunks = rawPasted.includes("\n\n")
    ? rawPasted.split(/\n\s*\n/)
    : rawPasted.split(/\r?\n/);

  const items: NormalizedItem[] = [];

  for (const chunk of rawChunks) {
    if (items.length >= MAX_UPLOAD_ITEMS) break;

    const clean = normalizeText(chunk);
    if (!clean || clean.length < 3) {
      continue;
    }

    items.push({
      text: clean,
      textHash: computeTextHash(clean),
      occurredAt: new Date(),
      source: "Pasted Text",
      language: detectLanguageLite(clean),
      isRepeatCustomer: false,
      customerSegment: null,
    });
  }

  return items;
}
