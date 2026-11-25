import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { readInstanceSetupState, writeInstanceSetupMarker } from "./setup-state";

vi.mock("@formbricks/database", () => ({
  prisma: {
    instanceSetup: { findUnique: vi.fn(), createMany: vi.fn() },
    user: { findFirst: vi.fn() },
    organization: { findFirst: vi.fn() },
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.instanceSetup.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);
});

describe("readInstanceSetupState (ENG-7313)", () => {
  test("is fresh with no marker, no user and no organization", async () => {
    await expect(readInstanceSetupState()).resolves.toBe("fresh");
  });

  test("a marker answers alone, without looking for users or organizations", async () => {
    vi.mocked(prisma.instanceSetup.findUnique).mockResolvedValue({ id: "instance" } as never);

    await expect(readInstanceSetupState()).resolves.toBe("marked");
    expect(prisma.instanceSetup.findUnique).toHaveBeenCalledWith({
      where: { id: "instance" },
      select: { id: true },
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  test("a user without a marker is in use, before organizations are looked at", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "user_1" } as never);

    await expect(readInstanceSetupState()).resolves.toBe("in-use");
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  // A database built with `db:push` or restored from before the migration: an organization without
  // users is not a fresh instance either.
  test("an organization without users or a marker is in use", async () => {
    vi.mocked(prisma.organization.findFirst).mockResolvedValue({ id: "org_1" } as never);

    await expect(readInstanceSetupState()).resolves.toBe("in-use");
  });
});

describe("writeInstanceSetupMarker (ENG-7313)", () => {
  test("inserts the singleton and skips it when it already exists", async () => {
    await writeInstanceSetupMarker();

    expect(prisma.instanceSetup.createMany).toHaveBeenCalledWith({
      data: [{ id: "instance" }],
      skipDuplicates: true,
    });
  });
});
