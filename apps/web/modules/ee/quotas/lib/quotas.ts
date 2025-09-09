import "server-only";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurveyQuota, TSurveyQuotaInput } from "@formbricks/types/quota";

export const getQuota = reactCache(async (quotaId: string): Promise<TSurveyQuota> => {
  try {
    validateInputs([quotaId, ZId]);

    const quota = await prisma.surveyQuota.findUnique({
      where: {
        id: quotaId,
      },
    });

    if (!quota) {
      throw new ResourceNotFoundError("Quota", quotaId);
    }
    return quota;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

export const getQuotas = reactCache(async (surveyId: string): Promise<TSurveyQuota[]> => {
  validateInputs([surveyId, ZId]);

  try {
    const quotas = await prisma.surveyQuota.findMany({
      where: {
        surveyId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return quotas;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

export const createQuota = async (quota: TSurveyQuotaInput): Promise<TSurveyQuota> => {
  try {
    const newQuota = await prisma.surveyQuota.create({
      data: quota,
    });

    return newQuota;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("Quota with this name already exists");
      }
    }
    throw error;
  }
};

export const updateQuota = async (quota: TSurveyQuotaInput, id: string): Promise<TSurveyQuota> => {
  try {
    const updatedQuota = await prisma.surveyQuota.update({
      where: { id },
      data: quota,
    });

    return updatedQuota;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.UniqueConstraintViolation) {
        throw new InvalidInputError("Quota with this name already exists");
      }
      if (error.code === PrismaErrorType.RecordDoesNotExist) {
        throw new ResourceNotFoundError("Quota not found", error.message);
      }
    }
    throw error;
  }
};

export const deleteQuota = async (quotaId: string): Promise<TSurveyQuota> => {
  try {
    const deletedQuota = await prisma.surveyQuota.delete({
      where: { id: quotaId },
    });

    return deletedQuota;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === PrismaErrorType.RecordDoesNotExist) {
        throw new ResourceNotFoundError("Quota not found", error.message);
      }

      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const reduceQuotaLimits = async (quotaIds: string[], tx?: Prisma.TransactionClient): Promise<void> => {
  try {
    const prismaClient = tx ?? prisma;
    await prismaClient.surveyQuota.updateMany({
      where: {
        id: {
          in: quotaIds,
        },
        limit: {
          gt: 1,
        },
      },
      data: {
        limit: {
          decrement: 1,
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
