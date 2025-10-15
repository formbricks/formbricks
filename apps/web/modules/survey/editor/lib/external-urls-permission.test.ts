import { describe, expect, test, vi } from "vitest";
import { getExternalUrlsPermission } from "./external-urls-permission";

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: true,
  PROJECT_FEATURE_KEYS: {
    FREE: "free",
    PRO: "pro",
    ENTERPRISE: "enterprise",
    SCALE: "scale",
  },
}));

describe("getExternalUrlsPermission - Formbricks Cloud", () => {
  test("should return false for free plan in Formbricks Cloud", async () => {
    const result = await getExternalUrlsPermission("free");
    expect(result).toBe(false);
  });

  test("should return true for pro plan in Formbricks Cloud", async () => {
    const result = await getExternalUrlsPermission("pro");
    expect(result).toBe(true);
  });

  test("should return true for enterprise plan in Formbricks Cloud", async () => {
    const result = await getExternalUrlsPermission("enterprise");
    expect(result).toBe(true);
  });

  test("should return true for scale plan in Formbricks Cloud", async () => {
    const result = await getExternalUrlsPermission("scale");
    expect(result).toBe(true);
  });

  test("should return true for any non-free plan string in Formbricks Cloud", async () => {
    const result = await getExternalUrlsPermission("custom-plan");
    expect(result).toBe(true);
  });
});

