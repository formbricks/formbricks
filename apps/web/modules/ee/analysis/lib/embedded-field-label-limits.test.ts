import { describe, expect, test } from "vitest";
import {
  getEmbeddedFieldDisplayName,
  isStorableEmbeddedFieldLabel,
  normalizeEmbeddedFieldLabel,
} from "./embedded-field-label-limits";

describe("normalizeEmbeddedFieldLabel", () => {
  test("trims the name", () => {
    expect(normalizeEmbeddedFieldLabel("plan", "  Subscription plan ")).toBe("Subscription plan");
  });

  test("clears the name when it is empty or the key itself", () => {
    expect(normalizeEmbeddedFieldLabel("plan", "")).toBeNull();
    expect(normalizeEmbeddedFieldLabel("plan", "   ")).toBeNull();
    expect(normalizeEmbeddedFieldLabel("plan", " plan ")).toBeNull();
  });

  test("keeps a name that differs from the key only in case", () => {
    expect(normalizeEmbeddedFieldLabel("plan", "Plan")).toBe("Plan");
  });
});

describe("isStorableEmbeddedFieldLabel", () => {
  test("refuses control characters, NUL included", () => {
    expect(isStorableEmbeddedFieldLabel("Plan\u0000")).toBe(false);
    expect(isStorableEmbeddedFieldLabel("Plan\nTier")).toBe(false);
    expect(isStorableEmbeddedFieldLabel("Plan · Tier 区域")).toBe(true);
  });
});

describe("getEmbeddedFieldDisplayName", () => {
  test("shows the workspace's name, else the key", () => {
    expect(getEmbeddedFieldDisplayName({ key: "plan", label: "Subscription plan" })).toBe(
      "Subscription plan"
    );
    expect(getEmbeddedFieldDisplayName({ key: "plan" })).toBe("plan");
  });
});
