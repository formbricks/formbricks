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
  type TCreativeLifecycleColumns,
  type TCreativeRecord,
  type TCreativeTx,
  type TDestinationSurveyFacts,
  deleteCreativeRecord,
  ensureCreativeLanguages,
  findWorkspaceActionClassIds,
  insertCreativeRecord,
  lockCreativeRecord,
  lockDestinationSurvey,
  pauseSurveyCreativeRecords,
  replaceCreativeRecord,
  runInCreativeTransaction,
  updateCreativeLifecycleColumns,
} from "./repository";
import { getCreativeReferenceProblems, planCreativeDuplicate, planCreativeRestore } from "./write-rules";

/**
 * Creative writes (ENG-3993). Each one runs the pure rules in `write-rules.ts` against the stored facts
 * they need, inside the write's transaction: a survey being linked is locked the way a Restrict locks it,
 * so the two can't interleave. Callers authorize first (`authorization.ts`).
 *
 * A write to an existing creative reads it under its row lock (`lockCreativeRecord`) and plans from that
 * read, never from one taken before the transaction, so a pause, archive or survey-side unlink committed
 * meanwhile can't be undone by a request that never mentioned it (ENG-6602 review). Lock order: the
 * survey a write links comes first, then the creative's row, the order a survey-side change takes them
 * (its survey's lock, then the rows of the creatives it unlinks), so the two never deadlock.
 */

/** The write's resulting creative is invalid, or archived and read-only: a 422 with these params. */
export class CreativeInvalidError extends Error {
  constructor(
    readonly invalidParams: InvalidParam[],
    message = "The creative failed validation"
  ) {
    super(message);
    this.name = "CreativeInvalidError";
  }
}

/** A reference in the write that the database refused: an ineligible survey, an unknown action. */
export class CreativeReferenceError extends CreativeInvalidError {
  constructor(invalidParams: InvalidParam[]) {
    super(invalidParams, "Creative references failed validation");
    this.name = "CreativeReferenceError";
  }
}

/** The creative changed since the `updatedAt` the caller read (its precondition): nothing was written. */
export class CreativeChangedError extends Error {
  constructor(
    readonly expectedUpdatedAt: Date,
    readonly currentUpdatedAt: Date
  ) {
    super("The creative changed since it was last read");
    this.name = "CreativeChangedError";
  }
}

const ARCHIVED_PARAM: InvalidParam = {
  name: "archivedAt",
  reason: "This creative is archived. Restore it before editing.",
};

/**
 * Refuses a change to `record`: its precondition no longer holds (checked first, as RFC 9110 evaluates a
 * precondition before the method), or it is archived and read-only until restored.
 */
export const assertCreativeEditable = (
  record: Pick<TCreativeRecord, "updatedAt" | "archivedAt">,
  expectedUpdatedAt: Date | undefined
): void => {
  if (expectedUpdatedAt && record.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    throw new CreativeChangedError(expectedUpdatedAt, record.updatedAt);
  }
  if (record.archivedAt) throw new CreativeInvalidError([ARCHIVED_PARAM], "Creative is archived");
};

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
}): Promise<TCreativeRecord> =>
  runInCreativeTransaction(async (tx) => {
    await assertCreativeReferences(tx, workspaceId, state, null);
    return insertCreativeRecord(tx, {
      workspaceId,
      type: state.type,
      createdBy,
      row: toCreativeRowData(state),
      actionClassIds: actionClassIdsOf(state),
      languages: await ensureCreativeLanguages(tx, workspaceId, getCreativeLanguageRequests(state)),
    });
  });

const isRecordGone = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";

/** A creative deleted while the request was in flight reads like one the caller can't see (403). */
const rethrowGone =
  (creativeId: string) =>
  (error: unknown): never => {
    if (isRecordGone(error)) throw new ResourceNotFoundError("creative", creativeId);
    throw error;
  };

/** A write to an existing creative: the creative as it was stored before it, and after. */
export type TCreativeChange = { before: TCreativeRecord; after: TCreativeRecord };

