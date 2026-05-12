import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getEnvironmentIdsByOrganizationId } from "./environment";

vi.mock("@formbricks/database", () => ({
  prisma: {
    environment: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

describe("getEnvironmentIdsByOrganizationId", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("returns environment IDs for all projects in an organization", async () => {
    vi.mocked(prisma.environment.findMany).mockResolvedValue([{ id: "env-1" }, { id: "env-2" }] as any);

    const result = await getEnvironmentIdsByOrganizationId("clh6pzwx90000e9ogjr0mf7so");

    expect(result).toEqual(["env-1", "env-2"]);
    expect(prisma.environment.findMany).toHaveBeenCalledWith({
      where: {
        project: {
          organizationId: "clh6pzwx90000e9ogjr0mf7so",
        },
      },
      select: {
        id: true,
      },
    });
  });

  test("returns an empty list when the organization has no environments", async () => {
    vi.mocked(prisma.environment.findMany).mockResolvedValue([]);

    const result = await getEnvironmentIdsByOrganizationId("clh6pzwx90000e9ogjr0mf7so");

    expect(result).toEqual([]);
  });

  test("throws DatabaseError for known Prisma errors", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.environment.findMany).mockRejectedValue(prismaError);

    await expect(getEnvironmentIdsByOrganizationId("clh6pzwx90000e9ogjr0mf7so")).rejects.toThrow(
      DatabaseError
    );
  });

  test("rethrows unknown errors", async () => {
    const error = new Error("boom");
    vi.mocked(prisma.environment.findMany).mockRejectedValue(error);

    await expect(getEnvironmentIdsByOrganizationId("clh6pzwx90000e9ogjr0mf7so")).rejects.toThrow(error);
  });
});
