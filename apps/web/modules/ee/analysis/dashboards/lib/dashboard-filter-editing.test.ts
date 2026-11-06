import { describe, expect, test } from "vitest";
import { formatFilterLabels } from "./dashboard-filter-editing";

describe("formatFilterLabels", () => {
  test("joins filter labels as the app's language lists them", () => {
    expect(formatFilterLabels(["Plan"], "en-US")).toBe("Plan");
    expect(formatFilterLabels(["Plan", "Tier"], "en-US")).toBe("Plan and Tier");
    expect(formatFilterLabels(["Plan", "Tier", "Region"], "en-US")).toBe("Plan, Tier, and Region");
    expect(formatFilterLabels(["Plan", "Tier"], "de-DE")).toBe("Plan und Tier");
  });
});
