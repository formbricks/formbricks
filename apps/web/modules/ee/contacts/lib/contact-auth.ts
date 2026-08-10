import "server-only";
import { notFound } from "next/navigation";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { TWorkspaceAuth } from "@/modules/workspaces/types/workspace-auth";

/**
 * Resolves the workspace a contact belongs to, or null when the contact does not exist.
 *
 * Deliberately not run through `validateInputs`: `contactId` arrives as a raw URL segment, and a
 * malformed one should 404 exactly like a well-formed id belonging to someone else. Validating here
 * would raise a `ValidationError` instead and make the two cases distinguishable.
 *
 * Module-private on purpose — "resolve any contact's workspace, unscoped" is not something callers
 * should reach for from the module that owns the tenant boundary. Go through `getContactAuth`.
 */
const getWorkspaceIdOfContact = reactCache(async (contactId: string): Promise<string | null> => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { workspaceId: true },
    });

    return contact?.workspaceId ?? null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error resolving the workspace of a contact");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

/**
 * Authorization for pages addressed by both a workspace id and a contact id.
 *
 * `getWorkspaceAuth` only ever sees the workspace in the URL, so on its own it cannot tell
 * whether the contact in the URL is one of that workspace's contacts. Composing "authorize
 * workspace A" with "load contact X" therefore lets any authenticated user substitute their own
 * workspace id and read a foreign contact — its attributes (email, userId, arbitrary custom PII),
 * its responses and its displays. This helper ties the two together and is the choke point every
 * contact-scoped page must go through.
 *
 * Fails closed with a 404 rather than a 403, so a foreign contact id is indistinguishable from one
 * that does not exist.
 */
export const getContactAuth = reactCache(
  async (workspaceId: string, contactId: string): Promise<TWorkspaceAuth> => {
    const [workspaceAuth, contactWorkspaceId] = await Promise.all([
      getWorkspaceAuth(workspaceId),
      getWorkspaceIdOfContact(contactId),
    ]);

    if (contactWorkspaceId !== workspaceAuth.workspace.id) {
      notFound();
    }

    return workspaceAuth;
  }
);
