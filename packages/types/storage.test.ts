import { describe, expect, test } from "vitest";
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_RAW_ALLOWED_FILE_EXTENSIONS,
  ZUploadPrivateFileRequest,
  ZUploadPublicFileRequest,
  getMimeTypeForFileName,
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
  test("accepts every allowed extension at once", () => {
    expect(upload(ALLOWED_FILE_EXTENSIONS).success).toBe(true);
  });

  // A survey can save its element's list with repeats; the upload must still go through.
  test("accepts a list that repeats allowed extensions, up to a thousand entries", () => {
    const result = upload(
      Array.from({ length: MAX_RAW_ALLOWED_FILE_EXTENSIONS }, (_unused, index) => (index % 2 ? "pdf" : "png"))
    );

    expect(result.success && result.data.allowedFileExtensions).toEqual(["png", "pdf"]);
  });

  // `.max()` rejects the list before Zod reads an item, so invalid items add no issues of their own.
  test("rejects more distinct entries than the allowed set holds in a single issue, however many", () => {
    for (const length of [ALLOWED_FILE_EXTENSIONS.length + 1, 100_000]) {
      const result = upload(Array.from({ length }, (_unused, index) => `ext${index}`));

      expect(result.success ? [] : result.error.issues).toHaveLength(1);
    }
  });

  // The issue names the limit that was crossed, not the allowed-set size the list never got to.
  test("refuses a list past the raw cap, even if every entry repeats, naming that cap", () => {
    const result = upload(Array.from({ length: MAX_RAW_ALLOWED_FILE_EXTENSIONS + 1 }, () => "pdf"));

    expect(result.success ? [] : result.error.issues).toEqual([
      expect.objectContaining({
        code: "too_big",
        maximum: MAX_RAW_ALLOWED_FILE_EXTENSIONS,
        path: ["allowedFileExtensions"],
      }),
    ]);
  });
});

// Regression (ENG-7108): only the part before the first ";" was compared, so a list of types such as
// "image/png;,text/html" passed for a .png and browsers rendered the stored file as HTML.
describe.each([
  [
    "private",
    (fileType: string) =>
      ZUploadPrivateFileRequest.safeParse({
        fileName: "photo.png",
        fileType,
        surveyId: "clx0000000000000000000s2",
        elementId: "upload",
        workspaceId: "clx0000000000000000000w1",
      }),
  ],
  [
    "public",
    (fileType: string) =>
      ZUploadPublicFileRequest.safeParse({
        fileName: "photo.png",
        fileType,
        workspaceId: "clx0000000000000000000w1",
      }),
  ],
])("%s upload fileType", (_, upload) => {
  test.each(["image/png;,text/html", "image/png, text/html", "image/png;x=1,text/html"])(
    "refuses a list of types (%s)",
    (fileType) => {
      expect(upload(fileType).success).toBe(false);
    }
  );

  test.each(["image/png", "IMAGE/PNG", "image/png; charset=binary"])("accepts %s for a .png", (fileType) => {
    expect(upload(fileType).success).toBe(true);
  });

  test("refuses a type that does not match the extension", () => {
    expect(upload("text/html").success).toBe(false);
  });
});

describe("getMimeTypeForFileName", () => {
  test.each([
    ["photo.png", "image/png"],
    ["photo.JPG", "image/jpeg"],
    ["surveys/s1/elements/e1/report--fid--abc.pdf", "application/pdf"],
    ["page.html", undefined],
    ["image.svg", undefined],
    ["png", undefined],
    ["archive.", undefined],
  ])("%s → %s", (fileName, expected) => {
    expect(getMimeTypeForFileName(fileName)).toBe(expected);
  });
});
