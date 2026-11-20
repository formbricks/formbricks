import { describe, expect, test } from "vitest";
import { isMobileFriendlyPath } from "./mobile-friendly-paths";

describe("isMobileFriendlyPath", () => {
  test("lets the attachment export page an email links to show on a phone", () => {
    expect(isMobileFriendlyPath("/attachment-exports/clh1abcd0000xyz")).toBe(true);
  });

  test("keeps the overlay on the desktop-only app pages", () => {
    expect(isMobileFriendlyPath("/workspaces/clseedworkspace000000000/surveys")).toBe(false);
    expect(isMobileFriendlyPath("/account/settings/notifications")).toBe(false);
    expect(isMobileFriendlyPath("/organizations/org1/settings/general")).toBe(false);
  });

  test("matches the pages below a prefix, not the bare prefix or a look-alike", () => {
    expect(isMobileFriendlyPath("/attachment-exports")).toBe(false);
    expect(isMobileFriendlyPath("/attachment-exports/")).toBe(false);
    expect(isMobileFriendlyPath("/attachment-exports-archive/abc")).toBe(false);
  });

  test("keeps the overlay when the path is not known yet", () => {
    expect(isMobileFriendlyPath(null)).toBe(false);
  });
});
