import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import {
  getIsEligibleFirstOrganizationOwner,
  getIsFreshInstance,
  markInstanceSetupCompleted,
} from "./service";

vi.mock("server-only", () => ({}));
// The service caches through React's `cache` in the app; identity here makes each call observable.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: (fn: unknown) => fn,
}));
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
  vi.mocked(prisma.instanceSetup.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.instanceSetup.upsert).mockResolvedValue({
    id: "instance",
    completedAt: new Date(),
  });
  vi.mocked(prisma.user.count).mockResolvedValue(0);
  vi.mocked(prisma.organization.count).mockResolvedValue(0);
  vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
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

describe("getIsFreshInstance (ENG-7313)", () => {
  test("a marker answers without counting users or organizations", async () => {
    vi.mocked(prisma.instanceSetup.findUnique).mockResolvedValue({
      id: "instance",
      completedAt: new Date(),
    });

    await expect(getIsFreshInstance()).resolves.toBe(false);
    expect(prisma.user.count).not.toHaveBeenCalled();
    expect(prisma.organization.count).not.toHaveBeenCalled();
  });

  test("an empty instance with no marker is fresh and stays unmarked", async () => {
    await expect(getIsFreshInstance()).resolves.toBe(true);
    expect(prisma.user.count).toHaveBeenCalledTimes(1);
    expect(prisma.organization.count).toHaveBeenCalledTimes(1);
    expect(prisma.instanceSetup.upsert).not.toHaveBeenCalled();
  });

  test("a user marks the instance set up", async () => {
    vi.mocked(prisma.user.count).mockResolvedValue(1);

    await expect(getIsFreshInstance()).resolves.toBe(false);
    expect(prisma.instanceSetup.upsert).toHaveBeenCalledTimes(1);
  });

  // The fallback for a database built with `db:push` or restored from before the migration: an
  // organization without users is still not a fresh instance.
  test("an organization without users marks the instance set up", async () => {
    vi.mocked(prisma.organization.count).mockResolvedValue(1);

    await expect(getIsFreshInstance()).resolves.toBe(false);
    expect(prisma.instanceSetup.upsert).toHaveBeenCalledTimes(1);
  });

  test("surfaces a Prisma failure as a DatabaseError", async () => {
    vi.mocked(prisma.instanceSetup.findUnique).mockRejectedValue(prismaError());

    await expect(getIsFreshInstance()).rejects.toThrow(DatabaseError);
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
    expect(await getIsEligibleFirstOrganizationOwner("ghost")).toBe(false);
  });

  test("surfaces a Prisma failure as a DatabaseError", async () => {
    vi.mocked(prisma.user.findFirst).mockRejectedValue(prismaError());

    await expect(getIsEligibleFirstOrganizationOwner("admin")).rejects.toThrow(DatabaseError);
  });
});
