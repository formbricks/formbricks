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
import type { TSurveyImportPipelineIssue } from "../core/report";
import {
  SURVEY_IMPORT_AI_CALL_TIMEOUT_MS,
  SURVEY_IMPORT_DOCUMENT_MAX_CALL_CHARS,
  SURVEY_IMPORT_DOCUMENT_MAX_CHUNKS,
  SURVEY_IMPORT_DOCUMENT_MAX_TOTAL_CHARS,
  SURVEY_IMPORT_MAX_QUESTIONS,
} from "../limits";
import { chunkDocumentLines } from "./chunks";
import type { TDocumentModel } from "./model";
import {
  DocumentPlanContext,
  type TDocumentCheckedPlan,
  type TDocumentPlanFailure,
  checkDocumentPlanResponses,
  mergeDocumentPlans,
} from "./plan-checks";
import { DOCUMENT_PLAN_ELEMENT_TYPES, ZDocumentImportPlanForAI } from "./plan-schema";
import { buildDocumentPlanPrompt, buildDocumentPlanSystemPrompt } from "./prompt";

/**
 * The AI half of a document import (ENG-6852): the file's lines, chunked by the output they are
 * expected to need, planned by the lane-neutral engine (`../core/ai-plan.ts`) and checked by
 * `plan-checks.ts`. A unit of work is a line; an entry is planned by the call asked about the line it
 * starts on.
 */

const QUESTION_KINDS: ReadonlySet<string> = new Set(DOCUMENT_PLAN_ELEMENT_TYPES);

/**
 * The lines an answer starts a question on: entries of an element kind (not a welcome card or an
 * ending), on a line the call was asked about. Read off the answer as the engine received it, which
 * the schema has already admitted.
 */
export const documentQuestionRefs = (response: TImportPlanResponse): string[] => {
  const { questions } = response.object as { questions?: unknown };
  if (!Array.isArray(questions)) return [];
  return questions.flatMap((entry: unknown) => {
    const { ref, kind } = (entry ?? {}) as { ref?: unknown; kind?: unknown };
    return typeof ref === "string" &&
      typeof kind === "string" &&
      QUESTION_KINDS.has(kind) &&
      response.refs.has(ref)
      ? [ref]
      : [];
  });
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
    merge: mergeDocumentPlans,
    maxCallChars: SURVEY_IMPORT_DOCUMENT_MAX_CALL_CHARS,
    maxTotalChars: SURVEY_IMPORT_DOCUMENT_MAX_TOTAL_CHARS,
    callCap: Math.min(importCallCapFor(chunkCount), importCallCapFor(SURVEY_IMPORT_DOCUMENT_MAX_CHUNKS)),
    outputBudget: Math.min(
      importOutputBudgetFor(chunkCount),
      importOutputBudgetFor(SURVEY_IMPORT_DOCUMENT_MAX_CHUNKS)
    ),
    // A document's question count is only known from its plan (decision 18): the characters and chunks
    // checked before the first call bound what planning can cost, and this stops it once the answers
    // so far already hold more questions than the import takes.
    questionCeiling: { max: SURVEY_IMPORT_MAX_QUESTIONS, questionRefs: documentQuestionRefs },
  };
  const run = await runImportPlan({ lane, refs, generate, signal: params.signal, deadline, callTimeoutMs });
  const { plan } = run;

  const issues: TSurveyImportPipelineIssue[] = [];
  for (const [ref, description] of plan.skipped) {
    issues.push({
      code: "question_skipped",
      severity: "warning",
      questionTag: ref,
      questionRef: ref,
      params: { cause: "ai_skipped", ...(description ? { description } : {}) },
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
  return { plan, context, issues, usage: run.usage, calls: run.calls, conclusive };
}
