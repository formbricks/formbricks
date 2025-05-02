import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";
import { Organization } from "@prisma/client";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { checkSpamProtectionPermission } from "./permission";

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsSpamProtectionEnabled: vi.fn(),
}));

vi.mock("@/modules/survey/lib/survey", () => ({
  getOrganizationBilling: vi.fn(),
}));

describe("checkSpamProtectionPermission", () => {
  const mockOrganizationId = "mock-organization-id";
  const mockBillingData: Organization["billing"] = {
    limits: {
      monthly: { miu: 0, responses: 0 },
      projects: 3,
    },
    period: "monthly",
    periodStart: new Date(),
    plan: "scale",
    stripeCustomerId: "mock-stripe-customer-id",
  };

  afterEach(() => {
    cleanup();
  });

  test("throws ResourceNotFoundError if organization is not found", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(null);
    await expect(checkSpamProtectionPermission(mockOrganizationId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("resolves if spam protection is enabled", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockBillingData);
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(true);
    await expect(checkSpamProtectionPermission(mockOrganizationId)).resolves.toBeUndefined();
  });

  test("throws OperationNotAllowedError if spam protection is not enabled", async () => {
    vi.mocked(getOrganizationBilling).mockResolvedValue(mockBillingData);
    vi.mocked(getIsSpamProtectionEnabled).mockResolvedValue(false);
    await expect(checkSpamProtectionPermission(mockOrganizationId)).rejects.toThrow(OperationNotAllowedError);
    await expect(checkSpamProtectionPermission(mockOrganizationId)).rejects.toThrow(
      "Spam protection is not enabled for this organization"
    );
  });
});
