import { Organization, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getFirstOrganization } from "./organization";

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findFirst: vi.fn(),
    },
  },
}));
vi.mock("@/lib/cache", () => ({
  cache: (fn: any) => fn,
}));
vi.mock("react", () => ({
  cache: (fn: any) => fn,
}));

describe("getFirstOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the first organization when found", async () => {
    const org: Organization = {
      id: "org-1",
      name: "Test Org",
      createdAt: new Date(),
      whitelabel: true,
      updatedAt: new Date(),
      billing: {
        plan: "free",
        period: "monthly",
        periodStart: new Date(),
        stripeCustomerId: "cus_123",
        limits: {
          monthly: {
            miu: 100,
            responses: 1000,
          },
          projects: 3,
        },
      },
      isAIEnabled: false,
    };
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(org);
    const result = await getFirstOrganization();
    expect(result).toEqual(org);
    expect(prisma.organization.findFirst).toHaveBeenCalledWith({});
  });

  test("returns null if no organization is found", async () => {
    vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);
    const result = await getFirstOrganization();
    expect(result).toBeNull();
  });

  test("throws DatabaseError on PrismaClientKnownRequestError", async () => {
    const error = new Prisma.PrismaClientKnownRequestError("fail", { code: "P2002", clientVersion: "1.0.0" });
    vi.mocked(prisma.organization.findFirst).mockRejectedValue(error);
    await expect(getFirstOrganization()).rejects.toThrow(DatabaseError);
  });

  test("throws unknown error if not PrismaClientKnownRequestError", async () => {
    const error = new Error("unexpected");
    vi.mocked(prisma.organization.findFirst).mockRejectedValue(error);
    await expect(getFirstOrganization()).rejects.toThrow("unexpected");
  });
});
