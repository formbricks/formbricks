import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { whereContactsOfWorkspace } from "@/modules/ee/contacts/lib/contact-directory";

/** Whether the contact belongs to the workspace's directory, whichever of its workspaces created it. */
export const doesContactExistInWorkspace = reactCache(
  async (id: string, workspaceId: string): Promise<boolean> => {
    const contact = await prisma.contact.findFirst({
      where: {
        id,
        ...whereContactsOfWorkspace(workspaceId),
      },
      select: {
        id: true,
      },
    });

    return !!contact;
  }
);
