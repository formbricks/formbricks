import "server-only";
import { type Prisma, type SurveyStatus } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { type TAuditStatus } from "@/modules/ee/audit-logs/types/audit-log";
import { isDateDue, normalizeDateOnlySelectionToCETMidnight } from "./date-utils";

type TSurveySchedulingTransition = "publish" | "pause";

interface SurveySchedulingLogContext {
  [key: string]: unknown;
}

interface ReconcileDueSurveySchedulesOptions {
  logContext?: SurveySchedulingLogContext;
  now?: Date;
  surveyId?: string;
}

const surveySchedulingCandidateSelect = {
  environment: {
    select: {
      workspace: {
        select: {
          organizationId: true,
        },
      },
    },
  },
  environmentId: true,
  id: true,
  pauseOn: true,
  publishOn: true,
  status: true,
} satisfies Prisma.SurveySelect;

type TSurveySchedulingCandidate = Prisma.SurveyGetPayload<{
  select: typeof surveySchedulingCandidateSelect;
}>;

const getTransitionConfig = (
  transition: TSurveySchedulingTransition
): {
  clearField: "publishOn" | "pauseOn";
  currentStatus: SurveyStatus;
  dueField: "publishOn" | "pauseOn";
  nextStatus: SurveyStatus;
} => {
  if (transition === "publish") {
    return {
      clearField: "publishOn",
      currentStatus: "draft",
      dueField: "publishOn",
      nextStatus: "inProgress",
    };
  }

  return {
    clearField: "pauseOn",
    currentStatus: "inProgress",
    dueField: "pauseOn",
    nextStatus: "paused",
  };
};

const getTransitionAuditState = (
  candidate: TSurveySchedulingCandidate,
  transition: TSurveySchedulingTransition
): {
  newObject: Record<string, unknown>;
  oldObject: Record<string, unknown>;
} => {
  if (transition === "publish") {
    return {
      newObject: {
        pauseOn: candidate.pauseOn,
        publishOn: null,
        status: "inProgress",
      },
      oldObject: {
        pauseOn: candidate.pauseOn,
        publishOn: candidate.publishOn,
        status: candidate.status,
      },
    };
  }

  return {
    newObject: {
      pauseOn: null,
      publishOn: candidate.publishOn,
      status: "paused",
    },
    oldObject: {
      pauseOn: candidate.pauseOn,
      publishOn: candidate.publishOn,
      status: candidate.status,
    },
  };
};

const logAuditFailure = (
  candidate: TSurveySchedulingCandidate,
  transition: TSurveySchedulingTransition,
  auditError: unknown,
  logContext: SurveySchedulingLogContext
): void => {
  const logStatus: TAuditStatus = "success";

  logger.error(
    {
      ...logContext,
      auditStatus: logStatus,
      environmentId: candidate.environmentId,
      err: auditError,
      surveyId: candidate.id,
      transition,
    },
    "Survey scheduling audit log failed"
  );
};

const queueTransitionAudit = async (
  candidate: TSurveySchedulingCandidate,
  transition: TSurveySchedulingTransition,
  logContext: SurveySchedulingLogContext
): Promise<void> => {
  try {
    const { newObject, oldObject } = getTransitionAuditState(candidate, transition);

    await queueAuditEventWithoutRequest({
      action: "updated",
      newObject,
      oldObject,
      organizationId: candidate.environment.workspace.organizationId,
      status: "success",
      targetId: candidate.id,
      targetType: "survey",
      userId: "system",
      userType: "system",
    });
  } catch (auditError) {
    logAuditFailure(candidate, transition, auditError, logContext);
  }
};

const loadDueTransitionCandidates = async (
  transition: TSurveySchedulingTransition,
  now: Date,
  surveyId?: string
): Promise<TSurveySchedulingCandidate[]> => {
  const { currentStatus, dueField } = getTransitionConfig(transition);

  return await prisma.survey.findMany({
    select: surveySchedulingCandidateSelect,
    where: {
      ...(surveyId ? { id: surveyId } : {}),
      [dueField]: {
        lte: now,
        not: null,
      },
      status: currentStatus,
    },
  });
};

const applyTransition = async (
  candidate: TSurveySchedulingCandidate,
  transition: TSurveySchedulingTransition,
  now: Date,
  logContext: SurveySchedulingLogContext
): Promise<boolean> => {
  const { clearField, currentStatus, dueField, nextStatus } = getTransitionConfig(transition);

  try {
    const result = await prisma.survey.updateMany({
      data: {
        [clearField]: null,
        status: nextStatus,
      },
      where: {
        [dueField]: {
          lte: now,
          not: null,
        },
        id: candidate.id,
        status: currentStatus,
      },
    });

    if (result.count === 0) {
      return false;
    }
  } catch (error) {
    logger.error(
      {
        ...logContext,
        currentStatus,
        dueField,
        environmentId: candidate.environmentId,
        err: error,
        nextStatus,
        surveyId: candidate.id,
        transition,
      },
      "Survey scheduling transition failed"
    );

    throw error;
  }

  await queueTransitionAudit(candidate, transition, logContext);

  return true;
};

const reconcileTransition = async (
  transition: TSurveySchedulingTransition,
  now: Date,
  logContext: SurveySchedulingLogContext,
  surveyId?: string
): Promise<number> => {
  const candidates = await loadDueTransitionCandidates(transition, now, surveyId);
  let transitionCount = 0;

  for (const candidate of candidates) {
    const wasUpdated = await applyTransition(candidate, transition, now, logContext);

    if (wasUpdated) {
      transitionCount += 1;
    }
  }

  return transitionCount;
};

export const normalizeSurveyScheduling = ({
  currentStatus,
  pauseOn,
  publishOn,
  status,
}: {
  currentStatus?: TSurvey["status"] | null;
  pauseOn: Date | null;
  publishOn: Date | null;
  status: TSurvey["status"];
}): Pick<TSurvey, "pauseOn" | "publishOn"> => {
  let normalizedPauseOn = normalizeDateOnlySelectionToCETMidnight(pauseOn);
  let normalizedPublishOn = normalizeDateOnlySelectionToCETMidnight(publishOn);
  const isManualStatusChange =
    currentStatus === undefined || currentStatus === null || currentStatus !== status;

  if (isManualStatusChange && status === "inProgress") {
    normalizedPublishOn = null;
  }

  if (isManualStatusChange && (status === "paused" || status === "completed")) {
    normalizedPauseOn = null;
  }

  return {
    pauseOn: normalizedPauseOn,
    publishOn: normalizedPublishOn,
  };
};

export const isSurveySchedulingDue = (
  survey: Pick<TSurvey, "pauseOn" | "publishOn">,
  now: Date = new Date()
): boolean => isDateDue(survey.publishOn, now) || isDateDue(survey.pauseOn, now);

export const reconcileDueSurveySchedules = async ({
  logContext = {},
  now = new Date(),
  surveyId,
}: ReconcileDueSurveySchedulesOptions = {}): Promise<{
  pausedCount: number;
  publishedCount: number;
  surveyUpdated: boolean;
}> => {
  const publishedCount = await reconcileTransition("publish", now, logContext, surveyId);
  const pausedCount = await reconcileTransition("pause", now, logContext, surveyId);

  logger.info(
    {
      ...logContext,
      pausedCount,
      publishedCount,
      surveyId,
    },
    "Survey scheduling reconciliation completed"
  );

  return {
    pausedCount,
    publishedCount,
    surveyUpdated: publishedCount > 0 || pausedCount > 0,
  };
};
