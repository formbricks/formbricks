import { validateInputs } from "@/lib/utils/validate";
import { Prisma, Webhook } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

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
