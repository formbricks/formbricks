import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma, Webhook } from "@formbricks/database/generated/client";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const getWebhookCountBySource = async (
  environmentId: string,
  source?: Webhook["source"]
): Promise<number> => {
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
};
