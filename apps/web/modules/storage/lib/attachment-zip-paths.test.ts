import { describe, expect, test } from "vitest";
import { buildAttachmentZipPath, sanitizeZipFileName, sanitizeZipPathSegment } from "./attachment-zip-paths";

describe("sanitizeZipPathSegment", () => {
  test("turns path separators into dashes so two words do not merge", () => {
    expect(sanitizeZipPathSegment("Front/Back")).toBe("Front-Back");
    expect(sanitizeZipPathSegment("Front\\Back")).toBe("Front-Back");
  });

  test("drops characters Windows rejects in a name", () => {
    expect(sanitizeZipPathSegment('What is your name? "Really"')).toBe("What is your name Really");
    expect(sanitizeZipPathSegment("Rate 1<>2|3*4:5")).toBe("Rate 12345");
  });

  test("keeps digits and spaces", () => {
    // Guard: an earlier draft wrote the control-character class with raw bytes, which reads as the
    // range space-to-colon and silently stripped every digit and space in a headline.
    expect(sanitizeZipPathSegment("3. Upload photo 42")).toBe("3. Upload photo 42");
  });

  test("drops control characters", () => {
    expect(sanitizeZipPathSegment("Up\u0000lo\u001fad\u007f")).toBe("Upload");
  });

  test("collapses runs of whitespace", () => {
    expect(sanitizeZipPathSegment("Upload   your \n photo")).toBe("Upload your photo");
  });

  test("trims leading and trailing dots and spaces", () => {
    // Windows trims these on extraction, which would collide two otherwise distinct segments.
    expect(sanitizeZipPathSegment("  ..Upload..  ")).toBe("Upload");
  });

  test("preserves non-Latin script and emoji", () => {
    expect(sanitizeZipPathSegment("写真をアップロード 📷")).toBe("写真をアップロード 📷");
  });

  test("truncates a long headline and re-trims the cut edge", () => {
    const segment = sanitizeZipPathSegment(`${"a".repeat(59)}. tail`);
    expect(segment).toBe("a".repeat(59));
    expect(segment).toHaveLength(59);
  });

  test("falls back when nothing survives sanitisation", () => {
    expect(sanitizeZipPathSegment("")).toBe("unnamed");
    expect(sanitizeZipPathSegment("   ")).toBe("unnamed");
    expect(sanitizeZipPathSegment("???")).toBe("unnamed");
  });

  test("escapes reserved DOS device names", () => {
    expect(sanitizeZipPathSegment("CON")).toBe("_CON");
    expect(sanitizeZipPathSegment("lpt3")).toBe("_lpt3");
    expect(sanitizeZipPathSegment("console")).toBe("console");
  });
});

describe("sanitizeZipFileName", () => {
  test("keeps the extension when the base is truncated", () => {
    const fileName = sanitizeZipFileName(`${"b".repeat(120)}.jpg`);
    expect(fileName).toBe(`${"b".repeat(60)}.jpg`);
  });

  test("trims a leading dot rather than reading it as an empty base plus extension", () => {
    // Two rules meet here: a leading dot is part of the name (so this is not `file.env`), and a name
    // may not start with a dot (Windows strips it on extraction), so the dot goes.
    expect(sanitizeZipFileName(".env")).toBe("env");
  });

  test("preserves extension case", () => {
    expect(sanitizeZipFileName("photo.JPG")).toBe("photo.JPG");
  });

  test("strips non-alphanumeric characters from the extension", () => {
    expect(sanitizeZipFileName("photo.jp g!")).toBe("photo.jpg");
  });

  test("falls back on an empty base while keeping the extension", () => {
    expect(sanitizeZipFileName("???.jpg")).toBe("file.jpg");
    expect(sanitizeZipFileName("")).toBe("file");
  });

  test("escapes a reserved DOS device name", () => {
    expect(sanitizeZipFileName("nul.txt")).toBe("_nul.txt");
  });
});

