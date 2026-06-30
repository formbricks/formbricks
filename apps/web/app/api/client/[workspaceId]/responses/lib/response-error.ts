import type { PrismaClientKnownRequestError } from "@formbricks/database/prisma";
import { isUniqueConstraintError } from "@/lib/utils/prisma-error";

export const isSingleUseIdUniqueConstraintError = (error: PrismaClientKnownRequestError): boolean =>
  isUniqueConstraintError(error) &&
  Array.isArray(error.meta?.target) &&
  error.meta.target.includes("singleUseId");
