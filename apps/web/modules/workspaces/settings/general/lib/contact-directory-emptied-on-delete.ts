import "server-only";
import { prisma } from "@formbricks/database";

/**
 * The name of the contact directory that deleting this workspace leaves with no workspaces, or null: the
 * workspace has no directory, or other workspaces still use it. The directory stays active and keeps its
 * contacts (ADR 0062); this only tells the delete dialog.
 */
export const getContactDirectoryEmptiedOnDelete = async (workspaceId: string): Promise<string | null> => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      contactDirectory: { select: { name: true, _count: { select: { workspaces: true } } } },
    },
  });
  const directory = workspace?.contactDirectory;
  if (directory?._count.workspaces !== 1) return null;
  return directory.name;
};
