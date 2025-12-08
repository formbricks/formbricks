import "server-only";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";

export type TInstanceInfo = {
  instanceId: string;
  createdAt: Date;
};

/**
 * Returns instance info including the anonymized instance ID and creation date.
 *
 * The instance ID is a SHA-256 hash of the oldest organization's ID, ensuring
 * it remains stable over time. Used for telemetry and license checks.
 *
 * @returns Instance info with hashed ID and creation date, or `null` if no organizations exist
 */
export const getInstanceInfo = reactCache(async (): Promise<TInstanceInfo | null> => {
  try {
    const oldestOrg = await prisma.organization.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true },
    });

    if (!oldestOrg) return null;

    return {
      instanceId: createHash("sha256").update(oldestOrg.id).digest("hex"),
      createdAt: oldestOrg.createdAt,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

/**
 * Convenience function that returns just the instance ID.
 *
 * @returns Hashed instance ID, or `null` if no organizations exist
 */
export const getInstanceId = async (): Promise<string | null> => {
  const info = await getInstanceInfo();
  return info?.instanceId ?? null;
};
