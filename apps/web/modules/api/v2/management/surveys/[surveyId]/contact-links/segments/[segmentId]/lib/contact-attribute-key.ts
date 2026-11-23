import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";
import { whereAttributeKeysOfWorkspace } from "@/modules/ee/contacts/lib/attribute-key-scope";

export const getContactAttributeKeys = reactCache(async (workspaceId: string) => {
  try {
    const contactAttributeKeys = await prisma.contactAttributeKey.findMany({
      where: whereAttributeKeysOfWorkspace(workspaceId),
      select: {
        key: true,
      },
    });

    const keys = contactAttributeKeys.map((key) => key.key);
    return ok(keys);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [
        {
          field: "contact attribute keys",
          issue: error instanceof Error ? error.message : "Unknown error occurred",
        },
      ],
    });
  }
});
