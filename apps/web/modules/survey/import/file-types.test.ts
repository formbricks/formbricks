import { describe, expect, test } from "vitest";
import {
  getImportAcceptList,
  getImportFileExtension,
  getImportLaneForFileName,
  isAiImportSourceKind,
  isLegacyOfficeExtension,
} from "./file-types";

describe("file-types", () => {
  test("maps file names to lanes by extension only", () => {
    expect(getImportLaneForFileName("survey.formbricks.json")).toBe("lossless");
    expect(getImportLaneForFileName("Survey.QSF")).toBe("structured");
    expect(getImportLaneForFileName("questions.docx")).toBe("ai");
    expect(getImportLaneForFileName("questions.csv")).toBe("ai");
    expect(getImportLaneForFileName("photo.png")).toBeNull();
    expect(getImportLaneForFileName("README")).toBeNull();
  });

  test("recognizes legacy Office extensions", () => {
    expect(isLegacyOfficeExtension(getImportFileExtension("old.doc"))).toBe(true);
    expect(isLegacyOfficeExtension(getImportFileExtension("old.XLS"))).toBe(true);
    expect(isLegacyOfficeExtension(getImportFileExtension("new.docx"))).toBe(false);
    expect(isLegacyOfficeExtension(null)).toBe(false);
  });

  test("knows which kinds need AI", () => {
    expect(isAiImportSourceKind("docx")).toBe(true);
    expect(isAiImportSourceKind("qsf")).toBe(false);
    expect(isAiImportSourceKind("formbricks-export")).toBe(false);
  });

  test("the accept list carries every extension with its MIME types and no legacy formats", () => {
    const accept = getImportAcceptList();
    expect(accept).toEqual(
      expect.arrayContaining([
        ".json",
        ".qsf",
        ".docx",
        ".pdf",
        ".md",
        ".txt",
        ".csv",
        ".xlsx",
        "application/pdf",
      ])
    );
    expect(accept).not.toContain(".doc");
  });
});
