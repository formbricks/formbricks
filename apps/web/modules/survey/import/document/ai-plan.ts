import {
  type TImportPlanGenerate,
  type TImportPlanLane,
  type TImportPlanResponse,
  type TImportPlanUsage,
  importCallCapFor,
  importFailureCause,
  importOutputBudgetFor,
  runImportPlan,
} from "../core/ai-plan";
import { SurveyImportTimeoutError } from "../core/errors";
import { collectPlanEntries, collectPlanSkips } from "../core/plan-checks";
import type { TSurveyImportPipelineIssue } from "../core/report";
import {
  SURVEY_IMPORT_AI_CALL_TIMEOUT_MS,
  SURVEY_IMPORT_DOCUMENT_MAX_CALL_CHARS,
  SURVEY_IMPORT_DOCUMENT_MAX_CHUNKS,
  SURVEY_IMPORT_DOCUMENT_MAX_PARALLEL_CALLS,
  SURVEY_IMPORT_DOCUMENT_MAX_TOTAL_CHARS,
  SURVEY_IMPORT_PLANNING_STOP_QUESTIONS,
} from "../limits";
import { chunkDocumentLines } from "./chunks";
import type { TDocumentModel } from "./model";
import {
  DocumentPlanContext,
  type TDocumentCheckedPlan,
  type TDocumentPlanFailure,
  checkDocumentPlanResponses,
  isUnreadLine,
  mergeDocumentPlans,
} from "./plan-checks";
import {
  DOCUMENT_PLAN_ELEMENT_TYPES,
  ZDocumentImportPlanEnvelope,
  ZDocumentImportPlanForAI,
  ZDocumentPlanEntry,
  ZDocumentPlanSkip,
} from "./plan-schema";
import { buildDocumentPlanPrompt, buildDocumentPlanSystemPrompt } from "./prompt";

/**
 * The AI half of a document import (ENG-6852): the file's lines, chunked by the output they are
 * expected to need, planned by the lane-neutral engine (`../core/ai-plan.ts`) and checked by
 * `plan-checks.ts`. A unit of work is a line; an entry is planned by the call asked about the line it
 * starts on.
 */

const QUESTION_KINDS: ReadonlySet<string> = new Set(DOCUMENT_PLAN_ELEMENT_TYPES);

/**
 * The lines an answer starts a question on, as its checks would first read them: one entry that parses,
 * of an element kind (not a welcome card or an ending), on a line the call was asked about, and not
 * also skipped. An entry the cell and verbatim checks then fail is still counted: those depend on the
 * whole round, so the stop allows a margin (`SURVEY_IMPORT_PLANNING_STOP_QUESTIONS`).
 */
export const documentQuestionRefs = (response: TImportPlanResponse): string[] => {
  const envelope = ZDocumentImportPlanEnvelope.safeParse(response.object);
  if (!envelope.success) return [];
  const entries = collectPlanEntries(envelope.data.questions, response.refs, ZDocumentPlanEntry, () => {});
  const skips = collectPlanSkips(envelope.data.skipped, response.refs, ZDocumentPlanSkip);
  return [...entries].flatMap(([ref, placed]) =>
    placed.length === 1 && QUESTION_KINDS.has(placed[0].kind) && !skips.has(ref) ? [ref] : []
  );
};

/**
 * Whether an answer that parses names none of the lines it was asked about, as a question or a skip:
 * what the checks count as silent (`silentResponses`). An answer that does not parse is no silence, it
 * fails its lines.
 */
export const isSilentDocumentAnswer = (response: TImportPlanResponse): boolean => {
  const envelope = ZDocumentImportPlanEnvelope.safeParse(response.object);
  if (!envelope.success) return false;
  const entries = collectPlanEntries(envelope.data.questions, response.refs, ZDocumentPlanEntry, () => {});
  const skips = collectPlanSkips(envelope.data.skipped, response.refs, ZDocumentPlanSkip);
  return entries.size === 0 && skips.size === 0;
};

export interface TDocumentPlanResult {
  plan: TDocumentCheckedPlan;
  context: DocumentPlanContext;
  issues: TSurveyImportPipelineIssue[];
  usage: TImportPlanUsage;
  calls: number;
  /**
   * Whether the plan settles what the file holds: nothing failed on the way and every unit was
   * answered, so an empty plan means the file has nothing to import rather than a failed import.
   */
  conclusive: boolean;
  /** Whether a call ran past its output tokens or prompt size (`TImportPlanRun.hitOutputLimit`). */
  hitOutputLimit: boolean;
  /** Lines no call answered for (`isUnreadLine`): each could be a question the draft is missing. */
  unreadLines: number;
}

