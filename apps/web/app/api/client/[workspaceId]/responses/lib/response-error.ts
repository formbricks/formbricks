import { Prisma } from "@formbricks/database/prisma";
import type { PrismaClientKnownRequestError } from "@formbricks/database/prisma";
import { DatabaseError, InvalidInputError, UniqueConstraintError } from "@formbricks/types/errors";
import { getUniqueConstraintFields, isUniqueConstraintError } from "@/lib/utils/prisma-constraint";

export const isPrismaKnownRequestError = (error: unknown): error is PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;

export const isSingleUseIdUniqueConstraintError = (error: PrismaClientKnownRequestError): boolean =>
  isUniqueConstraintError(error) && getUniqueConstraintFields(error).includes("singleUseId");

export const isDisplayIdUniqueConstraintError = (error: PrismaClientKnownRequestError): boolean =>
  isUniqueConstraintError(error) && getUniqueConstraintFields(error).includes("displayId");

/**
 * Maps a Prisma error thrown while creating a client response to its domain error. The v1 and v2
 * client-response create paths share this exact mapping, so it lives here alongside the guards it
 * uses. Always throws — either a mapped domain error or the original error re-thrown.
 */
export const handleClientResponseCreateError = (error: unknown, displayId?: string | null): never => {
  if (isPrismaKnownRequestError(error)) {
    // Captured before the P2002 guards: their negative branches narrow `error` to `never`.
    const { message } = error;
    if (isDisplayIdUniqueConstraintError(error)) {
      throw new InvalidInputError(`Display ${displayId} is already linked to a response`);
    }
    if (isSingleUseIdUniqueConstraintError(error)) {
      throw new UniqueConstraintError("Response already submitted for this single-use link");
    }
    if (isUniqueConstraintError(error)) {
      // The adapter recovers the column list by parsing the Postgres error DETAIL, which can be
      // absent or unparseable (redacted detail, non-English lc_messages). A P2002 is still a
      // duplicate either way, so it must stay a conflict — never fall through to a 500.
      throw new UniqueConstraintError("Response already exists");
    }
    throw new DatabaseError(message);
  }
  throw error;
};
