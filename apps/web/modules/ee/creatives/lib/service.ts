import "server-only";
import { Prisma } from "@formbricks/database/prisma";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import type { TCreativeState } from "./creative";
import {
  getCreativeLanguageRequests,
  getDestinationSurveyIssue,
  toCreativeRowData,
  toCreativeState,
} from "./record";
import {
  type TCreativeRecord,
  type TCreativeTx,
  deleteCreativeRecord,
  ensureCreativeLanguages,
  findWorkspaceActionClassIds,
  insertCreativeRecord,
  lockDestinationSurvey,
  replaceCreativeRecord,
  runInCreativeTransaction,
} from "./repository";
import { getCreativeReferenceProblems, planCreativeDuplicate, planCreativeRestore } from "./write-rules";

/**
 * Creative writes (ENG-3993). Each one runs the pure rules in `write-rules.ts` against the stored facts
 * they need, inside the write's transaction: a survey being linked is locked the way a Restrict locks it,
 * so the two can't interleave. Callers authorize first (`authorization.ts`) and validate the state
 * (`validateCreativeState`); what only the database can answer surfaces as `CreativeReferenceError`.
 */

/** A reference in the write that the database refused: an ineligible survey, an unknown action. */
export class CreativeReferenceError extends Error {
  constructor(readonly invalidParams: InvalidParam[]) {
    super("Creative references failed validation");
    this.name = "CreativeReferenceError";
  }
}

const linkedSurveyId = (state: Pick<TCreativeState, "destination">): string | null =>
  state.destination?.type === "survey" ? state.destination.surveyId : null;

/**
 * Checks the survey a write newly links and every action it shows on. A survey already linked is not
 * checked again: an unrelated edit must not fail because of it, and the `destinationNotAllowed` warning
 * already says what's wrong.
 */
const assertCreativeReferences = async (
  tx: TCreativeTx,
  workspaceId: string,
  state: TCreativeState,
  previousSurveyId: string | null
): Promise<void> => {
  const surveyId = linkedSurveyId(state);
  const destinationIssue =
    surveyId && surveyId !== previousSurveyId
      ? getDestinationSurveyIssue(await lockDestinationSurvey(tx, surveyId, workspaceId))
      : null;

  const actionClassIds = state.distribution.triggers.map(({ actionClassId }) => actionClassId);
  const found = new Set(await findWorkspaceActionClassIds(tx, workspaceId, actionClassIds));
  const missingActionClassIds = new Set(actionClassIds.filter((id) => !found.has(id)));

  const problems = getCreativeReferenceProblems({ state, destinationIssue, missingActionClassIds });
  if (problems.length > 0) throw new CreativeReferenceError(problems);
};

const actionClassIdsOf = (state: TCreativeState): string[] =>
  state.distribution.triggers.map(({ actionClassId }) => actionClassId);

export const createCreative = async ({
  workspaceId,
  createdBy,
  state,
}: {
  workspaceId: string;
  createdBy: string | null;
  state: TCreativeState;
}): Promise<TCreativeRecord> => {
  const languages = await ensureCreativeLanguages(workspaceId, getCreativeLanguageRequests(state));

  return runInCreativeTransaction(async (tx) => {
    await assertCreativeReferences(tx, workspaceId, state, null);
    return insertCreativeRecord(tx, {
      workspaceId,
      type: state.type,
      createdBy,
      row: toCreativeRowData(state),
      actionClassIds: actionClassIdsOf(state),
      languages,
    });
  });
};

const isRecordGone = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";

/** A creative deleted while the request was in flight reads like one the caller can't see (403). */
const rethrowGone =
  (creativeId: string) =>
  (error: unknown): never => {
    if (isRecordGone(error)) throw new ResourceNotFoundError("creative", creativeId);
    throw error;
  };

/** Stores `next` over the creative whose stored state was `previous`. */
export const updateCreative = async ({
  creativeId,
  workspaceId,
  previous,
  next,
}: {
  creativeId: string;
  workspaceId: string;
  previous: TCreativeState;
  next: TCreativeState;
}): Promise<TCreativeRecord> => {
  const languages = await ensureCreativeLanguages(workspaceId, getCreativeLanguageRequests(next));

  return runInCreativeTransaction(async (tx) => {
    await assertCreativeReferences(tx, workspaceId, next, linkedSurveyId(previous));
    return replaceCreativeRecord(tx, creativeId, workspaceId, {
      row: toCreativeRowData(next),
      actionClassIds: actionClassIdsOf(next),
      languages,
    });
  }).catch(rethrowGone(creativeId));
};

/** Archives the creative; an archived one is returned as it is. */
export const archiveCreative = async (record: TCreativeRecord, now: Date): Promise<TCreativeRecord> => {
  if (record.archivedAt) return record;
  const state = toCreativeState(record);
  return runInCreativeTransaction((tx) =>
    replaceCreativeRecord(tx, record.id, record.workspaceId, {
      row: toCreativeRowData({ ...state, archivedAt: now }),
    })
  ).catch(rethrowGone(record.id));
};

/**
 * Restores an archived creative (a restored one is returned as it is). Its survey is re-checked under
 * the survey's lock: one that can no longer be a Destination is unlinked, and `planCreativeRestore`
 * brings back as Draft a creative left without the Destination it needs.
 */
export const restoreCreative = async (record: TCreativeRecord): Promise<TCreativeRecord> => {
  if (!record.archivedAt) return record;
  const state = toCreativeState(record);
  const surveyId = linkedSurveyId(state);

  return runInCreativeTransaction(async (tx) => {
    const destinationIssue = surveyId
      ? getDestinationSurveyIssue(await lockDestinationSurvey(tx, surveyId, record.workspaceId))
      : null;
    return replaceCreativeRecord(tx, record.id, record.workspaceId, {
      row: toCreativeRowData(planCreativeRestore(state, destinationIssue)),
    });
  }).catch(rethrowGone(record.id));
};

/** Copies the creative into a new Draft, without counts, created by `createdBy`. */
export const duplicateCreative = async ({
  record,
  createdBy,
}: {
  record: TCreativeRecord;
  createdBy: string | null;
}): Promise<TCreativeRecord> => {
  const state = toCreativeState(record);
  const languages = await ensureCreativeLanguages(record.workspaceId, getCreativeLanguageRequests(state));
  const surveyId = linkedSurveyId(state);

  return runInCreativeTransaction(async (tx) => {
    const destinationIssue = surveyId
      ? getDestinationSurveyIssue(await lockDestinationSurvey(tx, surveyId, record.workspaceId))
      : null;
    const copy = planCreativeDuplicate(state, destinationIssue);
    // The copy links nothing new, so only its actions are checked again.
    await assertCreativeReferences(tx, record.workspaceId, copy, linkedSurveyId(copy));
    return insertCreativeRecord(tx, {
      workspaceId: record.workspaceId,
      type: copy.type,
      createdBy,
      row: toCreativeRowData(copy),
      actionClassIds: actionClassIdsOf(copy),
      languages,
    });
  });
};

export const deleteCreative = (creativeId: string, workspaceId: string): Promise<void> =>
  deleteCreativeRecord(creativeId, workspaceId).catch(rethrowGone(creativeId));
