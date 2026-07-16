import { Prisma } from "@formbricks/database/prisma";
import type { PrismaClientKnownRequestError } from "@formbricks/database/prisma";
import { getUniqueConstraintFields, isUniqueConstraintError } from "@/lib/utils/prisma-constraint";

export const isPrismaKnownRequestError = (error: unknown): error is PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;

export const isSingleUseIdUniqueConstraintError = (error: PrismaClientKnownRequestError): boolean =>
  isUniqueConstraintError(error) && getUniqueConstraintFields(error).includes("singleUseId");

export const isDisplayIdUniqueConstraintError = (error: PrismaClientKnownRequestError): boolean =>
  isUniqueConstraintError(error) && getUniqueConstraintFields(error).includes("displayId");
