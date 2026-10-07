import { NoObjectGeneratedError, NoOutputGeneratedError, TypeValidationError } from "ai";
import { AIOutputTokenLimitError } from "@formbricks/ai";
import type { TQsfImportIssue } from "../types";
import { QsfImportFailedError, QsfImportTimeoutError } from "./errors";
import {
  type TQsfCheckedPlan,
  type TQsfPlanFailure,
  type TQsfPlanResponse,
  checkPlanResponses,
  mergeCheckedPlans,
} from "./plan-checks";
import { ZQsfImportPlanForAI } from "./plan-schema";
import {
  type TQsfPromptLimits,
  type TQsfPromptTexts,
  buildQsfPlanPrompt,
  buildQsfPlanSystemPrompt,
  chooseQsfPromptLimits,
} from "./prompt";
import type { TQsfSurvey } from "./qsf-model";

/**
 * The AI half of the import (ENG-3479): ask for the plan, check it, retry what failed once.
 *
 * The questions are split into chunks by the output they are expected to need, and up to three run
 * in parallel. The provider's tokens-per-minute is the real limit there, and nothing in the app holds
 * it back, so the cap stays small. Per chunk:
 *
 * - 429, provider auth and any other provider failure propagate unwrapped, and a shared abort cancels
 *   the sibling calls, so the route's classification keeps working;
 * - running out of output tokens is ours to fix: the chunk is split in two (once) and asked again,
 *   and never surfaces as "split it in Qualtrics";
 * - the AI SDK's own timeout (which spans its retries, and which the SDK's abort check does not
 *   match) becomes `QsfImportTimeoutError`, the route's timeout event;
 * - output that fails the schema fails the chunk's questions, which go to the retry round.
 *
 * Every call counts against `QSF_MAX_AI_CALLS` — chunks, splits and the retry round together — so a
 * hostile file cannot multiply provider cost. Hitting it fails the import.
 */

/** The model's output budget per call. Room for reasoning tokens as well as the plan. */
export const QSF_PLAN_MAX_OUTPUT_TOKENS = 8192;
/** Output a chunk is sized to expect: well under the budget, which reasoning shares. */
export const QSF_CHUNK_OUTPUT_TOKENS = 3_000;
/** Chunks of the first round. */
export const QSF_MAX_INITIAL_CHUNKS = 3;
/** Calls in flight at once, per import. */
export const QSF_MAX_PARALLEL_CALLS = 3;
/** Calls per import, everything included. */
export const QSF_MAX_AI_CALLS = 8;
/** One call's time budget. */
export const QSF_AI_CALL_TIMEOUT_MS = 45_000;
/** Time kept back for assembly when a retry round is sized against the deadline. */
export const QSF_ASSEMBLY_RESERVE_MS = 5_000;

/**
 * Expected output tokens, measured on hand-authored plans: about 70 per question with every field
 * spelled out, 45 per logic note, 15 per block and 45 per page note.
 */
const TOKENS_PER_QUESTION = 70;
const TOKENS_PER_NOTE = 45;
const TOKENS_PER_BLOCK = 15;

/**
 * Qualtrics types Formbricks has no element for. Skipped without asking the model: fewer tokens, and
 * the severity is ours to set.
 */
const UNSUPPORTED_TYPES: ReadonlyMap<string, TQsfImportIssue["severity"]> = new Map([
  ["CS", "warning"],
  ["SBS", "warning"],
  ["HeatMap", "warning"],
  ["HotSpot", "warning"],
  ["DD", "warning"],
  ["PGR", "warning"],
  ["Highlight", "warning"],
  ["Signature", "warning"],
  ["Draw", "warning"],
  ["GAP", "warning"],
  ["Timing", "info"],
  ["Meta", "info"],
  ["Captcha", "info"],
]);

/** One structured-output call, as the plan needs it. */
export interface TQsfPlanRequest {
  system: string;
  prompt: string;
  schema: typeof ZQsfImportPlanForAI;
  schemaName: string;
  schemaDescription: string;
  temperature: number;
  maxOutputTokens: number;
  timeout: number;
  abortSignal: AbortSignal;
}

export interface TQsfPlanUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * The model call. The pipeline passes the organization's (`generateOrganizationAIObject`); the eval
 * script passes one built from the environment.
 */
export type TQsfPlanGenerate = (
  request: TQsfPlanRequest
) => Promise<{ object: unknown; usage?: { inputTokens?: number; outputTokens?: number } }>;

export interface TQsfPlanResult {
  plan: TQsfCheckedPlan;
  issues: TQsfImportIssue[];
  usage: TQsfPlanUsage;
  calls: number;
}

