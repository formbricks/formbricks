import { organizationId, projectEnvironments } from "./__mocks__/project.mock";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getAllEnvironmentsFromOrganizationId } from "../project";

vi.mock("@formbricks/database", () => ({
  prisma: {
    project: {
      findMany: vi.fn(),
    },
  },
}));

describe("Project Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("return all environment ids from organization projects", async () => {
    vi.mocked(prisma.project.findMany).mockResolvedValue(projectEnvironments);
    const result = await getAllEnvironmentsFromOrganizationId(organizationId);
    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: { organizationId },
      select: {
        environments: {
          select: { id: true },
        },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(
        projectEnvironments.flatMap((project) => project.environments.map((environment) => environment.id))
      );
    }
  });

  test("return an internal_server_error error if projects are not found", async () => {
    vi.mocked(prisma.project.findMany).mockRejectedValue(new Error("Internal server error"));
    const result = await getAllEnvironmentsFromOrganizationId(organizationId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        type: "internal_server_error",
        details: [{ field: "project", issue: "Internal server error" }],
      });
    }
  });
});
