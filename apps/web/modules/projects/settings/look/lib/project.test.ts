import { Prisma, Project } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getProjectByEnvironmentId } from "./project";

vi.mock("@/lib/cache", () => ({ cache: (fn: any) => fn }));
vi.mock("@/lib/project/cache", () => ({
  projectCache: { tag: { byEnvironmentId: vi.fn(() => "env-tag") } },
}));
vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));
vi.mock("react", () => ({ cache: (fn: any) => fn }));
vi.mock("@formbricks/database", () => ({ prisma: { project: { findFirst: vi.fn() } } }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));

const baseProject: Project = {
  id: "p1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Project 1",
  organizationId: "org1",
  styling: { allowStyleOverwrite: true } as any,
  recontactDays: 0,
  inAppSurveyBranding: false,
  linkSurveyBranding: false,
  config: { channel: null, industry: null } as any,
  placement: "bottomRight",
  clickOutsideClose: false,
  darkOverlay: false,
  logo: null,
  brandColor: null,
  highlightBorderColor: null,
};

describe("getProjectByEnvironmentId", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns project when found", async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce(baseProject);
    const result = await getProjectByEnvironmentId("env1");
    expect(result).toEqual(baseProject);
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { environments: { some: { id: "env1" } } },
    });
  });

  test("returns null when not found", async () => {
    vi.mocked(prisma.project.findFirst).mockResolvedValueOnce(null);
    const result = await getProjectByEnvironmentId("env1");
    expect(result).toBeNull();
  });

  test("throws DatabaseError on Prisma error", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" });
    vi.mocked(prisma.project.findFirst).mockRejectedValueOnce(error);
    await expect(getProjectByEnvironmentId("env1")).rejects.toThrow(DatabaseError);
  });

  test("throws unknown error", async () => {
    vi.mocked(prisma.project.findFirst).mockRejectedValueOnce(new Error("fail"));
    await expect(getProjectByEnvironmentId("env1")).rejects.toThrow("fail");
  });
});
