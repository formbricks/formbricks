import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getWorkspace, getWorkspaceLanguages } from "./workspace";

vi.mock("@formbricks/database", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
  },
}));

const mockWorkspace = {
  id: "testWorkspaceId",
  name: "Test Workspace",
  createdAt: new Date(),
  updatedAt: new Date(),
  environments: [],
  surveys: [],
  actionClasses: [],
  attributeClasses: [],
  memberships: [],
  languages: [
    { id: "lang1", code: "en", name: "English" },
    { id: "lang2", code: "es", name: "Spanish" },
  ],
  recontactDays: 0,
  strictTargeting: false,
  waitingPeriod: 0,
  surveyPaused: false,
  inAppSurveyBranding: false,
  linkSurveyBranding: false,
  teamId: "team1",
  productOverwrites: null,
  styling: {},
  variables: [],
  verifyOwnership: false,
  billing: {
    subscriptionStatus: "active",
    stripeCustomerId: "cus_123",
    features: {
      ai: {
        status: "active",
        responses: 100,
        unlimited: false,
      },
    },
  },
};

describe("getWorkspace", () => {
  test("should return workspace when found", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
      mockWorkspace as unknown as Awaited<ReturnType<typeof prisma.workspace.findUnique>>
    );
    const workspace = await getWorkspace("testWorkspaceId");
    expect(workspace).toEqual(mockWorkspace);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: "testWorkspaceId" },
    });
  });

  test("should return null when workspace not found", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);
    const workspace = await getWorkspace("nonExistentWorkspaceId");
    expect(workspace).toBeNull();
  });

  test("should throw DatabaseError on Prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Error", {
      code: "P2001",
      clientVersion: "test",
    });
    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(prismaError);
    await expect(getWorkspace("testWorkspaceId")).rejects.toThrow(DatabaseError);
  });

  test("should rethrow unknown error", async () => {
    const unknownError = new Error("Unknown error");
    vi.mocked(prisma.workspace.findUnique).mockRejectedValue(unknownError);
    await expect(getWorkspace("testWorkspaceId")).rejects.toThrow(unknownError);
  });
});

describe("getWorkspaceLanguages", () => {
  test("should return workspace languages when workspace found", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      languages: mockWorkspace.languages,
    } as unknown as Awaited<ReturnType<typeof prisma.workspace.findUnique>>);
    const languages = await getWorkspaceLanguages("testWorkspaceId");
    expect(languages).toEqual(mockWorkspace.languages);
    expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
      where: { id: "testWorkspaceId" },
      select: {
        languages: {
          orderBy: {
            code: "asc",
          },
        },
      },
    });
  });

  test("should throw ResourceNotFoundError when workspace not found", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);
    await expect(getWorkspaceLanguages("nonExistentWorkspaceId")).rejects.toThrow(ResourceNotFoundError);
  });
});
