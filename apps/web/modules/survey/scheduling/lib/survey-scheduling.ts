import "server-only";
import { prisma } from "@formbricks/database";
import { type Prisma, type SurveyStatus } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ValidationError } from "@formbricks/types/errors";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { type TAuditStatus } from "@/modules/ee/audit-logs/types/audit-log";
import { SURVEY_SCHEDULING_CONFIG, SURVEY_SCHEDULING_RECONCILIATION_BATCH_SIZE } from "./constants";
import { createSurveySchedulingDateUtils, isDateDue } from "./date-utils";

const { normalizeDateOnlySelectionToSurveySchedulingDateTime } =
  createSurveySchedulingDateUtils(SURVEY_SCHEDULING_CONFIG);

type TSurveySchedulingTransition = "publish" | "close";

interface SurveySchedulingLogContext {
  [key: string]: unknown;
}

interface ReconcileDueSurveySchedulesOptions {
  logContext?: SurveySchedulingLogContext;
  now?: Date;
  surveyId?: string;
}

const surveySchedulingCandidateSelect = {
  workspace: {
    select: {
      organizationId: true,
    },
  },
  workspaceId: true,
  id: true,
  closeOn: true,
  publishOn: true,
  status: true,
} satisfies Prisma.SurveySelect;

type TSurveySchedulingCandidate = Prisma.SurveyGetPayload<{
  select: typeof surveySchedulingCandidateSelect;
}>;

interface LoadDueTransitionCandidatesOptions {
  surveyId?: string;
  take: number;
}

const getTransitionConfig = (
  transition: TSurveySchedulingTransition
): {
  clearField: "publishOn" | "closeOn";
  currentStatus: SurveyStatus;
  dueField: "publishOn" | "closeOn";
  nextStatus: SurveyStatus;
} => {
  if (transition === "publish") {
    return {
      clearField: "publishOn",
      currentStatus: "paused",
      dueField: "publishOn",
      nextStatus: "inProgress",
    };
  }

  return {
    clearField: "closeOn",
    currentStatus: "inProgress",
    dueField: "closeOn",
    nextStatus: "completed",
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
        closeOn: candidate.closeOn,
        publishOn: null,
        status: "inProgress",
      },
      oldObject: {
        closeOn: candidate.closeOn,
        publishOn: candidate.publishOn,
        status: candidate.status,
      },
    };
  }

  return {
    newObject: {
      closeOn: null,
      publishOn: candidate.publishOn,
      status: "completed",
    },
    oldObject: {
      closeOn: candidate.closeOn,
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
      err: auditError,
      surveyId: candidate.id,
      transition,
      workspaceId: candidate.workspaceId,
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
      organizationId: candidate.workspace.organizationId,
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
  { surveyId, take }: LoadDueTransitionCandidatesOptions
): Promise<TSurveySchedulingCandidate[]> => {
  const { currentStatus, dueField } = getTransitionConfig(transition);

  return await prisma.survey.findMany({
    orderBy: [
      {
        [dueField]: "asc",
      },
      {
        id: "asc",
      },
    ],
    select: surveySchedulingCandidateSelect,
    take,
    where: {
      ...(surveyId ? { id: surveyId } : {}),
      [dueField]: {
        lte: now,
        not: null,
      },
      status: currentStatus,
      // Never auto-transition archived surveys (belt-and-suspenders: archive already clears publishOn).
      archivedAt: null,
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
        archivedAt: null,
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
        err: error,
        nextStatus,
        surveyId: candidate.id,
        transition,
        workspaceId: candidate.workspaceId,
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
  const batchSize = surveyId ? 1 : SURVEY_SCHEDULING_RECONCILIATION_BATCH_SIZE;
  let transitionCount = 0;

  while (true) {
    const candidates = await loadDueTransitionCandidates(transition, now, {
      surveyId,
      take: batchSize,
    });

    if (candidates.length === 0) {
      break;
    }

    for (const candidate of candidates) {
      const wasUpdated = await applyTransition(candidate, transition, now, logContext);

      if (wasUpdated) {
        transitionCount += 1;
      }
    }

    if (surveyId || candidates.length < batchSize) {
      break;
    }
  }

  return transitionCount;
};

export const normalizeSurveyScheduling = ({
  currentStatus,
  closeOn,
  publishOn,
  status,
}: {
  currentStatus?: TSurvey["status"] | null;
  closeOn: Date | null;
  publishOn: Date | null;
  status: TSurvey["status"];
}): Pick<TSurvey, "closeOn" | "publishOn"> => {
  let normalizedCloseOn = normalizeDateOnlySelectionToSurveySchedulingDateTime(closeOn);
  let normalizedPublishOn = normalizeDateOnlySelectionToSurveySchedulingDateTime(publishOn);
  const isManualStatusChange =
    currentStatus === undefined || currentStatus === null || currentStatus !== status;

  if (isManualStatusChange && status === "inProgress") {
    normalizedPublishOn = null;
  }

  if (isManualStatusChange && status === "paused" && normalizedPublishOn === null) {
    normalizedCloseOn = null;
  }

  if (isManualStatusChange && status === "completed") {
    normalizedCloseOn = null;
    normalizedPublishOn = null;
  }

  if (
    normalizedPublishOn !== null &&
    normalizedCloseOn !== null &&
    normalizedCloseOn.getTime() <= normalizedPublishOn.getTime()
  ) {
    throw new ValidationError("Close date must be after publish date");
  }

  return {
    closeOn: normalizedCloseOn,
    publishOn: normalizedPublishOn,
  };
};

export const isSurveySchedulingDue = (
  survey: Pick<TSurvey, "closeOn" | "publishOn">,
  now: Date = new Date()
): boolean => isDateDue(survey.publishOn, now) || isDateDue(survey.closeOn, now);

export const reconcileDueSurveySchedules = async ({
  logContext = {},
  now = new Date(),
  surveyId,
}: ReconcileDueSurveySchedulesOptions = {}): Promise<{
  closedCount: number;
  publishedCount: number;
  surveyUpdated: boolean;
}> => {
  const publishedCount = await reconcileTransition("publish", now, logContext, surveyId);
  const closedCount = await reconcileTransition("close", now, logContext, surveyId);

  logger.info(
    {
      ...logContext,
      closedCount,
      publishedCount,
      surveyId,
    },
    "Survey scheduling reconciliation completed"
  );

  return {
    closedCount,
    publishedCount,
    surveyUpdated: publishedCount > 0 || closedCount > 0,
  };
};
