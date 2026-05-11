import { PrismaErrorType } from "@formbricks/database/types/error";

type PrismaKnownRequestError = Error & {
  code: string;
  meta?: {
    target?: unknown;
  };
};

export const isPrismaKnownRequestError = (error: unknown): error is PrismaKnownRequestError => {
  if (!(error instanceof Error) || error.name !== "PrismaClientKnownRequestError") {
    return false;
  }

  return typeof (error as { code?: unknown }).code === "string";
};

export const isSingleUseIdUniqueConstraintError = (error: PrismaKnownRequestError): boolean => {
  if (error.code !== PrismaErrorType.UniqueConstraintViolation) {
    return false;
  }

  return Array.isArray(error.meta?.target) && error.meta.target.includes("singleUseId");
};
