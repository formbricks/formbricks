import { describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { readDatabaseClock } from "@/lib/utils/database-clock";

/**
 * Against real Postgres and `@prisma/adapter-pg`: the adapter relabels a `timestamptz`'s offset as
 * `+00:00` without converting it, so a database whose session time zone isn't UTC would hand back a
 * clock shifted by its offset. `readDatabaseClock` must read the true instant whatever that time zone.
 */
const SKEW_TOLERANCE_MS = 5_000;

describe("readDatabaseClock vs a non-UTC session time zone", () => {
  test.each(["UTC", "Asia/Tokyo", "America/Los_Angeles"])("reads the true instant in %s", async (zone) => {
    const now = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE '${zone}'`);
      return readDatabaseClock(tx);
    });

    expect(Math.abs(now.getTime() - Date.now())).toBeLessThan(SKEW_TOLERANCE_MS);
  });
});