describe("buildAttachmentZipPath", () => {
  const baseParams = {
    responseId: "cm1response000000000000",
    responseCreatedAt: new Date("2026-09-01T10:30:00.000Z"),
    elementIndex: 2,
    elementLabel: "Upload a photo",
    originalFileName: "photo.jpg",
    timeZone: "UTC",
  };

  test("builds {date}_{responseId}/{n}_{label}/{fileName}", () => {
    expect(buildAttachmentZipPath({ ...baseParams, usedPaths: new Set() })).toBe(
      "2026-09-01T10-30-00_cm1response000000000000/2_Upload a photo/photo.jpg"
    );
  });

  test("stamps the folder in the given zone, not the host's", () => {
    const path = buildAttachmentZipPath({
      ...baseParams,
      responseCreatedAt: new Date("2026-09-01T23:30:00.000Z"),
      usedPaths: new Set(),
    });
    expect(path.startsWith("2026-09-01T23-30-00_")).toBe(true);
  });

  test("renders the clock of the organization's display time zone", () => {
    // The same instant, stamped for two orgs. 23:30 UTC is already the next day in Tokyo and still the
    // same evening in New York — matching what each org sees in its CSV export.
    const at = (timeZone: string) =>
      buildAttachmentZipPath({
        ...baseParams,
        responseCreatedAt: new Date("2026-09-01T23:30:00.000Z"),
        timeZone,
        usedPaths: new Set(),
      });

    expect(at("Asia/Tokyo").startsWith("2026-09-02T08-30-00_")).toBe(true);
    expect(at("America/New_York").startsWith("2026-09-01T19-30-00_")).toBe(true);
  });

  test("keeps the timestamp free of locale separators across many zones", () => {
    // The folder name is assembled from named date parts, not from a locale pattern: a pattern that
    // emitted `/` would add an unintended directory level inside the archive.
    const zones = [
      "UTC",
      "Asia/Tokyo",
      "Asia/Kolkata",
      "America/New_York",
      "Europe/Berlin",
      "Pacific/Chatham",
    ];

    for (const timeZone of zones) {
      const folder = buildAttachmentZipPath({
        ...baseParams,
        timeZone,
        usedPaths: new Set(),
      }).split("/")[0];

      expect(folder).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_/);
    }
  });

  test("stamps midnight as 00, not 24", () => {
    const path = buildAttachmentZipPath({
      ...baseParams,
      responseCreatedAt: new Date("2026-09-01T00:00:00.000Z"),
      usedPaths: new Set(),
    });
    expect(path.startsWith("2026-09-01T00-00-00_")).toBe(true);
  });

  test("falls back to UTC on an unusable time zone rather than failing the export", () => {
    const path = buildAttachmentZipPath({
      ...baseParams,
      responseCreatedAt: new Date("2026-09-01T23:30:00.000Z"),
      timeZone: "Not/AZone",
      usedPaths: new Set(),
    });
    expect(path.startsWith("2026-09-01T23-30-00_")).toBe(true);
  });

  test("sorts folders chronologically within a single day", () => {
    // A survey taking a thousand responses a day would otherwise pile them under one date prefix, where
    // the rest of the name is a cuid2 and sorts randomly.
    const usedPaths = new Set<string>();
    const at = (iso: string, responseId: string) =>
      buildAttachmentZipPath({ ...baseParams, responseCreatedAt: new Date(iso), responseId, usedPaths });

    const evening = at("2026-09-01T18:05:00.000Z", "cm1zzz000000000000000");
    const morning = at("2026-09-01T07:45:00.000Z", "cm1aaa000000000000000");

    // Sorted as a file browser would: the earlier response comes first despite the later id.
    expect([evening, morning].sort()).toEqual([morning, evening]);
  });

  test("keeps the folder name free of characters a filesystem rejects", () => {
    const path = buildAttachmentZipPath({ ...baseParams, usedPaths: new Set() });
    const responseFolder = path.split("/")[0];
    expect(responseFolder).not.toMatch(/[:*?"<>|\\]/);
  });

  test("suffixes a collision before the extension", () => {
    const usedPaths = new Set<string>();
    const first = buildAttachmentZipPath({ ...baseParams, usedPaths });
    const second = buildAttachmentZipPath({ ...baseParams, usedPaths });
    const third = buildAttachmentZipPath({ ...baseParams, usedPaths });

    expect(first).toBe("2026-09-01T10-30-00_cm1response000000000000/2_Upload a photo/photo.jpg");
    expect(second).toBe("2026-09-01T10-30-00_cm1response000000000000/2_Upload a photo/photo (2).jpg");
    expect(third).toBe("2026-09-01T10-30-00_cm1response000000000000/2_Upload a photo/photo (3).jpg");
  });

  test("suffixes an extensionless collision at the end", () => {
    const usedPaths = new Set<string>();
    buildAttachmentZipPath({ ...baseParams, originalFileName: "scan", usedPaths });
    expect(buildAttachmentZipPath({ ...baseParams, originalFileName: "scan", usedPaths })).toBe(
      "2026-09-01T10-30-00_cm1response000000000000/2_Upload a photo/scan (2)"
    );
  });

  test("registers the chosen path so the caller cannot emit a duplicate entry", () => {
    const usedPaths = new Set<string>();
    const path = buildAttachmentZipPath({ ...baseParams, usedPaths });
    expect(usedPaths.has(path)).toBe(true);
    expect(usedPaths.size).toBe(1);
  });

  test("does not collide across responses or elements", () => {
    const usedPaths = new Set<string>();
    const a = buildAttachmentZipPath({ ...baseParams, usedPaths });
    const b = buildAttachmentZipPath({ ...baseParams, elementIndex: 3, usedPaths });
    const c = buildAttachmentZipPath({ ...baseParams, responseId: "cm1response000000000001", usedPaths });

    expect(new Set([a, b, c]).size).toBe(3);
    expect(a.endsWith("photo.jpg")).toBe(true);
    expect(b.endsWith("photo.jpg")).toBe(true);
    expect(c.endsWith("photo.jpg")).toBe(true);
  });
});
