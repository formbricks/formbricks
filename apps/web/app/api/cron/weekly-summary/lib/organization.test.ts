import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getOrganizationIds } from "./organization";

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findMany: vi.fn(),
    },
  },
}));

describe("Organization", () => {
  afterEach(() => {
    cleanup();
  });

  test("getOrganizationIds should return an array of organization IDs when the database contains multiple organizations", async () => {
    const mockOrganizations = [{ id: "org1" }, { id: "org2" }, { id: "org3" }];

    vi.mocked(prisma.organization.findMany).mockResolvedValue(mockOrganizations);

    const organizationIds = await getOrganizationIds();

    expect(organizationIds).toEqual(["org1", "org2", "org3"]);
    expect(prisma.organization.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.organization.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
      },
    });
  });

  test("getOrganizationIds should return an empty array when the database contains no organizations", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValue([]);

    const organizationIds = await getOrganizationIds();

    expect(organizationIds).toEqual([]);
    expect(prisma.organization.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.organization.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
      },
    });
  });
});
