import crypto from "crypto";

export interface NormalizedItem {
  text: string;
  textHash: string;
  rating?: number | null;
  source?: string | null;
  productVersion?: string | null;
  occurredAt?: Date | null;
  language?: string;
  customerId?: string | null;
  orderCount?: number | null;
  isRepeatCustomer?: boolean;
  customerSegment?: string | null;
  region?: string | null;
  product?: string | null;
}

/**
 * Normalizes feedback text: trims, unifies line breaks, collapses excessive spaces,
 * and caps at 1500 chars to fit comfortably within LLM context windows.
 */
export function normalizeText(rawText: string, maxLength = 1500): string {
  if (!rawText) return "";
  let cleaned = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength).trim() + "...";
  }

  return cleaned;
}

/**
 * Computes a deterministic SHA-256 hash of the normalized, lowercased text
 * to deduplicate feedback items within a project.
 */
export function computeTextHash(text: string): string {
  const normalizedForHash = text.toLowerCase().replace(/\s+/g, " ").trim();
  return crypto.createHash("sha256").update(normalizedForHash).digest("hex");
}

/**
 * Lightweight language detection to identify non-English feedback
 */
export function detectLanguageLite(text: string): "en" | "es" | "fr" | "de" | "cjk" | "other" {
  // Check for CJK characters
  if (/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(text)) {
    return "cjk";
  }
  // Check common Spanish words
  if (/\b(el|la|los|las|de|que|y|en|un|una|es|por|para|con)\b/i.test(text) && /[áéíóúñ]/i.test(text)) {
    return "es";
  }
  // Check common French words
  if (/\b(le|la|les|un|une|des|et|en|est|pour|avec|dans)\b/i.test(text) && /[àâçéèêëîïôûùüÿ]/i.test(text)) {
    return "fr";
  }
  // Check common German words
  if (/\b(der|die|das|und|in|den|von|zu|mit|sich|des|auf|für|ist)\b/i.test(text) && /[äöüß]/i.test(text)) {
    return "de";
  }
  return "en";
}
