import { describe, expect, test, vi } from "vitest";
import { hexText, setDeclaredSizes, zipOf } from "./__fixtures__/zip-builders";
import { SurveyImportFileTooLargeError, SurveyImportInputError } from "./errors";
import { openZipArchive } from "./zip";

/**
 * The archive's inflated total, counted across every part read. Lowered to 1 MiB here, so crossing it
 * takes a megabyte of test data instead of two hundred; `zip.test.ts` holds the real value's boundary on
 * what the directory declares.
 */
const { INFLATED_TOTAL } = vi.hoisted(() => ({ INFLATED_TOTAL: 1024 * 1024 }));

vi.mock("../limits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../limits")>()),
  SURVEY_IMPORT_ZIP_MAX_INFLATED_BYTES: INFLATED_TOTAL,
}));

const PART_BYTES = 600 * 1024;

/** Two parts of 600 KiB each; the second's directory entry claims 1 KiB, so the directory fits the total. */
const archive = setDeclaredSizes(
  zipOf({ "xl/sharedStrings.xml": hexText(PART_BYTES), "xl/worksheets/sheet1.xml": hexText(PART_BYTES) }, 1),
  "xl/worksheets/sheet1.xml",
  { uncompressedSize: 1024 }
);

describe("openZipArchive, counting the inflated total across reads", () => {
  test("refuses the read that takes the archive past the total, naming the limit", () => {
    const opened = openZipArchive(archive);

    expect(opened.read("xl/sharedStrings.xml")).toHaveLength(PART_BYTES);

    let thrown: unknown;
    try {
      opened.read("xl/worksheets/sheet1.xml");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SurveyImportFileTooLargeError);
    expect((thrown as SurveyImportFileTooLargeError).invalidParams).toEqual([
      expect.objectContaining({ code: "file_limit_exceeded", identifier: "zip_inflated_size" }),
    ]);
  });

  test("the same part read first is only refused for not being its declared size", () => {
    expect(() => openZipArchive(archive).read("xl/worksheets/sheet1.xml")).toThrow(SurveyImportInputError);
  });
});
