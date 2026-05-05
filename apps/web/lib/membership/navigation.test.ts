import { describe, expect, test } from "vitest";
import { getBillingFallbackPath } from "./navigation";

describe("getBillingFallbackPath", () => {
  test("returns billing settings path for cloud", () => {
    const path = getBillingFallbackPath("ws_123", true);
    expect(path).toBe("/workspaces/ws_123/settings/organization/billing");
  });

  test("returns enterprise settings path for self-hosted", () => {
    const path = getBillingFallbackPath("ws_123", false);
    expect(path).toBe("/workspaces/ws_123/settings/organization/enterprise");
  });
});
