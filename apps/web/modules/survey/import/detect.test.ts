import { describe, expect, test } from "vitest";
import {
  detectImportSource,
  detectJsonSourceKind,
  getImportAcceptList,
  getImportFileExtension,
} from "./detect";

const bytes = (text: string) => Buffer.from(text, "utf8");
const zipWith = (entryName: string) =>
  Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]), Buffer.from(`......${entryName}......`)]);

const exportEnvelope = { formbricks: { exportFormat: 1 }, survey: {}, references: {} };
const qsf = { SurveyEntry: { SurveyName: "x" }, SurveyElements: [] };
const v3Document = { name: "Survey", blocks: [] };

describe("detectImportSource", () => {
  test.each([
    ["export.formbricks.json", exportEnvelope, "formbricks-export"],
    ["renamed.json", qsf, "qsf"],
    ["survey.qsf", qsf, "qsf"],
    ["doc.json", v3Document, "v3-document"],
    ["get-response.json", { data: v3Document }, "v3-document"],
    ["wrapped-export.json", { data: exportEnvelope }, "formbricks-export"],
  ])("recognizes %s by content as %s", (fileName, content, expected) => {
    expect(detectImportSource({ fileName, bytes: bytes(JSON.stringify(content)) })).toEqual({
      ok: true,
      kind: expected,
    });
  });

  test("content wins over a misleading extension", () => {
    expect(
      detectImportSource({ fileName: "notes.txt", bytes: bytes(JSON.stringify(exportEnvelope)) })
    ).toEqual({ ok: true, kind: "formbricks-export" });
    expect(detectImportSource({ fileName: "scan.docx", bytes: bytes("%PDF-1.7 ...") })).toEqual({
      ok: true,
      kind: "pdf",
    });
  });

  test("tells docx from xlsx by the zip entry names", () => {
    expect(detectImportSource({ fileName: "file.bin", bytes: zipWith("word/document.xml") })).toEqual({
      ok: true,
      kind: "docx",
    });
    expect(detectImportSource({ fileName: "file.bin", bytes: zipWith("xl/workbook.xml") })).toEqual({
      ok: true,
      kind: "xlsx",
    });
    expect(detectImportSource({ fileName: "archive.zip", bytes: zipWith("photos/a.png") })).toEqual({
      ok: false,
      code: "unsupported_source",
      extension: "zip",
    });
  });

  test.each([
    ["survey.md", "markdown"],
    ["survey.txt", "text"],
    ["questions.csv", "csv"],
  ])("falls back to the extension for %s", (fileName, expected) => {
    expect(detectImportSource({ fileName, bytes: bytes("1. How are you?\n- Good\n- Bad") })).toEqual({
      ok: true,
      kind: expected,
    });
  });

  test("falls back to the MIME type when the name has no usable extension", () => {
    expect(detectImportSource({ fileName: "upload", mimeType: "text/csv", bytes: bytes("a;b") })).toEqual({
      ok: true,
      kind: "csv",
    });
    expect(detectImportSource({ fileName: null, mimeType: "application/pdf; charset=binary" })).toEqual({
      ok: true,
      kind: "pdf",
    });
  });

  test("rejects legacy Office formats with their own code", () => {
    expect(detectImportSource({ fileName: "survey.doc", bytes: bytes("\xd0\xcf\x11\xe0") })).toEqual({
      ok: false,
      code: "legacy_office_format",
      extension: "doc",
    });
    expect(detectImportSource({ fileName: "survey.XLS" })).toEqual({
      ok: false,
      code: "legacy_office_format",
      extension: "xls",
    });
  });

  test("rejects empty files, unknown extensions, unrecognized JSON and broken JSON", () => {
    expect(detectImportSource({ fileName: "empty.json", bytes: Buffer.alloc(0) })).toEqual({
      ok: false,
      code: "empty_file",
      extension: "json",
    });
    expect(detectImportSource({ fileName: "image.png", bytes: bytes("\x89PNG") })).toEqual({
      ok: false,
      code: "unsupported_source",
      extension: "png",
    });
    expect(detectImportSource({ fileName: "settings.json", bytes: bytes('{"theme":"dark"}') })).toEqual({
      ok: false,
      code: "unsupported_source",
      extension: "json",
    });
    expect(detectImportSource({ fileName: "broken.json", bytes: bytes("{ not json") })).toEqual({
      ok: false,
      code: "invalid_json",
      extension: "json",
    });
    expect(detectImportSource({})).toEqual({ ok: false, code: "unsupported_source", extension: null });
  });

  test("a BOM does not hide JSON", () => {
    expect(
      detectImportSource({ fileName: "x.json", bytes: bytes(`\uFEFF${JSON.stringify(v3Document)}`) })
    ).toEqual({ ok: true, kind: "v3-document" });
  });
});

describe("helpers", () => {
  test("getImportFileExtension lower-cases and ignores paths without a dot", () => {
    expect(getImportFileExtension("Survey.QSF")).toBe("qsf");
    expect(getImportFileExtension("archive.tar.gz")).toBe("gz");
    expect(getImportFileExtension("README")).toBeNull();
    expect(getImportFileExtension(undefined)).toBeNull();
  });

  test("detectJsonSourceKind returns null for non-objects", () => {
    expect(detectJsonSourceKind([])).toBeNull();
    expect(detectJsonSourceKind("x")).toBeNull();
    expect(detectJsonSourceKind({ data: 1 })).toBeNull();
  });

  test("getImportAcceptList carries every extension with a dot plus its MIME types", () => {
    const accept = getImportAcceptList();

    expect(accept).toContain(".qsf");
    expect(accept).toContain(".formbricks.json".slice(11));
    expect(accept).toContain("application/pdf");
    expect(accept).not.toContain(".doc");
  });
});
