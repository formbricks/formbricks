import { Prisma } from "@prisma/client";
import { PrismaErrorType } from "@formbricks/database/types/error";

export const isPrismaKnownRequestError = (error: unknown): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError;

export const isSingleUseIdUniqueConstraintError = (error: Prisma.PrismaClientKnownRequestError): boolean => {
  if (error.code !== PrismaErrorType.UniqueConstraintViolation) {
    return false;
  }

  return Array.isArray(error.meta?.target) && error.meta.target.includes("singleUseId");
};
