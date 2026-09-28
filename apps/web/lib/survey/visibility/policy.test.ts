import { describe, expect, test } from "vitest";
import { getEffectiveVisibility, getPendingVisibility, isPending } from "./policy";

describe("visibility policy", () => {
  test.each([
    ["settled workspace", "workspace", 1, 1, false, "workspace", null],
    ["settled private", "private", 1, 1, false, "private", null],
    ["pending restriction", "private", 2, 1, true, "private", "private"],
    ["pending grant", "workspace", 2, 1, true, "private", "workspace"],
  ] as const)(
    "%s",
    (_label, visibility, visibilityVersion, visibilityProjectedVersion, pending, effective, queued) => {
      const row = { visibility, visibilityProjectedVersion, visibilityVersion };
      expect(isPending(row)).toBe(pending);
      expect(getEffectiveVisibility(row)).toBe(effective);
      expect(getPendingVisibility(row)).toBe(queued);
    }
  );
});