interface TPlanContext {
  survey: TQsfSurvey;
  texts: TQsfPromptTexts;
  limits: TQsfPromptLimits;
  generate: TQsfPlanGenerate;
  signal: AbortSignal;
  usage: TQsfPlanUsage;
  calls: number;
}

type TCallOutcome = { kind: "ok"; response: TQsfPlanResponse } | { kind: "too_long" } | { kind: "invalid" };

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "TimeoutError" || (error.cause instanceof Error && error.cause.name === "TimeoutError"));

const isInvalidOutput = (error: unknown): boolean =>
  NoObjectGeneratedError.isInstance(error) ||
  NoOutputGeneratedError.isInstance(error) ||
  TypeValidationError.isInstance(error);

const expectedOutputTokens = (survey: TQsfSurvey, refs: readonly string[]): number => {
  const pages = new Set<string>();
  let tokens = 0;
  for (const ref of refs) {
    const question = survey.questions.get(ref);
    if (!question) continue;
    tokens += TOKENS_PER_QUESTION + TOKENS_PER_NOTE * question.logic.length;
    if (!pages.has(question.pageId)) {
      pages.add(question.pageId);
      const page = survey.pages.find((candidate) => candidate.id === question.pageId);
      tokens += TOKENS_PER_BLOCK + TOKENS_PER_NOTE * (page?.logic.length ?? 0);
    }
  }
  return tokens;
};

/**
 * Group questions into chunks of about `budget` expected output tokens, breaking at page boundaries
 * where it can. A page bigger than a chunk is split across chunks. Never more than `maxChunks`: the
 * budget grows until the survey fits.
 */
export function chunkQuestions(
  survey: TQsfSurvey,
  refs: readonly string[],
  maxChunks: number,
  budget = QSF_CHUNK_OUTPUT_TOKENS
): string[][] {
  if (refs.length === 0) return [];
  const byPage = new Map<string, string[]>();
  for (const ref of refs) {
    const pageId = survey.questions.get(ref)?.pageId ?? "";
    byPage.set(pageId, [...(byPage.get(pageId) ?? []), ref]);
  }

  for (let attempt = budget; ; attempt = Math.ceil(attempt * 1.25)) {
    const chunks: string[][] = [];
    let current: string[] = [];
    for (const pageRefs of byPage.values()) {
      if (current.length > 0 && expectedOutputTokens(survey, [...current, ...pageRefs]) > attempt) {
        chunks.push(current);
        current = [];
      }
      for (const ref of pageRefs) {
        if (current.length > 0 && expectedOutputTokens(survey, [...current, ref]) > attempt) {
          chunks.push(current);
          current = [];
        }
        current.push(ref);
      }
    }
    if (current.length > 0) chunks.push(current);
    if (chunks.length <= maxChunks) return chunks;
  }
}

/** Run tasks, `limit` at a time. The first failure aborts the rest and is rethrown once they settle. */
async function runPool<T>(tasks: (() => Promise<T>)[], limit: number, abort: AbortController): Promise<T[]> {
  const results: T[] = new Array<T>(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  };
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  try {
    await Promise.all(workers);
  } catch (error) {
    abort.abort();
    await Promise.allSettled(workers);
    throw error;
  }
  return results;
}

async function callOnce(
  context: TPlanContext,
  refs: string[],
  timeout: number,
  failures?: ReadonlyMap<string, readonly TQsfPlanFailure[]>
): Promise<TCallOutcome> {
  if (context.calls >= QSF_MAX_AI_CALLS) throw new QsfImportFailedError("ai_call_budget");
  context.calls += 1;

  try {
    const result = await context.generate({
      system: buildQsfPlanSystemPrompt(),
      prompt: buildQsfPlanPrompt({
        survey: context.survey,
        refs,
        texts: context.texts,
        limits: context.limits,
        failures,
      }),
      schema: ZQsfImportPlanForAI,
      schemaName: "QualtricsImportPlan",
      schemaDescription: "How each question of a Qualtrics survey becomes a Formbricks question.",
      temperature: 0,
      maxOutputTokens: QSF_PLAN_MAX_OUTPUT_TOKENS,
      timeout,
      abortSignal: context.signal,
    });
    context.usage.inputTokens += result.usage?.inputTokens ?? 0;
    context.usage.outputTokens += result.usage?.outputTokens ?? 0;
    return { kind: "ok", response: { refs: new Set(refs), object: result.object } };
  } catch (error) {
    // The import's own abort (Stop, disconnect, the route's deadline) is the route's to classify.
    if (context.signal.aborted) throw error;
    if (isTimeoutError(error)) throw new QsfImportTimeoutError();
    if (error instanceof AIOutputTokenLimitError) return { kind: "too_long" };
    if (isInvalidOutput(error)) return { kind: "invalid" };
    throw error;
  }
}

