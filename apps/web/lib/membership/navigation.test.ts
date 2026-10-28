import { describe, expect, test } from "vitest";
import { getBillingFallbackPath } from "./navigation";

describe("getBillingFallbackPath", () => {
  test("returns the organization billing page in the account shell", () => {
    expect(getBillingFallbackPath("org_123")).toBe("/organizations/org_123/billing");
  });
});
