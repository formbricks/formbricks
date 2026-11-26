import { prisma } from "@/lib/__mocks__/database";
import { beforeEach, describe, expect, test } from "vitest";
import { readInstanceSetupState, writeInstanceSetupMarker } from "./setup-state";

beforeEach(() => {
  prisma.instanceSetup.findUnique.mockResolvedValue(null);
  prisma.user.findFirst.mockResolvedValue(null);
  prisma.organization.findFirst.mockResolvedValue(null);
});

describe("readInstanceSetupState (ENG-7313)", () => {
  test("is fresh with no marker, no user and no organization", async () => {
    await expect(readInstanceSetupState()).resolves.toBe("fresh");
    // Read again before answering "fresh".
    expect(prisma.instanceSetup.findUnique).toHaveBeenCalledTimes(2);
  });

  // A first sign-up writes the marker after the first read, and its user is deleted before the user lookup.
  test("is not fresh when the marker appears while the lookups run", async () => {
    prisma.instanceSetup.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "instance" } as never);

    await expect(readInstanceSetupState()).resolves.toBe("marked");
  });

  test("a marker answers alone, without looking for users or organizations", async () => {
    prisma.instanceSetup.findUnique.mockResolvedValue({ id: "instance" } as never);

    await expect(readInstanceSetupState()).resolves.toBe("marked");
    expect(prisma.instanceSetup.findUnique).toHaveBeenCalledWith({
      where: { id: "instance" },
      select: { id: true },
    });
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  test("a user without a marker is in use, before organizations are looked at", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "user_1" } as never);

    await expect(readInstanceSetupState()).resolves.toBe("in-use");
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });

  // A database built with `db:push` or restored from before the migration: an organization without
  // users is not a fresh instance either.
  test("an organization without users or a marker is in use", async () => {
    prisma.organization.findFirst.mockResolvedValue({ id: "org_1" } as never);

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
