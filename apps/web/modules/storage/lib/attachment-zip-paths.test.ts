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
  };

  test("builds {date}_{responseId}/{n}_{label}/{fileName}", () => {
    expect(buildAttachmentZipPath({ ...baseParams, usedPaths: new Set() })).toBe(
      "2026-09-01_cm1response000000000000/2_Upload a photo/photo.jpg"
    );
  });

  test("dates the response folder in UTC, not the host timezone", () => {
    // 23:30 UTC is already the next day in Tokyo and still the previous day in Los Angeles; the folder
    // has to be stable regardless of who downloads the archive.
    const path = buildAttachmentZipPath({
      ...baseParams,
      responseCreatedAt: new Date("2026-09-01T23:30:00.000Z"),
      usedPaths: new Set(),
    });
    expect(path.startsWith("2026-09-01_")).toBe(true);
  });

  test("suffixes a collision before the extension", () => {
    const usedPaths = new Set<string>();
    const first = buildAttachmentZipPath({ ...baseParams, usedPaths });
    const second = buildAttachmentZipPath({ ...baseParams, usedPaths });
    const third = buildAttachmentZipPath({ ...baseParams, usedPaths });

    expect(first).toBe("2026-09-01_cm1response000000000000/2_Upload a photo/photo.jpg");
    expect(second).toBe("2026-09-01_cm1response000000000000/2_Upload a photo/photo (2).jpg");
    expect(third).toBe("2026-09-01_cm1response000000000000/2_Upload a photo/photo (3).jpg");
  });

  test("suffixes an extensionless collision at the end", () => {
    const usedPaths = new Set<string>();
    buildAttachmentZipPath({ ...baseParams, originalFileName: "scan", usedPaths });
    expect(buildAttachmentZipPath({ ...baseParams, originalFileName: "scan", usedPaths })).toBe(
      "2026-09-01_cm1response000000000000/2_Upload a photo/scan (2)"
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
