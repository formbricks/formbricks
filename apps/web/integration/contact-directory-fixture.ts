import { prisma } from "@formbricks/database";

/**
 * A workspace on a contact directory of its own, as the ENG-7491 migration leaves every existing
 * workspace. A workspace made with a bare `prisma.workspace.create` has no directory (decision 3), so
 * its contacts and attribute keys are invisible to every directory-scoped read.
 *
 * Contacts, keys and segments inserted with only a `workspaceId` get the directory's id from the
 * rolling-deploy trigger (decision 6), the same shape migrated rows have.
 */
export const createWorkspaceWithContactDirectory = async (
  organizationId: string,
  name = "Workspace"
): Promise<{ workspaceId: string; directoryId: string }> => {
  // Named after its workspace, as the migration names every directory.
  const directory = await prisma.contactDirectory.create({
    data: { organizationId, name, matchingKey: "email" },
    select: { id: true },
  });
  const workspace = await prisma.workspace.create({
    data: { name, organizationId, contactDirectoryId: directory.id },
    select: { id: true },
  });
  return { workspaceId: workspace.id, directoryId: directory.id };
};

/** Another workspace on an existing directory, which makes it a shared directory. */
export const createWorkspaceOnContactDirectory = async (
  organizationId: string,
  directoryId: string,
  name = "Second workspace"
): Promise<string> => {
  const workspace = await prisma.workspace.create({
    data: { name, organizationId, contactDirectoryId: directoryId },
    select: { id: true },
  });
  return workspace.id;
};