/** One chunk: a call, and one split into halves when the output did not fit. */
async function planChunk(
  context: TPlanContext,
  refs: string[],
  timeout: number,
  failures?: ReadonlyMap<string, readonly TQsfPlanFailure[]>
): Promise<{ responses: TQsfPlanResponse[]; failed: Map<string, TQsfPlanFailure[]> }> {
  const responses: TQsfPlanResponse[] = [];
  const failed = new Map<string, TQsfPlanFailure[]>();
  const fail = (chunkRefs: string[]) => {
    for (const ref of chunkRefs) failed.set(ref, ["invalid_output"]);
  };

  const outcome = await callOnce(context, refs, timeout, failures);
  if (outcome.kind === "ok") {
    responses.push(outcome.response);
  } else if (outcome.kind === "invalid" || refs.length === 1) {
    fail(refs);
  } else {
    const middle = Math.ceil(refs.length / 2);
    for (const half of [refs.slice(0, middle), refs.slice(middle)]) {
      const halfOutcome = await callOnce(context, half, timeout, failures);
      if (halfOutcome.kind === "ok") responses.push(halfOutcome.response);
      else fail(half);
    }
  }

  return { responses, failed };
}

async function planRound(
  context: TPlanContext,
  refs: string[],
  maxChunks: number,
  timeout: number,
  abort: AbortController,
  failures?: ReadonlyMap<string, readonly TQsfPlanFailure[]>
): Promise<TQsfCheckedPlan> {
  const chunks = chunkQuestions(context.survey, refs, maxChunks);
  const outcomes = await runPool(
    chunks.map((chunk) => () => planChunk(context, chunk, timeout, failures)),
    QSF_MAX_PARALLEL_CALLS,
    abort
  );

  const plan = checkPlanResponses(
    context.survey,
    outcomes.flatMap((outcome) => outcome.responses)
  );
  for (const outcome of outcomes) {
    for (const [ref, reasons] of outcome.failed) plan.failures.set(ref, reasons);
  }
  return plan;
}

function preSkip(survey: TQsfSurvey): { refs: string[]; issues: TQsfImportIssue[] } {
  const refs: string[] = [];
  const issues: TQsfImportIssue[] = [];
  for (const question of survey.questions.values()) {
    const severity = UNSUPPORTED_TYPES.get(question.qualtricsType);
    if (severity) {
      issues.push({
        code: "question_skipped",
        severity,
        questionTag: question.exportTag,
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
}): Promise<TQsfPlanResult> {
  const { survey, texts, generate, deadline } = params;
  const { refs, issues } = preSkip(survey);
  const abort = new AbortController();
  const context: TPlanContext = {
    survey,
    texts,
    limits: chooseQsfPromptLimits(survey, refs, texts),
    generate,
    signal: AbortSignal.any([params.signal, abort.signal]),
    usage: { inputTokens: 0, outputTokens: 0 },
    calls: 0,
  };

  const callTimeout = () =>
    Math.min(QSF_AI_CALL_TIMEOUT_MS, Math.floor(deadline - performance.now() - QSF_ASSEMBLY_RESERVE_MS));

  let plan = await planRound(context, refs, QSF_MAX_INITIAL_CHUNKS, Math.max(callTimeout(), 1), abort);

  const failing = [...plan.failures.keys()];
  const retryTimeout = callTimeout();
  if (failing.length > 0 && retryTimeout > 0) {
    const remaining = Math.max(QSF_MAX_AI_CALLS - context.calls, 1);
    const retry = await planRound(context, failing, remaining, retryTimeout, abort, plan.failures);
    plan = mergeCheckedPlans(plan, retry);
  }

  for (const [ref, description] of plan.skipped) {
    issues.push({
      code: "question_skipped",
      severity: "warning",
      questionTag: survey.questions.get(ref)?.exportTag ?? ref,
      params: { cause: "ai_skipped", ...(description ? { description } : {}) },
    });
  }
  for (const ref of plan.failures.keys()) {
    issues.push({
      code: "question_skipped",
      severity: "warning",
      questionTag: survey.questions.get(ref)?.exportTag ?? ref,
      params: { cause: "plan_invalid" },
    });
  }

  return { plan, issues, usage: context.usage, calls: context.calls };
}