/**
 * Plans a change from the creative as stored now (`current`), throwing `CreativeInvalidError` (or the
 * custom CSS errors) to refuse it. Runs inside the write's transaction, under the creative's row lock.
 */
export type TCreativeChangePlan = (current: TCreativeState) => Promise<TCreativeState>;

/**
 * Looks at a planned change once its references hold, inside the write's transaction and under the same
 * locks, and throws to refuse it. A document push uses it to refuse a change that would remove data.
 */
export type TCreativeChangeReview = (
  tx: TCreativeTx,
  change: { previous: TCreativeState; next: TCreativeState }
) => Promise<void>;

type TCreativeUpdateOptions = {
  creativeId: string;
  workspaceId: string;
  expectedUpdatedAt?: Date;
  surveyIdToLink: string | null;
  plan: TCreativeChangePlan;
};

/**
 * What an update did: the creative as stored before it, the state it planned, and the creative as stored
 * after it. `after` is `null` when nothing was written: a dry run, or a plan that returned the state it
 * was given (a change that changes nothing, which also skips the reference checks and leaves `updatedAt`).
 */
export type TCreativeUpdateOutcome = {
  before: TCreativeRecord;
  next: TCreativeState;
  after: TCreativeRecord | null;
};

const runCreativeUpdate = (
  { creativeId, workspaceId, expectedUpdatedAt, surveyIdToLink, plan }: TCreativeUpdateOptions,
  { review, dryRun = false }: { review?: TCreativeChangeReview; dryRun?: boolean }
): Promise<TCreativeUpdateOutcome> =>
  runInCreativeTransaction(async (tx) => {
    // Its facts are read again under this same lock by `assertCreativeReferences`, if it links it.
    if (surveyIdToLink) await lockDestinationSurvey(tx, surveyIdToLink, workspaceId);
    const before = await lockCreativeRecord(tx, creativeId, workspaceId);
    if (!before) throw new ResourceNotFoundError("creative", creativeId);
    assertCreativeEditable(before, expectedUpdatedAt);

    const previous = toCreativeState(before);
    const next = await plan(previous);
    if (next === previous) return { before, next, after: null };
    // Rechecked against the stored link, so relinking a survey a Restrict unlinked meanwhile is refused.
    await assertCreativeReferences(tx, workspaceId, next, linkedSurveyId(previous));
    await review?.(tx, { previous, next });
    if (dryRun) return { before, next, after: null };

    const after = await replaceCreativeRecord(tx, creativeId, workspaceId, {
      row: toCreativeRowData(next),
      actionClassIds: actionClassIdsOf(next),
      languages: await ensureCreativeLanguages(tx, workspaceId, getCreativeLanguageRequests(next)),
    });
    return { before, next, after };
  }).catch(rethrowGone(creativeId));

/**
 * Applies `plan` to the creative as stored now, under its row lock, and stores the result.
 * `expectedUpdatedAt` is the caller's precondition (`CreativeChangedError` when it no longer holds);
 * without one the change simply builds on whatever was committed meanwhile. `surveyIdToLink` is the
 * survey the change may link, locked before the creative (see the lock order above).
 */
export const updateCreative = async (options: TCreativeUpdateOptions): Promise<TCreativeChange> => {
  const { before, after } = await runCreativeUpdate(options, {});
  return { before, after: after ?? before };
};

/**
 * `updateCreative` for a document push: the same checks in the same transaction, plus a `review` of the
 * planned change, and `dryRun` to run all of it without writing. The precondition is compared under the
 * row lock, so two pushes of the same `updatedAt` cannot both win.
 */
export const replaceCreativeState = (
  options: TCreativeUpdateOptions & { review?: TCreativeChangeReview; dryRun?: boolean }
): Promise<TCreativeUpdateOutcome> =>
  runCreativeUpdate(options, { review: options.review, dryRun: options.dryRun });

