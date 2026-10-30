import {
  type TImportPlanGenerate,
  type TImportPlanLane,
  type TImportPlanRequest,
  type TImportPlanUsage,
  importCallCapFor,
  importFailureCause,
  importOutputBudgetFor,
  runImportPlan,
} from "../core/ai-plan";
import { SurveyImportFailedError, SurveyImportTimeoutError } from "../core/errors";
import type { TSurveyImportPipelineIssue } from "../core/report";
import {
  SURVEY_IMPORT_AI_CALL_TIMEOUT_MS,
  SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS,
  SURVEY_IMPORT_MAX_QUESTIONS,
} from "../limits";
import {
  type TQsfCheckedPlan,
  type TQsfPlanFailure,
  checkPlanResponses,
  mergeCheckedPlans,
} from "./plan-checks";
import { ZQsfImportPlanForAI } from "./plan-schema";
import {
  QSF_LOOSEST_PROMPT_LIMITS,
  QSF_PROMPT_MAX_CALL_CHARS,
  QSF_PROMPT_MAX_TOTAL_CHARS,
  type TQsfPromptLimits,
  type TQsfPromptTexts,
  buildQsfPlanPrompt,
  buildQsfPlanSystemPrompt,
  chooseQsfPromptLimits,
  describedQuestionChars,
  describedRuleCount,
} from "./prompt";
import type { TQsfSurvey } from "./qsf-model";
import { unsupportedTypeSeverity } from "./unsupported-types";

/**
 * The AI half of the Qualtrics import (ENG-3479): the questions, chunked by the output they are
 * expected to need, planned by the lane-neutral engine (`../core/ai-plan.ts`, which says how calls,
 * splits, retries and budgets work), and checked by `plan-checks.ts`.
 *
 * The call cap and output budget are sized from the import's own chunks and never above
 * `QSF_MAX_AI_CALLS` and `QSF_MAX_OUTPUT_TOKENS`, so a hostile file cannot cost more than the costliest
 * valid one. Past either, the prompt budget or the deadline, the questions left are dropped with a
 * report line — never "split it in Qualtrics" — and the import fails only when none survives
 * (ENG-3411).
 */

/** Data characters per chunk: one call's cap, less room for the system prompt and instructions. */
const QSF_CHUNK_DATA_CHARS = QSF_PROMPT_MAX_CALL_CHARS - 20_000;
/**
 * Expected output tokens, measured on hand-authored plans: about 70 per question with every field
 * spelled out, 45 per logic note and 10 for a page's entry.
 */
const TOKENS_PER_QUESTION = 70;
const TOKENS_PER_NOTE = 45;
const TOKENS_PER_PAGE = 10;

/**
 * Chunks of the costliest valid survey: the reader's 200 questions, each on its own page, every
 * question and page with as many rules as the loosest prompt describes (3) — 70 + 10 + 2 × 3 × 45 =
 * 350 expected tokens a question, 70,000 in all, in 1,400-token chunks: 50.
 */
const QSF_MAX_CHUNKS = Math.ceil(
  (SURVEY_IMPORT_MAX_QUESTIONS *
    (TOKENS_PER_QUESTION + TOKENS_PER_PAGE + 2 * TOKENS_PER_NOTE * QSF_LOOSEST_PROMPT_LIMITS.rules)) /
    SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS
);

/**
 * The ceilings, whatever the file: the costliest valid survey's own allowance, so a hostile file
 * cannot cost more than it. 152 calls (3 × 50 + 2) and 835,584 output tokens ((2 × 50 + 2) × 8,192) —
 * every call's whole budget, reasoning included, for a survey expected to need 70,000.
 */
export const QSF_MAX_AI_CALLS = importCallCapFor(QSF_MAX_CHUNKS);
export const QSF_MAX_OUTPUT_TOKENS = importOutputBudgetFor(QSF_MAX_CHUNKS);

/** The model call, as the Qualtrics plan sends it. */
export type TQsfPlanRequest = TImportPlanRequest;
export type TQsfPlanGenerate = TImportPlanGenerate;

export interface TQsfPlanResult {
  plan: TQsfCheckedPlan;
  issues: TSurveyImportPipelineIssue[];
  usage: TImportPlanUsage;
  calls: number;
}

/** What chunking reads: the survey, its texts and the prompt's limits. */
interface TQsfChunkContext {
  survey: TQsfSurvey;
  texts: TQsfPromptTexts;
  limits: TQsfPromptLimits;
}

/** What a question adds to a chunk: expected output tokens and prompt characters. */
function questionCost(context: TQsfChunkContext, ref: string, pagesSeen: Set<string>) {
  const question = context.survey.questions.get(ref);
  if (!question) return { tokens: 0, chars: 0 };
  let tokens = TOKENS_PER_QUESTION + TOKENS_PER_NOTE * describedRuleCount(question.logic, context.limits);
  if (!pagesSeen.has(question.pageId)) {
    pagesSeen.add(question.pageId);
    const page = context.survey.pages.find((candidate) => candidate.id === question.pageId);
    if (page && page.logic.length > 0) {
      tokens += TOKENS_PER_PAGE + TOKENS_PER_NOTE * describedRuleCount(page.logic, context.limits);
    }
  }
  return { tokens, chars: describedQuestionChars(question, context.texts, context.limits) };
}

