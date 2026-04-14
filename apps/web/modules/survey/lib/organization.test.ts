import { Prisma } from "@prisma/client";
import { Mocked, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TOrganizationBilling } from "@formbricks/types/organizations";
import { getOrganizationAIKeys, getOrganizationIdFromWorkspaceId } from "./organization";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock reactCache
vi.mock("react", () => ({
  cache: vi.fn((fn) => fn), // reactCache(fn) returns fn, which is then invoked
}));

const mockPrismaWorkspace = prisma.workspace as Mocked<typeof prisma.workspace>;
const mockPrismaOrganization = prisma.organization as Mocked<typeof prisma.organization>;

describe("getOrganizationIdFromWorkspaceId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Restore spies and mocks
  });

  test("should return organization ID if found", async () => {
    const mockWorkspaceId = "ws_test123";
    const mockOrgId = "org_test456";
    mockPrismaWorkspace.findUnique.mockResolvedValueOnce({ organizationId: mockOrgId } as any);

    const result = await getOrganizationIdFromWorkspaceId(mockWorkspaceId);

    expect(result).toBe(mockOrgId);
    expect(mockPrismaWorkspace.findUnique).toHaveBeenCalledWith({
      where: { id: mockWorkspaceId },
      select: { organizationId: true },
    });
  });

  test("should throw ResourceNotFoundError if workspace not found", async () => {
    const mockWorkspaceId = "ws_test123_notfound";
    mockPrismaWorkspace.findUnique.mockResolvedValueOnce(null);

    await expect(getOrganizationIdFromWorkspaceId(mockWorkspaceId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should propagate prisma error", async () => {
    const mockWorkspaceId = "ws_test123_dberror";
    const errorMessage = "Database connection lost";
    mockPrismaWorkspace.findUnique.mockRejectedValueOnce(new Error(errorMessage));

    await expect(getOrganizationIdFromWorkspaceId(mockWorkspaceId)).rejects.toThrow(Error);
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
  const mockOrganizationData: {
    isAISmartToolsEnabled: boolean;
    isAIDataAnalysisEnabled: boolean;
    billing: TOrganizationBilling;
  } = {
    isAISmartToolsEnabled: true,
    isAIDataAnalysisEnabled: true,
    billing: {
      stripeCustomerId: null,
      usageCycleAnchor: new Date(),
      limits: {
        monthly: { responses: null },
        workspaces: null,
      },
    }, // Prisma.JsonValue compatible
  };

  test("should return organization AI keys if found", async () => {
    mockPrismaOrganization.findUnique.mockResolvedValueOnce(mockOrganizationData as any);

    const result = await getOrganizationAIKeys(mockOrgId);

    expect(result).toEqual(mockOrganizationData);
    expect(mockPrismaOrganization.findUnique).toHaveBeenCalledWith({
      where: {
        id: mockOrgId,
      },
      select: {
        isAISmartToolsEnabled: true,
        isAIDataAnalysisEnabled: true,
        billing: {
          select: {
            stripeCustomerId: true,
            limits: true,
            usageCycleAnchor: true,
            stripe: true,
          },
        },
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
