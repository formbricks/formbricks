import "server-only";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const getQuotaLinkCountByQuotaId = reactCache(async (quotaId: string): Promise<number> => {
  try {
    validateInputs([quotaId, ZId]);

    const quotaLinkCount = await prisma.responseQuotaLink.count({
      where: {
        quotaId,
        status: "screenedIn",
      },
    });

    return quotaLinkCount;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});
