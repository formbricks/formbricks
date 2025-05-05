import { cache } from "@/lib/cache";
import { webhookCache } from "@/lib/cache/webhook";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma, Webhook } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const getWebhookCountBySource = (environmentId: string, source?: Webhook["source"]): Promise<number> =>
  cache(
    async () => {
      validateInputs([environmentId, ZId], [source, z.string().optional()]);

      try {
        const count = await prisma.webhook.count({
          where: {
            environmentId,
            source,
          },
        });
        return count;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getWebhookCountBySource-${environmentId}-${source}`],
    {
      tags: [webhookCache.tag.byEnvironmentIdAndSource(environmentId, source)],
    }
  )();
