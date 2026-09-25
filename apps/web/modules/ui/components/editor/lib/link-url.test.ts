import { describe, expect, test } from "vitest";
import { isMailtoUrl, isValidEditorLinkUrl } from "./link-url";

describe("isValidEditorLinkUrl", () => {
  test("accepts http(s) links with a real host", () => {
    expect(isValidEditorLinkUrl("https://formbricks.com")).toBe(true);
    expect(isValidEditorLinkUrl("http://localhost:3000/path")).toBe(true);
    expect(isValidEditorLinkUrl("https://192.168.0.1")).toBe(true);
    expect(isValidEditorLinkUrl("https://[::1]")).toBe(true);
  });

  test("rejects http(s) links without a dotted host", () => {
    expect(isValidEditorLinkUrl("https://formbricks")).toBe(false);
  });

  test("accepts mailto: links that name a recipient", () => {
    expect(isValidEditorLinkUrl("mailto:hello@felofish.com")).toBe(true);
    expect(isValidEditorLinkUrl("mailto:a@example.com,b@example.com")).toBe(true);
    expect(isValidEditorLinkUrl("mailto:hello@example.com?subject=Hi%20there")).toBe(true);
  });

  test("rejects mailto: links without a usable recipient", () => {
    expect(isValidEditorLinkUrl("mailto:")).toBe(false);
    expect(isValidEditorLinkUrl("mailto:?subject=Hi")).toBe(false);
    expect(isValidEditorLinkUrl("mailto:hello")).toBe(false);
    expect(isValidEditorLinkUrl("mailto:@example.com")).toBe(false);
    expect(isValidEditorLinkUrl("mailto:hello@")).toBe(false);
    expect(isValidEditorLinkUrl("mailto:a%20b@example.com")).toBe(false);
    expect(isValidEditorLinkUrl("mailto:%E0@example.com")).toBe(false);
    expect(isValidEditorLinkUrl("mailto:hello@example.com%0D%0ABcc:other@example.com")).toBe(false);
    expect(isValidEditorLinkUrl("mailto:hello@example.com%7F")).toBe(false);
  });

  test("rejects script-capable and other schemes", () => {
    expect(isValidEditorLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isValidEditorLinkUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isValidEditorLinkUrl("ftp://example.com")).toBe(false);
    expect(isValidEditorLinkUrl("not a url")).toBe(false);
  });

  test("isMailtoUrl tells mailto: links apart from web links", () => {
    expect(isMailtoUrl("mailto:hello@example.com")).toBe(true);
    expect(isMailtoUrl(" MAILTO:hello@example.com")).toBe(true);
    expect(isMailtoUrl("https://example.com/mailto:x")).toBe(false);
  });
});
