import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TOrganizationBilling } from "@formbricks/types/organizations";
import { getOrganizationBillingByEnvironmentId } from "./organization";

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("getOrganizationBillingByEnvironmentId", () => {
  const environmentId = "env-123";
  const mockBillingData: TOrganizationBilling = {
    limits: {
      monthly: { miu: 0, responses: 0 },
      projects: 3,
    },
    periodStart: new Date(),
    stripeCustomerId: "mock-stripe-customer-id",
  };

  test("returns billing when organization is found", async () => {
    vi.mocked(prisma.organization.findFirst).mockResolvedValue({ billing: mockBillingData } as any);
    const result = await getOrganizationBillingByEnvironmentId(environmentId);
    expect(result).toEqual(mockBillingData);
    expect(prisma.organization.findFirst).toHaveBeenCalledWith({
      where: {
        projects: {
          some: {
            environments: {
              some: {
                id: environmentId,
              },
            },
          },
        },
      },
      select: {
        billing: {
          select: {
            stripeCustomerId: true,
            limits: true,
            periodStart: true,
            stripe: true,
          },
        },
      },
    });
  });

  test("returns null when organization is not found", async () => {
    vi.mocked(prisma.organization.findFirst).mockResolvedValueOnce(null);
    const result = await getOrganizationBillingByEnvironmentId(environmentId);
    expect(result).toBeNull();
  });

  test("logs error and returns null on exception", async () => {
    const error = new Error("db error");
    vi.mocked(prisma.organization.findFirst).mockRejectedValueOnce(error);
    const result = await getOrganizationBillingByEnvironmentId(environmentId);
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(error, "Failed to get organization billing by environment ID");
  });
});
