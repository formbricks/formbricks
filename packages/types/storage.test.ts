import { describe, expect, test } from "vitest";
import { ALLOWED_FILE_EXTENSIONS, ZUploadPrivateFileRequest, ZUploadPublicFileRequest } from "./storage";

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
  test("accepts every allowed extension at once", () => {
    expect(upload(ALLOWED_FILE_EXTENSIONS).success).toBe(true);
  });

  // A survey can save its element's list with repeats; the upload must still go through.
  test("accepts a list that repeats allowed extensions, however often", () => {
    const result = upload(Array.from({ length: 100_000 }, (_unused, index) => (index % 2 ? "pdf" : "png")));

    expect(result.success && result.data.allowedFileExtensions).toEqual(["png", "pdf"]);
  });

  // `.max()` rejects the list before Zod reads an item, so invalid items add no issues of their own.
  test("rejects more distinct entries than the allowed set holds in a single issue, however many", () => {
    for (const length of [ALLOWED_FILE_EXTENSIONS.length + 1, 100_000]) {
      const result = upload(Array.from({ length }, (_unused, index) => `ext${index}`));

      expect(result.success ? [] : result.error.issues).toHaveLength(1);
    }
  });
});
