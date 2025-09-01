import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import {
  getOrganizationBilling,
  getOrganizationIdFromEnvironmentId,
} from "@/modules/api/v2/management/responses/lib/organization";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { checkQuotasEnabledV1, checkQuotasEnabledV2 } from "./helpers";

// Mock dependencies
vi.mock("@/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: vi.fn(),
}));

vi.mock("@/modules/api/v2/management/responses/lib/organization", () => ({
  getOrganizationIdFromEnvironmentId: vi.fn(),
  getOrganizationBilling: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsQuotasEnabled: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("Quota Helpers", () => {
  const mockEnvironmentId = "env123";
  const mockOrganizationId = "org456";

  const mockOrganization = {
    id: mockOrganizationId,
    name: "Test Organization",
    billing: {
      plan: "scale",
      subscriptionId: "sub123",
    },
  };

  beforeEach(() => {
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(mockOrganization as any);
    vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue({ ok: true, data: mockOrganizationId });
    vi.mocked(getOrganizationBilling).mockResolvedValue({
      ok: true,
      data: { plan: "scale", subscriptionId: "sub123" },
    });
    vi.mocked(getIsQuotasEnabled).mockResolvedValue(true);
    vi.mocked(logger.error).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("checkQuotasEnabledV1", () => {
    test("should return true when quotas are enabled", async () => {
      const result = await checkQuotasEnabledV1(mockEnvironmentId);

      expect(result).toBe(true);
      expect(getOrganizationByEnvironmentId).toHaveBeenCalledWith(mockEnvironmentId);
      expect(getIsQuotasEnabled).toHaveBeenCalledWith("scale");
    });

    test("should return false when quotas are disabled", async () => {
      vi.mocked(getIsQuotasEnabled).mockResolvedValue(false);

      const result = await checkQuotasEnabledV1(mockEnvironmentId);

      expect(result).toBe(false);
      expect(getOrganizationByEnvironmentId).toHaveBeenCalledWith(mockEnvironmentId);
      expect(getIsQuotasEnabled).toHaveBeenCalledWith("scale");
    });

    test("should return false when organization is not found", async () => {
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue(null);

      const result = await checkQuotasEnabledV1(mockEnvironmentId);

      expect(result).toBe(false);
      expect(getOrganizationByEnvironmentId).toHaveBeenCalledWith(mockEnvironmentId);
      expect(getIsQuotasEnabled).not.toHaveBeenCalled();
    });

    test("should return false and log error when getOrganizationByEnvironmentId throws", async () => {
      const error = new Error("Database connection failed");
      vi.mocked(getOrganizationByEnvironmentId).mockRejectedValue(error);

      const result = await checkQuotasEnabledV1(mockEnvironmentId);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        { error, environmentId: mockEnvironmentId },
        "Error checking quotas enabled in v1"
      );
    });
  });

  describe("checkQuotasEnabledV2", () => {
    test("should return true when quotas are enabled", async () => {
      const result = await checkQuotasEnabledV2(mockEnvironmentId);

      expect(result).toBe(true);
      expect(getOrganizationIdFromEnvironmentId).toHaveBeenCalledWith(mockEnvironmentId);
      expect(getOrganizationBilling).toHaveBeenCalledWith(mockOrganizationId);
      expect(getIsQuotasEnabled).toHaveBeenCalledWith("scale");
    });

    test("should return false when quotas are disabled", async () => {
      vi.mocked(getIsQuotasEnabled).mockResolvedValue(false);

      const result = await checkQuotasEnabledV2(mockEnvironmentId);

      expect(result).toBe(false);
      expect(getOrganizationIdFromEnvironmentId).toHaveBeenCalledWith(mockEnvironmentId);
      expect(getOrganizationBilling).toHaveBeenCalledWith(mockOrganizationId);
      expect(getIsQuotasEnabled).toHaveBeenCalledWith("scale");
    });

    test("should return false when getOrganizationIdFromEnvironmentId returns not ok", async () => {
      vi.mocked(getOrganizationIdFromEnvironmentId).mockResolvedValue({
        ok: false,
        error: "Environment not found",
      });

      const result = await checkQuotasEnabledV2(mockEnvironmentId);

      expect(result).toBe(false);
      expect(getOrganizationIdFromEnvironmentId).toHaveBeenCalledWith(mockEnvironmentId);
      expect(getOrganizationBilling).not.toHaveBeenCalled();
      expect(getIsQuotasEnabled).not.toHaveBeenCalled();
    });

    test("should return false when getOrganizationBilling returns not ok", async () => {
      vi.mocked(getOrganizationBilling).mockResolvedValue({
        ok: false,
        error: "Billing not found",
      });

      const result = await checkQuotasEnabledV2(mockEnvironmentId);

      expect(result).toBe(false);
      expect(getOrganizationIdFromEnvironmentId).toHaveBeenCalledWith(mockEnvironmentId);
      expect(getOrganizationBilling).toHaveBeenCalledWith(mockOrganizationId);
      expect(getIsQuotasEnabled).not.toHaveBeenCalled();
    });
  });
});
