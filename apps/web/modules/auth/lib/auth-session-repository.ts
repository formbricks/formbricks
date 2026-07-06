import "server-only";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { Prisma, PrismaClient } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

type TAuthSessionDbClient = PrismaClient | Prisma.TransactionClient;

const getDbClient = (tx?: Prisma.TransactionClient): TAuthSessionDbClient => tx ?? prisma;

const handleDatabaseError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    throw new DatabaseError(error.message);
  }

  throw error;
};

export const deleteSessionBySessionToken = async (
  sessionToken: string,
  tx?: Prisma.TransactionClient
): Promise<number> => {
  validateInputs([sessionToken, z.string().min(1)]);

  try {
    const result = await getDbClient(tx).session.deleteMany({
      where: {
        sessionToken,
      },
    });

    return result.count;
  } catch (error) {
    return handleDatabaseError(error);
  }
};
