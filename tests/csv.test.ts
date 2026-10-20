import { describe, it, expect } from "vitest";
import {
  autoDetectColumnMapping,
  previewCsv,
  parseCsvWithMapping,
  parsePastedText,
} from "@/lib/ingest/csv";
import { normalizeText, computeTextHash, detectLanguageLite } from "@/lib/ingest/normalize";

describe("CSV Parsing & Normalization", () => {
  it("normalizes text and computes deterministic hash", () => {
    const raw = "  This is a   TEST feedback with \r\n line breaks   ";
    const cleaned = normalizeText(raw);
    expect(cleaned).toBe("This is a TEST feedback with \n line breaks");

    const hash1 = computeTextHash(cleaned);
    const hash2 = computeTextHash("this is a test feedback with \n line breaks");
    expect(hash1).toBe(hash2);
  });

  it("auto-detects column headers correctly", () => {
    const headers = ["UserComment", "Score", "Platform", "CreatedDate", "AppVersion"];
    const mapping = autoDetectColumnMapping(headers);

    expect(mapping.textColumn).toBe("UserComment");
    expect(mapping.ratingColumn).toBe("Score");
    expect(mapping.sourceColumn).toBe("Platform");
    expect(mapping.occurredAtColumn).toBe("CreatedDate");
    expect(mapping.productVersionColumn).toBe("AppVersion");
  });

  it("parses CSV content and applies column mapping", () => {
    const csv = `Customer Review,Star Rating,Channel
"Great tool for projects",5,G2
"Export fails repeatedly",1,App Store
"Too short",,
`;
    const mapping = {
      textColumn: "Customer Review",
      ratingColumn: "Star Rating",
      sourceColumn: "Channel",
    };

    const { items, skippedEmpty } = parseCsvWithMapping(csv, mapping);
    expect(items.length).toBe(3);
    expect(items[0].text).toBe("Great tool for projects");
    expect(items[0].rating).toBe(5);
    expect(items[0].source).toBe("G2");
    expect(items[1].rating).toBe(1);
  });

  it("parses pasted text split by blank lines or newlines", () => {
    const pasted = `First review paragraph here.

Second review paragraph here.
Third review line.`;

    const items = parsePastedText(pasted);
    expect(items.length).toBe(2);
    expect(items[0].text).toBe("First review paragraph here.");
  });

  it("detects basic language types", () => {
    expect(detectLanguageLite("This is awesome project software")).toBe("en");
    expect(detectLanguageLite("El software es muy bueno y rápido con las tareas")).toBe("es");
    expect(detectLanguageLite("Das Programm ist wirklich gut und nützlich")).toBe("de");
  });
});
