import { describe, expect, test } from "vitest";
import { IMPORT_MAX_FILE_BYTES } from "../types";
import { checkImportFile, formatFileSize } from "./import-file-checks";

describe("checkImportFile", () => {
  test("accepts a JSON file of any size under the cap, with or without AI", () => {
    expect(checkImportFile({ name: "survey.formbricks.json", size: 1024 }, false)).toBeNull();
    expect(checkImportFile({ name: "survey.qsf", size: IMPORT_MAX_FILE_BYTES }, false)).toBeNull();
  });

  test("refuses empty, oversized, legacy and unknown files before upload", () => {
    expect(checkImportFile({ name: "empty.json", size: 0 }, true)).toBe("empty_file");
    expect(checkImportFile({ name: "big.json", size: IMPORT_MAX_FILE_BYTES + 1 }, true)).toBe(
      "payload_too_large"
    );
    expect(checkImportFile({ name: "old.doc", size: 10 }, true)).toBe("legacy_office_format");
    expect(checkImportFile({ name: "image.png", size: 10 }, true)).toBe("unsupported_source");
  });

  test("an AI-lane file needs AI in the organization", () => {
    expect(checkImportFile({ name: "survey.docx", size: 10 }, true)).toBeNull();
    expect(checkImportFile({ name: "survey.docx", size: 10 }, false)).toBe("ai_unavailable_for_file");
  });
});

describe("formatFileSize", () => {
  test("picks the unit by size", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });
});
