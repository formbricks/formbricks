import { describe, expect, test } from "vitest";
import {
  getSignatureDownloadFileName,
  getSignatureImageSrc,
  getSignatureResponseView,
} from "./signature-image";

const PATH =
  "/storage/ws1/private/surveys/s1/elements/e1/signature--fid--0b8a4a3e-1111-4222-8333-444455556666.png";
const ORIGIN = "https://app.example.com";

describe("getSignatureImageSrc", () => {
  test("accepts a relative private storage path", () => {
    expect(getSignatureImageSrc(PATH)).toBe(PATH);
  });

  test("accepts an absolute URL on the current origin and returns its path", () => {
    expect(getSignatureImageSrc(`${ORIGIN}${PATH}`, ORIGIN)).toBe(PATH);
  });

  test.each([
    ["a foreign host", `https://evil.example.org${PATH}`],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:image/png;base64,AAAA"],
    ["a public storage path", "/storage/ws1/public/logo.png"],
    ["a protocol-relative URL", "//evil.example.org/storage/ws1/private/x.png"],
    ["a path outside /storage", "/api/v1/management/me"],
    ["a dot segment", "/storage/ws1/private/../../api/v1/management/me"],
    ["an encoded dot segment", "/storage/ws1/private/%2e%2e/%2E%2e/api"],
    ["plain text", "John Doe"],
    ["an empty string", ""],
    ["a number", 42],
    ["an array", [PATH]],
  ])("refuses %s", (_label, value) => {
    expect(getSignatureImageSrc(value, ORIGIN)).toBeNull();
  });

  test("refuses an absolute URL when no origin is given", () => {
    expect(getSignatureImageSrc(`${ORIGIN}${PATH}`)).toBeNull();
  });
});

describe("getSignatureDownloadFileName", () => {
  test("drops the storage id from the stored name", () => {
    expect(getSignatureDownloadFileName(PATH)).toBe("signature.png");
  });

  test("falls back when the URL has no readable name", () => {
    expect(getSignatureDownloadFileName("/storage/ws1/private/%E0%A4%A")).toBe("signature.png");
  });
});

describe("getSignatureResponseView", () => {
  test.each([[""], [undefined], [null]])("treats %j as skipped", (value) => {
    expect(getSignatureResponseView(value, ORIGIN)).toEqual({ kind: "skipped" });
  });

  test("returns the image with its download name for a storage URL", () => {
    expect(getSignatureResponseView(PATH, ORIGIN)).toEqual({
      kind: "image",
      src: PATH,
      fileName: "signature.png",
    });
  });

  test("shows anything else as text, never as an image", () => {
    expect(getSignatureResponseView("javascript:alert(1)", ORIGIN)).toEqual({
      kind: "text",
      text: "javascript:alert(1)",
    });
  });
});