/**
 * Plan the import: every line is asked about, every entry the AI places is checked, failed ones asked
 * once more, and what still fails dropped with a report line.
 */
export async function planDocumentImport(params: {
  model: TDocumentModel;
  generate: TImportPlanGenerate;
  signal: AbortSignal;
  /** When the import must be finished by, as `performance.now()` time. */
  deadline: number;
  /** Resolved per-call budget, before clipping it to the import deadline. */
  callTimeoutMs?: number;
}): Promise<TDocumentPlanResult> {
  const { model, generate, deadline, callTimeoutMs = SURVEY_IMPORT_AI_CALL_TIMEOUT_MS } = params;
  const refs = model.lines.map((line) => line.key);
  const context = new DocumentPlanContext(model);
  const chunkCount = chunkDocumentLines(model, refs).length;

  const lane: TImportPlanLane<TDocumentPlanFailure, TDocumentCheckedPlan> = {
    chunk: (chunkRefs) => chunkDocumentLines(model, chunkRefs),
    system: buildDocumentPlanSystemPrompt(model.kind),
    schema: ZDocumentImportPlanForAI,
    schemaName: "DocumentImportPlan",
    schemaDescription: "Which lines of a questionnaire are questions, and which cells hold their texts.",
    buildPrompt: (chunkRefs, failures) => buildDocumentPlanPrompt({ model, refs: chunkRefs, failures }),
    check: (responses, round) => checkDocumentPlanResponses(context, responses, round),
    merge: (first, retry) => mergeDocumentPlans(first, retry, context),
    maxCallChars: SURVEY_IMPORT_DOCUMENT_MAX_CALL_CHARS,
    maxTotalChars: SURVEY_IMPORT_DOCUMENT_MAX_TOTAL_CHARS,
    callCap: Math.min(importCallCapFor(chunkCount), importCallCapFor(SURVEY_IMPORT_DOCUMENT_MAX_CHUNKS)),
    outputBudget: Math.min(
      importOutputBudgetFor(chunkCount),
      importOutputBudgetFor(SURVEY_IMPORT_DOCUMENT_MAX_CHUNKS)
    ),
    // A document's question count is only known from its plan (decision 18): the characters and chunks
    // checked before the first call bound what planning can cost, and this stops it once the answers
    // so far hold clearly more questions than the import takes. The pipeline refuses past the exact
    // ceiling on the checked plan.
    questionCeiling: { max: SURVEY_IMPORT_PLANNING_STOP_QUESTIONS, questionRefs: documentQuestionRefs },
    isSilent: isSilentDocumentAnswer,
    maxParallelCalls: SURVEY_IMPORT_DOCUMENT_MAX_PARALLEL_CALLS,
  };
  const run = await runImportPlan({ lane, refs, generate, signal: params.signal, deadline, callTimeoutMs });
  const { plan } = run;

  const issues: TSurveyImportPipelineIssue[] = [];
  // The AI's own reason is not reported: it speaks for Formbricks ("Formbricks has no picture
  // selection"), which it cannot know, when the truth is that a document import cannot build that kind
  // of question. The report's fixed sentence says so.
  for (const ref of plan.skipped.keys()) {
    issues.push({
      code: "question_skipped",
      severity: "warning",
      questionTag: ref,
      questionRef: ref,
      params: { cause: "ai_skipped" },
    });
  }
  for (const [ref, reasons] of plan.failures) {
    issues.push({
      code: "question_skipped",
      severity: "warning",
      questionTag: ref,
      questionRef: ref,
      params: { cause: importFailureCause(reasons) },
    });
  }

  // Nothing to assemble because time ran out: to the user, the import took too long.
  if (
    plan.entries.size === 0 &&
    (run.ranOutOfTime || [...plan.failures.values()].some((reasons) => reasons.includes("ai_timeout")))
  ) {
    throw new SurveyImportTimeoutError();
  }

  // Every line was answered: placed, skipped, or left out by an answer that named others.
  const conclusive =
    !run.failedOnTheWay && plan.silentResponses === 0 && plan.entries.size + plan.skipped.size > 0;
  const unreadLines = [...plan.failures.values()].filter(isUnreadLine).length;
  return {
    plan,
    context,
    issues,
    usage: run.usage,
    calls: run.calls,
    conclusive,
    hitOutputLimit: run.hitOutputLimit,
    unreadLines,
  };
}
