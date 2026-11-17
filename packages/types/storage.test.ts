import { describe, expect, test } from "vitest";
import { ZUploadPrivateFileRequest, ZUploadPublicFileRequest, getMimeTypeForFileName } from "./storage";

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
