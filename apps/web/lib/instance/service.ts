import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";

const INSTANCE_SETUP_ID = "instance";

const rethrowAsDatabaseError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    throw new DatabaseError(error.message);
  }
  throw error;
};

/**
 * Record that the instance has been set up. Idempotent; the fixed primary key keeps it a singleton, and
 * nothing in the app ever deletes the row.
 */
const markInstanceSetupCompleted = async (): Promise<void> => {
  await prisma.instanceSetup.upsert({
    where: { id: INSTANCE_SETUP_ID },
    create: { id: INSTANCE_SETUP_ID },
    update: {},
  });
};

/**
 * Whether the instance has never been set up: no persisted "setup completed" marker AND no users.
 *
 * The user count alone made "fresh" re-arm whenever the last user deleted their account, which reopened
 * the unauthenticated administrator sign-up (ENG-7313). So the first time a user is seen, the marker is
 * written and the instance is never fresh again. The migration writes it up front for every database
 * that already holds a user or an organization. The marker is read first and, once it exists, answers
 * the question without counting users.
 */
export const getIsFreshInstance = reactCache(async (): Promise<boolean> => {
  try {
    if (await prisma.instanceSetup.findUnique({ where: { id: INSTANCE_SETUP_ID }, select: { id: true } })) {
      return false;
    }
    if ((await prisma.user.count()) === 0) return true;

    await markInstanceSetupCompleted();
    return false;
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
});

// Function to check if there are any organizations in the database
export const getHasNoOrganizations = reactCache(async (): Promise<boolean> => {
  try {
    const organizationCount = await prisma.organization.count();
    return organizationCount === 0;
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
});

/**
 * Whether this user may create the instance's first organization (and become its owner) while the
 * organization count is zero without multi-org: the bootstrap administrator, or the only user the
 * instance has ever had. Anyone else who is merely signed in cannot claim it (ENG-7313).
 */
export const getIsEligibleFirstOrganizationOwner = async (userId: string): Promise<boolean> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isBootstrapAdmin: true } });
    if (!user) return false;
    if (user.isBootstrapAdmin) return true;
    return (await prisma.user.count()) === 1;
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
};
