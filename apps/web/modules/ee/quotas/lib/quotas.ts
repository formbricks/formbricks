import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurveyQuota, TSurveyQuotaInput, TSurveyQuotaLogic } from "@formbricks/types/quota";
import {
  findUnknownMatrixIds,
  getMatrixLookup,
  isMatrixRowCondition,
  withMatrixConditionIds,
} from "@formbricks/types/surveys/matrix-conditions";
import { isPrismaKnownRequestError, isUniqueConstraintError } from "@/lib/utils/prisma-error";
import { validateInputs } from "@/lib/utils/validate";

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
    if (isPrismaKnownRequestError(error)) {
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
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
});

/**
 * ENG-6934: a quota's matrix conditions carry the row and column ids next to the positions, in sync,
 * like every other stored condition: ids added where only positions came in, positions rewritten from
 * the ids. An id the matrix doesn't have is refused. Reads the survey only when a matrix row condition
 * is there to sync.
 */
const withQuotaMatrixIds = async (
  logic: TSurveyQuotaLogic,
  survey: Prisma.SurveyWhereInput
): Promise<TSurveyQuotaLogic> => {
  const hasMatrixRowCondition = logic.conditions.some(
    (condition) =>
      condition.leftOperand.type === "element" && isMatrixRowCondition(condition.leftOperand.meta)
  );
  if (!hasMatrixRowCondition) return logic;

  const stored = await prisma.survey.findFirst({ where: survey, select: { blocks: true } });
  if (!stored) return logic;
  const findMatrix = getMatrixLookup(stored.blocks);
  const [unknown] = findUnknownMatrixIds({ id: "logic", ...logic }, findMatrix, ["logic"]);
  if (unknown) {
    throw new InvalidInputError(`${unknown.message} (${unknown.path.join(".")})`);
  }
  return withMatrixConditionIds(logic, findMatrix);
};

export const createQuota = async (quota: TSurveyQuotaInput): Promise<TSurveyQuota> => {
  try {
    const newQuota = await prisma.surveyQuota.create({
      data: { ...quota, logic: await withQuotaMatrixIds(quota.logic, { id: quota.surveyId }) },
    });

    return newQuota;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new InvalidInputError("Quota with this name already exists");
    }
    throw error;
  }
};

export const updateQuota = async (quota: TSurveyQuotaInput, id: string): Promise<TSurveyQuota> => {
  try {
    // ENG-1749: surveyId is the quota's tenant anchor, set at creation and immutable thereafter.
    // Persisting a caller-supplied surveyId here would let an authorized quota owner re-point their
    // quota onto another tenant's survey, so it is stripped from the update payload.
    const { surveyId: _surveyId, ...quotaData } = quota;
    const updatedQuota = await prisma.surveyQuota.update({
      where: { id },
      // The survey the stored quota belongs to, never the caller's surveyId (ENG-1749 above).
      data: { ...quotaData, logic: await withQuotaMatrixIds(quotaData.logic, { quotas: { some: { id } } }) },
    });

    return updatedQuota;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new InvalidInputError("Quota with this name already exists");
    }
    if (isPrismaKnownRequestError(error, PrismaErrorType.RecordNotFound)) {
      throw new ResourceNotFoundError("Quota", id);
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
    if (isPrismaKnownRequestError(error, PrismaErrorType.RecordNotFound)) {
      throw new ResourceNotFoundError("Quota", quotaId);
    }
    if (isPrismaKnownRequestError(error)) {
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
    if (isPrismaKnownRequestError(error)) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
