import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import * as setupState from "@/lib/instance/setup-state";
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
vi.mock("@/lib/instance/setup-state", () => ({
  readInstanceSetupState: vi.fn(),
  writeInstanceSetupMarker: vi.fn(),
}));

const prismaError = () =>
  new Prisma.PrismaClientKnownRequestError("boom", { code: "P2002", clientVersion: "test" });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(setupState.readInstanceSetupState).mockResolvedValue("fresh");
  vi.mocked(setupState.writeInstanceSetupMarker).mockResolvedValue(undefined);
  prisma.user.findFirst.mockResolvedValue(null);
});

describe("markInstanceSetupCompleted (ENG-7313)", () => {
  test("writes the singleton marker", async () => {
    await markInstanceSetupCompleted();

    expect(setupState.writeInstanceSetupMarker).toHaveBeenCalledTimes(1);
  });

  test("surfaces a Prisma failure as a DatabaseError", async () => {
    vi.mocked(setupState.writeInstanceSetupMarker).mockRejectedValue(prismaError());

    await expect(markInstanceSetupCompleted()).rejects.toThrow(DatabaseError);
  });
});

describe("getIsFreshInstance (ENG-7313)", () => {
  test.each([
    ["marked", false, 0],
    ["fresh", true, 0],
    // A user or an organization without the marker: written now, so deleting them later cannot re-arm.
    ["in-use", false, 1],
  ] as const)(
    "answers a %s instance with %s and writes the marker %i time(s)",
    async (state, fresh, writes) => {
      vi.mocked(setupState.readInstanceSetupState).mockResolvedValue(state);

      await expect(getIsFreshInstance()).resolves.toBe(fresh);
      expect(setupState.writeInstanceSetupMarker).toHaveBeenCalledTimes(writes);
    }
  );

  test("surfaces a Prisma failure as a DatabaseError", async () => {
    vi.mocked(setupState.readInstanceSetupState).mockRejectedValue(prismaError());

    await expect(getIsFreshInstance()).rejects.toThrow(DatabaseError);
  });
});

describe("getIsEligibleFirstOrganizationOwner (ENG-7313)", () => {
  const bootstrapAdminLookup = { where: { isBootstrapAdmin: { not: null } }, select: { id: true } };

  test("only the bootstrap administrator qualifies while that account exists", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "admin" } as never);

    expect(await getIsEligibleFirstOrganizationOwner("admin")).toBe(true);
    expect(await getIsEligibleFirstOrganizationOwner("other")).toBe(false);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(bootstrapAdminLookup);
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(2);
  });

  test("without a bootstrap administrator, the earliest-created user qualifies and no one else", async () => {
    prisma.user.findFirst.mockImplementation((async (args: { where?: unknown }) =>
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
    prisma.user.findFirst.mockRejectedValue(prismaError());

    await expect(getIsEligibleFirstOrganizationOwner("admin")).rejects.toThrow(DatabaseError);
  });
});
