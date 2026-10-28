import { describe, expect, test } from "vitest";
import { ALLOWED_FILE_EXTENSIONS, ZUploadPrivateFileRequest } from "./storage";

describe("ZUploadPrivateFileRequest.allowedFileExtensions", () => {
  const upload = (allowedFileExtensions: unknown[]) =>
    ZUploadPrivateFileRequest.safeParse({
      fileName: "receipt.pdf",
      fileType: "application/pdf",
      allowedFileExtensions,
      surveyId: "clx0000000000000000000s2",
      elementId: "upload",
      workspaceId: "clx0000000000000000000w1",
    });

  test("accepts every allowed extension at once", () => {
    expect(upload(ALLOWED_FILE_EXTENSIONS).success).toBe(true);
  });

  test("rejects a list longer than the allowed set in a single issue, however long", () => {
    for (const length of [ALLOWED_FILE_EXTENSIONS.length + 1, 1_000_000]) {
      const result = upload(Array.from({ length }, () => "not-an-extension"));

      expect(result.success ? [] : result.error.issues).toHaveLength(1);
    }
  });
});
