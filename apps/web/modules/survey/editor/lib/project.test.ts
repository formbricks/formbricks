import { Prisma } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getProject, getProjectLanguages } from "./project";

vi.mock("@formbricks/database", () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
  },
}));

const mockProject = {
  id: "testProjectId",
  name: "Test Project",
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

describe("getProject", () => {
  test("should return project when found", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue(mockProject);
    const project = await getProject("testProjectId");
    expect(project).toEqual(mockProject);
    expect(prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: "testProjectId" },
    });
  });

  test("should return null when project not found", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
    const project = await getProject("nonExistentProjectId");
    expect(project).toBeNull();
  });

  test("should throw DatabaseError on Prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Error", {
      code: "P2001",
      clientVersion: "test",
    });
    vi.mocked(prisma.project.findUnique).mockRejectedValue(prismaError);
    await expect(getProject("testProjectId")).rejects.toThrow(DatabaseError);
  });

  test("should rethrow unknown error", async () => {
    const unknownError = new Error("Unknown error");
    vi.mocked(prisma.project.findUnique).mockRejectedValue(unknownError);
    await expect(getProject("testProjectId")).rejects.toThrow(unknownError);
  });
});

describe("getProjectLanguages", () => {
  test("should return project languages when project found", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      languages: mockProject.languages,
    });
    const languages = await getProjectLanguages("testProjectId");
    expect(languages).toEqual(mockProject.languages);
    expect(prisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: "testProjectId" },
      select: { languages: true },
    });
  });

  test("should throw ResourceNotFoundError when project not found", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue(null);
    await expect(getProjectLanguages("nonExistentProjectId")).rejects.toThrow(ResourceNotFoundError);
  });
});
