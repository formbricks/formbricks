import "server-only";
import { notFound } from "next/navigation";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { whereContactsOfWorkspace } from "@/modules/ee/contacts/lib/contact-directory";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { TWorkspaceAuth } from "@/modules/workspaces/types/workspace-auth";

/**
 * Whether the contact is in the workspace's contact directory. A contact is reachable from every
 * workspace on its directory (decision 7); its own `workspaceId` only records where it was created.
 *
 * Deliberately not run through `validateInputs`: `contactId` arrives as a raw URL segment, and a
 * malformed one should 404 exactly like a well-formed id belonging to someone else. Validating here
 * would raise a `ValidationError` instead and make the two cases distinguishable.
 *
 * Module-private on purpose: go through `getContactAuth`, the choke point for contact pages.
 */
const isContactInWorkspaceDirectory = reactCache(
  async (workspaceId: string, contactId: string): Promise<boolean> => {
    try {
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, ...whereContactsOfWorkspace(workspaceId) },
        select: { id: true },
      });

      return contact !== null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        logger.error(error, "Error resolving the contact directory of a contact");
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

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
 * The contact must be in the URL workspace's contact directory, so a contact of another directory (in
 * this organization or another) stays unreachable.
 *
 * Fails closed with a 404 rather than a 403, so a foreign contact id is indistinguishable from one
 * that does not exist.
 */
export const getContactAuth = reactCache(
  async (workspaceId: string, contactId: string): Promise<TWorkspaceAuth> => {
    const [workspaceAuth, isInDirectory] = await Promise.all([
      getWorkspaceAuth(workspaceId),
      isContactInWorkspaceDirectory(workspaceId, contactId),
    ]);

    if (!isInDirectory) {
      notFound();
    }

    return workspaceAuth;
  }
);
