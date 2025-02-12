import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getAllEnvironmentsFromOrganizationId } from "../project";

describe("Project Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return all environment ids from organization projects", async () => {
    const organizationId = "org_1";
    const projectEnvironments = [
      { environments: [{ id: "env1" }, { id: "env2" }] },
      { environments: [{ id: "env3" }] },
    ];

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
      expect(result.data).toEqual(["env1", "env2", "env3"]);
    }
  });
});
