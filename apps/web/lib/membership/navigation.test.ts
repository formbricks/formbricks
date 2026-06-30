import { describe, expect, test } from "vitest";
import { getBillingFallbackPath } from "./navigation";

describe("getBillingFallbackPath", () => {
  test("returns billing settings path for cloud", () => {
    const path = getBillingFallbackPath("org_123", true);
    expect(path).toBe("/organizations/org_123/settings/billing");
  });

  test("returns enterprise settings path for self-hosted", () => {
    const path = getBillingFallbackPath("org_123", false);
    expect(path).toBe("/organizations/org_123/settings/enterprise");
  });
});
