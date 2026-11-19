import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { getIsEligibleFirstOrganizationOwner, markInstanceSetupCompleted } from "./service";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    instanceSetup: { upsert: vi.fn(), findUnique: vi.fn() },
    user: { findFirst: vi.fn(), count: vi.fn() },
    organization: { count: vi.fn() },
  },
}));

const prismaError = () =>
  new Prisma.PrismaClientKnownRequestError("boom", { code: "P2002", clientVersion: "test" });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("markInstanceSetupCompleted (ENG-7313)", () => {
  test("upserts the singleton marker", async () => {
    await markInstanceSetupCompleted();

    expect(prisma.instanceSetup.upsert).toHaveBeenCalledWith({
      where: { id: "instance" },
      create: { id: "instance" },
      update: {},
    });
  });

  test("surfaces a Prisma failure as a DatabaseError", async () => {
    vi.mocked(prisma.instanceSetup.upsert).mockRejectedValue(prismaError());

    await expect(markInstanceSetupCompleted()).rejects.toThrow(DatabaseError);
  });
});

describe("getIsEligibleFirstOrganizationOwner (ENG-7313)", () => {
  const bootstrapAdminLookup = { where: { isBootstrapAdmin: { not: null } }, select: { id: true } };

  test("only the bootstrap administrator qualifies while that account exists", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "admin" } as never);

    expect(await getIsEligibleFirstOrganizationOwner("admin")).toBe(true);
    expect(await getIsEligibleFirstOrganizationOwner("other")).toBe(false);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(bootstrapAdminLookup);
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(2);
  });

  test("without a bootstrap administrator, the earliest-created user qualifies and no one else", async () => {
    vi.mocked(prisma.user.findFirst).mockImplementation((async (args: { where?: unknown }) =>
      args.where ? null : { id: "first" }) as never);

    expect(await getIsEligibleFirstOrganizationOwner("first")).toBe(true);
    expect(await getIsEligibleFirstOrganizationOwner("later")).toBe(false);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
  });

  test("an instance with no users has no eligible owner", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    expect(await getIsEligibleFirstOrganizationOwner("ghost")).toBe(false);
  });

  test("surfaces a Prisma failure as a DatabaseError", async () => {
    vi.mocked(prisma.user.findFirst).mockRejectedValue(prismaError());

    await expect(getIsEligibleFirstOrganizationOwner("admin")).rejects.toThrow(DatabaseError);
  });
});
