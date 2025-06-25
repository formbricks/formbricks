import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";

export const getContactAttributeKeys = reactCache(async (environmentId: string) => {
  try {
    const contactAttributeKeys = await prisma.contactAttributeKey.findMany({
      where: { environmentId },
      select: {
        key: true,
      },
    });

    const keys = contactAttributeKeys.map((key) => key.key);
    return ok(keys);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "contact attribute keys", issue: error.message }],
    });
  }
});
