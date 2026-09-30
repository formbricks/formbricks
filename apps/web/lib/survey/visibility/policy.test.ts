import { describe, expect, test } from "vitest";
import { getEffectiveVisibility, getPendingVisibility, isPending } from "./policy";

describe("visibility policy", () => {
  test.each([
    ["settled workspace", "workspace", 1, 1, false, "workspace", null],
    ["settled restricted", "restricted", 1, 1, false, "restricted", null],
    ["pending restriction", "restricted", 2, 1, true, "restricted", "restricted"],
    ["pending grant", "workspace", 2, 1, true, "restricted", "workspace"],
    // No projection acknowledged yet (just created or copied): the stored value is enforced.
    ["never-projected workspace", "workspace", 1, 0, true, "workspace", "workspace"],
    ["never-projected restricted", "restricted", 1, 0, true, "restricted", "restricted"],
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
