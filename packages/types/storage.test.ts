import { describe, expect, test } from "vitest";
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_ALLOWED_FILE_EXTENSIONS_PER_REQUEST,
  ZUploadPrivateFileRequest,
  ZUploadPublicFileRequest,
} from "./storage";

const uploads = {
  private: (allowedFileExtensions: unknown[]) =>
    ZUploadPrivateFileRequest.safeParse({
      fileName: "receipt.pdf",
      fileType: "application/pdf",
      allowedFileExtensions,
      surveyId: "clx0000000000000000000s2",
      elementId: "upload",
      workspaceId: "clx0000000000000000000w1",
    }),
  public: (allowedFileExtensions: unknown[]) =>
    ZUploadPublicFileRequest.safeParse({
      fileName: "receipt.pdf",
      fileType: "application/pdf",
      workspaceId: "clx0000000000000000000w1",
      allowedFileExtensions,
    }),
};

describe.each(Object.entries(uploads))("%s upload allowedFileExtensions", (_, upload) => {
  test("accepts every allowed extension, and a list that repeats them up to the cap", () => {
    expect(upload(ALLOWED_FILE_EXTENSIONS).success).toBe(true);
    expect(upload(Array.from({ length: MAX_ALLOWED_FILE_EXTENSIONS_PER_REQUEST }, () => "pdf")).success).toBe(
      true
    );
  });

  // `.max()` rejects the list before Zod reads an item, so invalid items add no issues of their own.
  test("rejects a list past the cap in a single issue, however long", () => {
    for (const length of [MAX_ALLOWED_FILE_EXTENSIONS_PER_REQUEST + 1, 1_000_000]) {
      const result = upload(Array.from({ length }, () => "not-an-extension"));

      expect(result.success ? [] : result.error.issues).toHaveLength(1);
    }
  });
});
