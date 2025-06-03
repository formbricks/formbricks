import { Organization, Prisma } from "@prisma/client";
import { Mocked, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationAIKeys, getOrganizationIdFromEnvironmentId } from "./organization";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

// Mock reactCache
vi.mock("react", () => ({
  cache: vi.fn((fn) => fn), // reactCache(fn) returns fn, which is then invoked
}));

const mockPrismaOrganization = prisma.organization as Mocked<typeof prisma.organization>;

describe("getOrganizationIdFromEnvironmentId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore spies and mocks
  });

  test("should return organization ID if found", async () => {
    const mockEnvId = "env_test123";
    const mockOrgId = "org_test456";
    mockPrismaOrganization.findFirst.mockResolvedValueOnce({ id: mockOrgId } as Organization);

    const result = await getOrganizationIdFromEnvironmentId(mockEnvId);

    expect(result).toBe(mockOrgId);
    expect(mockPrismaOrganization.findFirst).toHaveBeenCalledWith({
      where: {
        projects: {
          some: {
            environments: {
              some: { id: mockEnvId },
            },
          },
        },
      },
      select: {
        id: true,
      },
    });
  });

  test("should throw ResourceNotFoundError if organization not found", async () => {
    const mockEnvId = "env_test123_notfound";
    mockPrismaOrganization.findFirst.mockResolvedValueOnce(null);

    await expect(getOrganizationIdFromEnvironmentId(mockEnvId)).rejects.toThrow(ResourceNotFoundError);
    await expect(getOrganizationIdFromEnvironmentId(mockEnvId)).rejects.toThrow("Organization not found");
  });

  test("should propagate prisma error", async () => {
    const mockEnvId = "env_test123_dberror";
    const errorMessage = "Database connection lost";
    mockPrismaOrganization.findFirst.mockRejectedValueOnce(new Error(errorMessage));

    await expect(getOrganizationIdFromEnvironmentId(mockEnvId)).rejects.toThrow(Error);
  });
});

describe("getOrganizationAIKeys", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore spies and mocks
  });

  const mockOrgId = "org_test789";
  const mockOrganizationData: Pick<Organization, "isAIEnabled" | "billing"> = {
    isAIEnabled: true,
    billing: {
      plan: "free",
      stripeCustomerId: null,
      period: "monthly",
      periodStart: new Date(),
      limits: {
        monthly: { responses: null, miu: null },
        projects: null,
      },
    }, // Prisma.JsonValue compatible
  };

  test("should return organization AI keys if found", async () => {
    mockPrismaOrganization.findUnique.mockResolvedValueOnce(
      mockOrganizationData as Organization // Cast to full Organization for mock purposes
    );

    const result = await getOrganizationAIKeys(mockOrgId);

    expect(result).toEqual(mockOrganizationData);
    expect(mockPrismaOrganization.findUnique).toHaveBeenCalledWith({
      where: {
        id: mockOrgId,
      },
      select: {
        isAIEnabled: true,
        billing: true,
      },
    });
  });

  test("should return null if organization not found", async () => {
    mockPrismaOrganization.findUnique.mockResolvedValueOnce(null);

    const result = await getOrganizationAIKeys(mockOrgId);
    expect(result).toBeNull();
  });

  test("should throw DatabaseError on PrismaClientKnownRequestError", async () => {
    const mockErrorMessage = "Unique constraint failed on table";
    const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
      code: PrismaErrorType.UniqueConstraintViolation,
      clientVersion: "0.0.1",
    });

    mockPrismaOrganization.findUnique.mockRejectedValueOnce(errToThrow);
    await expect(getOrganizationAIKeys(mockOrgId)).rejects.toThrow(DatabaseError);
  });

  test("should re-throw other errors from prisma", async () => {
    const errorMessage = "Some other unexpected DB error";
    const genericError = new Error(errorMessage);

    mockPrismaOrganization.findUnique.mockRejectedValueOnce(genericError);
    await expect(getOrganizationAIKeys(mockOrgId)).rejects.toThrow(genericError);
  });
});
