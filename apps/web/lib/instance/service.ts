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

const upsertInstanceSetupMarker = async (): Promise<void> => {
  await prisma.instanceSetup.upsert({
    where: { id: INSTANCE_SETUP_ID },
    create: { id: INSTANCE_SETUP_ID },
    update: {},
  });
};

/**
 * Record that the instance has been set up. Idempotent; the fixed primary key keeps it a singleton, and
 * nothing in the app ever deletes the row. Called by the flows that create the bootstrap administrator
 * (`createUserAction`, the SSO `user.create.after` hook) right after the row exists, so a first user who
 * deletes their account before any page asks {@link getIsFreshInstance} cannot re-arm the setup.
 */
export const markInstanceSetupCompleted = async (): Promise<void> => {
  try {
    await upsertInstanceSetupMarker();
  } catch (error) {
    rethrowAsDatabaseError(error);
  }
};

/**
 * Whether the instance has never been set up: no persisted "setup completed" marker AND no users.
 *
 * The user count alone made "fresh" re-arm whenever the last user deleted their account, which reopened
 * the unauthenticated administrator sign-up (ENG-7313). The sign-up flows write the marker when they create
 * the bootstrap administrator, and the migration writes it for every database that already held a user or
 * an organization. As a backstop for a user created any other way, the first time this sees a user it
 * writes the marker too. The marker is read first and, once it exists, answers without counting users.
 */
export const getIsFreshInstance = reactCache(async (): Promise<boolean> => {
  try {
    if (await prisma.instanceSetup.findUnique({ where: { id: INSTANCE_SETUP_ID }, select: { id: true } })) {
      return false;
    }
    if ((await prisma.user.count()) === 0) return true;

    await upsertInstanceSetupMarker();
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
 * organization count is zero without multi-org. Exactly one user qualifies, so a user who is merely
 * signed in cannot claim it (ENG-7313):
 *
 * - the bootstrap administrator, while that account exists;
 * - otherwise the earliest-created user (ties broken by id). This covers instances whose administrator
 *   signed up before the bootstrap marker existed (ENG-2247) or has since deleted their account. Without
 *   it, such an instance with two or more users and no organization (for example after the only
 *   organization was deleted) would have nobody able to create one.
 */
export const getIsEligibleFirstOrganizationOwner = async (userId: string): Promise<boolean> => {
  try {
    const bootstrapAdmin = await prisma.user.findFirst({
      where: { isBootstrapAdmin: { not: null } },
      select: { id: true },
    });
    if (bootstrapAdmin) return bootstrapAdmin.id === userId;

    const earliestUser = await prisma.user.findFirst({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    return earliestUser?.id === userId;
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
};
