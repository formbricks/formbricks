import { describe, expect, test } from "vitest";
import { getBillingFallbackPath } from "./navigation";

describe("getBillingFallbackPath", () => {
  test("returns billing settings path for cloud", () => {
    const path = getBillingFallbackPath("env_123", true);
    expect(path).toBe("/environments/env_123/settings/billing");
  });

  test("returns enterprise settings path for self-hosted", () => {
    const path = getBillingFallbackPath("env_123", false);
    expect(path).toBe("/environments/env_123/settings/enterprise");
  });
});
