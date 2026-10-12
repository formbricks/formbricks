import { describe, expect, test } from "vitest";
import { getEffectiveVisibility, getPendingVisibility, isPending } from "./policy";

describe("visibility policy", () => {
  test.each([
    ["settled workspace", "workspace", 1, 1, false, "workspace", null],
    ["settled restricted", "restricted", 1, 1, false, "restricted", null],
    ["pending restriction", "restricted", 2, 1, true, "restricted", "restricted"],
    ["pending grant", "workspace", 2, 1, true, "restricted", "workspace"],
    // Pre-migration surveys: settled at 0/0, and their first change is a real pending restriction.
    ["pre-migration survey", "workspace", 0, 0, false, "workspace", null],
    ["pre-migration survey's first restriction", "restricted", 1, 0, true, "restricted", "restricted"],
    // The initial projection (just created or copied): not pending, and the stored value is enforced.
    ["initial projection, workspace", "workspace", 0, -1, false, "workspace", null],
    ["initial projection, restricted", "restricted", 0, -1, false, "restricted", null],
    // Changed before the first acknowledgement: a real transition, pending as usual.
    ["restricted before the first acknowledgement", "restricted", 1, -1, true, "restricted", "restricted"],
    [
      "cancelled back to workspace before the first acknowledgement",
      "workspace",
      2,
      -1,
      true,
      "restricted",
      "workspace",
    ],
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
