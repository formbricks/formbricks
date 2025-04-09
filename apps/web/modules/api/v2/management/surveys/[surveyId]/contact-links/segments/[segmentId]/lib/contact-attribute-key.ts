import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getContactAttributeKeys = reactCache((environmentId: string) =>
  cache(
    async (): Promise<Result<string[], ApiErrorResponseV2>> => {
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
    },
    [`getContactAttributeKeys-contact-links-${environmentId}`],
    {
      tags: [contactAttributeKeyCache.tag.byEnvironmentId(environmentId)],
    }
  )()
);
