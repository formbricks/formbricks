import { describe, expect, test } from "vitest";
import { skipReason } from "./tiers.ts";

describe("skipReason", () => {
  test("runs everything when nothing failed", () => {
    expect(skipReason("survey-loop", [])).toBeUndefined();
  });

  test("infra failing skips every later tier", () => {
    for (const tier of ["auth", "survey-loop", "storage", "sdk"] as const) {
      expect(skipReason(tier, ["infra"])).toBe("skipped: infra failed");
    }
  });

  test("auth failing skips the tiers that need a key but not infra", () => {
    expect(skipReason("infra", ["auth"])).toBeUndefined();
    expect(skipReason("survey-loop", ["auth"])).toBe("skipped: auth failed");
  });

  test("a storage failure does not hide the SDK result", () => {
    expect(skipReason("sdk", ["storage"])).toBeUndefined();
    expect(skipReason("survey-loop", ["storage"])).toBeUndefined();
  });

  test("names the earliest blocking tier", () => {
    expect(skipReason("storage", ["auth", "infra"])).toBe("skipped: infra failed");
  });
});