/**
 * Group questions into chunks of at most `SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS` expected output and
 * `QSF_CHUNK_DATA_CHARS` of prompt data, in survey order, as many as it takes. A page bigger than a
 * chunk is split across chunks; the assembly still makes it one block.
 */
export function chunkQuestions(context: TQsfChunkContext, refs: readonly string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let tokens = 0;
  let chars = 0;
  let pagesSeen = new Set<string>();

  for (const ref of refs) {
    const cost = questionCost(context, ref, pagesSeen);
    if (
      current.length > 0 &&
      (tokens + cost.tokens > SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS ||
        chars + cost.chars > QSF_CHUNK_DATA_CHARS)
    ) {
      chunks.push(current);
      current = [];
      // The question opens the next chunk, and its page's notes are asked there.
      pagesSeen = new Set();
      const reopened = questionCost(context, ref, pagesSeen);
      current.push(ref);
      tokens = reopened.tokens;
      chars = reopened.chars;
      continue;
    }
    current.push(ref);
    tokens += cost.tokens;
    chars += cost.chars;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function preSkip(survey: TQsfSurvey): { refs: string[]; issues: TSurveyImportPipelineIssue[] } {
  const refs: string[] = [];
  const issues: TSurveyImportPipelineIssue[] = [];
  for (const question of survey.questions.values()) {
    const severity = unsupportedTypeSeverity(question);
    if (severity) {
      issues.push({
        code: "question_skipped",
        severity,
        questionTag: question.exportTag,
        questionRef: question.ref,
        params: { cause: "unsupported_type", qualtricsType: question.qualtricsType },
      });
    } else {
      refs.push(question.ref);
    }
  }
  return { refs, issues };
}

/**
 * Plan the import: every question the reader found ends up placed, skipped by the AI, or dropped with
 * a report line after its retry.
 */
export async function planQsfImport(params: {
  survey: TQsfSurvey;
  texts: TQsfPromptTexts;
  generate: TQsfPlanGenerate;
  signal: AbortSignal;
  /** When the import must be finished by, as `performance.now()` time. */
  deadline: number;
  /** Resolved per-call budget, before clipping it to the import deadline. */
  callTimeoutMs?: number;
}): Promise<TQsfPlanResult> {
  const { survey, texts, generate, deadline, callTimeoutMs = SURVEY_IMPORT_AI_CALL_TIMEOUT_MS } = params;
  const { refs, issues } = preSkip(survey);
  // Refused before any AI call when no limits fit the survey into the prompt budget.
  const limits = chooseQsfPromptLimits(survey, refs, texts);
  if (!limits) throw new SurveyImportFailedError("prompt_budget");

  const chunkContext: TQsfChunkContext = { survey, texts, limits };
  const chunkCount = chunkQuestions(chunkContext, refs).length;
  const lane: TImportPlanLane<TQsfPlanFailure, TQsfCheckedPlan> = {
    chunk: (chunkRefs) => chunkQuestions(chunkContext, chunkRefs),
    system: buildQsfPlanSystemPrompt(),
    schema: ZQsfImportPlanForAI,
    schemaName: "QualtricsImportPlan",
    schemaDescription: "How each question of a Qualtrics survey becomes a Formbricks question.",
    buildPrompt: (chunkRefs, failures) =>
      buildQsfPlanPrompt({ survey, refs: chunkRefs, texts, limits, failures }),
    check: (responses) => checkPlanResponses(survey, responses),
    merge: mergeCheckedPlans,
    maxCallChars: QSF_PROMPT_MAX_CALL_CHARS,
    maxTotalChars: QSF_PROMPT_MAX_TOTAL_CHARS,
    callCap: Math.min(importCallCapFor(chunkCount), QSF_MAX_AI_CALLS),
    outputBudget: Math.min(importOutputBudgetFor(chunkCount), QSF_MAX_OUTPUT_TOKENS),
  };
  const run = await runImportPlan({ lane, refs, generate, signal: params.signal, deadline, callTimeoutMs });
  const { plan } = run;

  for (const [ref, description] of plan.skipped) {
    issues.push({
      code: "question_skipped",
      severity: "warning",
      questionTag: survey.questions.get(ref)?.exportTag ?? ref,
      questionRef: ref,
      params: { cause: "ai_skipped", ...(description ? { description } : {}) },
    });
  }
  for (const [ref, reasons] of plan.failures) {
    issues.push({
      code: "question_skipped",
      severity: "warning",
      questionTag: survey.questions.get(ref)?.exportTag ?? ref,
      questionRef: ref,
      params: { cause: importFailureCause(reasons) },
    });
  }

  // Nothing to assemble because time ran out — calls past their timeout, or calls the deadline left no
  // time for: to the user, the import took too long. Out of calls or tokens, it failed.
  if (
    plan.questions.size === 0 &&
    (run.ranOutOfTime || [...plan.failures.values()].some((reasons) => reasons.includes("ai_timeout")))
  ) {
    throw new SurveyImportTimeoutError();
  }

  return { plan, issues, usage: run.usage, calls: run.calls };
}