/** Archives the creative, writing only `archivedAt`; an archived one is returned as it is. */
export const archiveCreative = async (
  creativeId: string,
  workspaceId: string,
  now: Date
): Promise<TCreativeChange> =>
  runInCreativeTransaction(async (tx) => {
    const before = await lockCreativeRecord(tx, creativeId, workspaceId);
    if (!before) throw new ResourceNotFoundError("creative", creativeId);
    if (before.archivedAt) return { before, after: before };
    const after = await updateCreativeLifecycleColumns(tx, creativeId, workspaceId, { archivedAt: now });
    return { before, after };
  }).catch(rethrowGone(creativeId));

/** The columns a restore writes: always status and `archivedAt`, the survey only when it unlinks it. */
const getRestoreColumns = (record: TCreativeRecord, survey: TDestinationSurveyFacts | null) => {
  const restored = planCreativeRestore(
    toCreativeState(record),
    record.surveyId ? getDestinationSurveyIssue(survey) : null
  );
  const columns: TCreativeLifecycleColumns = { status: restored.status, archivedAt: restored.archivedAt };
  if (record.surveyId && restored.destination === null) columns.surveyId = null;
  return columns;
};

/** How many times a restore re-reads a creative relinked to another survey before its lock was taken. */
const RESTORE_ATTEMPTS = 2;

type TRelinked = { relinkedTo: string };

/**
 * Restores an archived creative (a restored one is returned as it is). Its survey is re-checked under
 * the survey's lock: one that can no longer be a Destination is unlinked, and `planCreativeRestore`
 * brings back as Draft a creative left without the Destination it needs.
 *
 * The survey is locked before the creative (see the lock order above), so it is the one `surveyId` names,
 * read before the transaction. A creative relinked to another survey before the row lock was taken is
 * restored again against that survey; anything that keeps moving after that is not a state a restore
 * can explain.
 */
export const restoreCreative = async (
  creativeId: string,
  workspaceId: string,
  surveyId: string | null
): Promise<TCreativeChange> => {
  let surveyToLock = surveyId;
  for (let attempt = 1; attempt <= RESTORE_ATTEMPTS; attempt++) {
    const restored = await runInCreativeTransaction(async (tx): Promise<TCreativeChange | TRelinked> => {
      const survey = surveyToLock ? await lockDestinationSurvey(tx, surveyToLock, workspaceId) : null;
      const before = await lockCreativeRecord(tx, creativeId, workspaceId);
      if (!before) throw new ResourceNotFoundError("creative", creativeId);
      if (!before.archivedAt) return { before, after: before };
      if (before.surveyId && before.surveyId !== surveyToLock) return { relinkedTo: before.surveyId };

      const columns = getRestoreColumns(before, survey);
      return { before, after: await updateCreativeLifecycleColumns(tx, creativeId, workspaceId, columns) };
    }).catch(rethrowGone(creativeId));
    if ("after" in restored) return restored;
    surveyToLock = restored.relinkedTo;
  }
  throw new Error(`Creative ${creativeId} kept changing its survey while it was being restored`);
};

/**
 * Pauses every In progress creative the survey opens, however many, and returns their ids; `null` when
 * no such survey is in the workspace. A survey-side change, so it takes its locks in the order above:
 * the survey's first, then the creatives' rows, which the single update takes as it reaches them.
 */
export const pauseSurveyCreatives = (
  surveyId: string,
  workspaceId: string,
  now: Date
): Promise<string[] | null> =>
  runInCreativeTransaction(async (tx) => {
    if (!(await lockDestinationSurvey(tx, surveyId, workspaceId))) return null;
    return pauseSurveyCreativeRecords(tx, surveyId, workspaceId, now);
  });

/** Copies the creative into a new Draft, without counts, created by `createdBy`. */
export const duplicateCreative = async ({
  record,
  createdBy,
}: {
  record: TCreativeRecord;
  createdBy: string | null;
}): Promise<TCreativeRecord> => {
  const state = toCreativeState(record);
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
      languages: await ensureCreativeLanguages(tx, record.workspaceId, getCreativeLanguageRequests(copy)),
    });
  });
};

export const deleteCreative = (creativeId: string, workspaceId: string): Promise<void> =>
  deleteCreativeRecord(creativeId, workspaceId).catch(rethrowGone(creativeId));
