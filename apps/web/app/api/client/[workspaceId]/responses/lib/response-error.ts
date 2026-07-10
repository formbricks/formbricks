import { isUniqueConstraintError } from "@formbricks/database/errors";
import type { PrismaClientKnownRequestError } from "@formbricks/database/prisma";

export const isSingleUseIdUniqueConstraintError = (error: PrismaClientKnownRequestError): boolean =>
  isUniqueConstraintError(error) &&
  Array.isArray(error.meta?.target) &&
  error.meta.target.includes("singleUseId");

export const isDisplayIdUniqueConstraintError = (error: PrismaClientKnownRequestError): boolean =>
  isUniqueConstraintError(error) &&
  Array.isArray(error.meta?.target) &&
  error.meta.target.includes("displayId");
