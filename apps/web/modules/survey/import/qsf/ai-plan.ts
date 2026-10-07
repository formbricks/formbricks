import { NoObjectGeneratedError, NoOutputGeneratedError, TypeValidationError } from "ai";
import { AIOutputTokenLimitError } from "@formbricks/ai";
import type { TQsfImportIssue } from "../types";
import { QsfImportFailedError, QsfImportTimeoutError } from "./errors";
import { QSF_MAX_QUESTIONS } from "./limits";
import {
  type TQsfCheckedPlan,
  type TQsfPlanFailure,
  type TQsfPlanResponse,
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

/**
 * The AI half of the import (ENG-3479): ask for the plan, check it, retry what failed once.
 *
 * The questions are split into chunks by the output they are expected to need — a fixed budget per
 * chunk, as many chunks as the survey needs — and at most three run at once. The provider's
 * tokens-per-minute is the real limit there, and nothing in the app holds it back. Per chunk:
 *
 * - 429, provider auth and any other provider failure propagate unwrapped, and a shared abort cancels
 *   the sibling calls, so the route's classification keeps working;
 * - running out of output tokens is ours to fix: the chunk is split in two (once) and asked again,
 *   and never surfaces as "split it in Qualtrics";
 * - the AI SDK's own timeout (which spans its retries, and which the SDK's abort check does not
 *   match) becomes `QsfImportTimeoutError`, the route's timeout event;
 * - output that fails the schema fails the chunk's questions, which go to the retry round.
 *
 * Every call counts against a cap — chunks, splits and the retry round together — sized from the
 * import's own chunks and never above `QSF_MAX_AI_CALLS`, so a hostile file cannot cost more than the
 * costliest valid one. Past the cap, the prompt budget or the deadline, the questions left are
 * dropped with a report line; the import fails only when none survives (ENG-3411).
 */

/** The model's output budget per call. Room for reasoning tokens as well as the plan. */
export const QSF_PLAN_MAX_OUTPUT_TOKENS = 8192;
/**
 * Output a chunk is sized to expect. Reasoning models (Gemini 2.5 Flash, the default) spend part of
 * the same 8,192-token budget thinking before they write, and Create with AI needs that headroom for
 * its ~3–4k-token drafts; 3,000 keeps more than 60% of the budget for reasoning and for a plan that
 * runs long. About 40 questions without logic, or 15 with two rules each.
 */
export const QSF_CHUNK_OUTPUT_TOKENS = 3_000;
/** Data characters per chunk: one call's cap, less room for the system prompt and instructions. */
const QSF_CHUNK_DATA_CHARS = QSF_PROMPT_MAX_CALL_CHARS - 20_000;
/** Calls in flight at once, per import. */
export const QSF_MAX_PARALLEL_CALLS = 3;
/** One call's time budget. */
export const QSF_AI_CALL_TIMEOUT_MS = 45_000;
/** Time kept back for assembly when a call is sized against the deadline. */
export const QSF_ASSEMBLY_RESERVE_MS = 5_000;

/**
 * Expected output tokens, measured on hand-authored plans: about 70 per question with every field
 * spelled out, 45 per logic note and 10 for a page's entry.
 */
const TOKENS_PER_QUESTION = 70;
const TOKENS_PER_NOTE = 45;
const TOKENS_PER_PAGE = 10;

/**
 * Calls one import may make: each chunk once, each split into two halves, and two more for the retry
 * round — `3 × chunks + 2`, which a survey whose every chunk overflows still fits.
 */
const callCapFor = (chunks: number): number => 3 * chunks + 2;

/**
 * The ceiling on calls, whatever the file: the cap of the costliest valid survey — the reader's
 * question limit, each question on its own page, every question and page with as many rules as the
 * prompt describes at its loosest.
 */
export const QSF_MAX_AI_CALLS = callCapFor(
  Math.ceil(
    (QSF_MAX_QUESTIONS *
      (TOKENS_PER_QUESTION + TOKENS_PER_PAGE + 2 * TOKENS_PER_NOTE * QSF_LOOSEST_PROMPT_LIMITS.rules)) /
      QSF_CHUNK_OUTPUT_TOKENS
  )
);

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
) => Promise<{ object: unknown; usage?: TQsfCallUsage }>;

/** Usage as the AI SDK reports it. `outputTokens` is the total, reasoning included. */
interface TQsfCallUsage {
  inputTokens?: number;
  outputTokens?: number;
  outputTokenDetails?: { textTokens?: number; reasoningTokens?: number };
}

/**
 * The output tokens a call used, reasoning included: the reported total, or its parts when a provider
 * reports only those.
 */
const outputTokensOf = (usage: TQsfCallUsage | undefined): number =>
  usage?.outputTokens ??
  (usage?.outputTokenDetails?.textTokens ?? 0) + (usage?.outputTokenDetails?.reasoningTokens ?? 0);

/**
 * What a failed call used, read from the error's token counts only — never its text, which can echo
 * the prompt. A call that ran out of output tokens used its whole budget unless it says otherwise.
 */
function usageOfFailure(error: unknown): TQsfCallUsage | undefined {
  if (error instanceof AIOutputTokenLimitError) {
    // Reasoning is part of the total, so a reported reasoning count alone says less than the limit hit.
    const { outputTokens, maxOutputTokens } = error.details;
    return { outputTokens: outputTokens ?? maxOutputTokens ?? QSF_PLAN_MAX_OUTPUT_TOKENS };
  }
  if (NoObjectGeneratedError.isInstance(error)) {
    return error.usage
      ? {
          inputTokens: error.usage.inputTokens,
          outputTokens: error.usage.outputTokens,
          outputTokenDetails: error.usage.outputTokenDetails,
        }
      : undefined;
  }
  return undefined;
}

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
  /** Prompt characters sent so far, system prompts included. */
  promptChars: number;
  generate: TQsfPlanGenerate;
  signal: AbortSignal;
  usage: TQsfPlanUsage;
  calls: number;
  callCap: number;
}

type TCallOutcome =
  | { kind: "ok"; response: TQsfPlanResponse }
  | { kind: "too_long" }
  | { kind: "invalid" }
  /** Not sent: the import's call cap, prompt budget or time is spent. */
  | { kind: "budget" };

const isTimeoutError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "TimeoutError" || (error.cause instanceof Error && error.cause.name === "TimeoutError"));

const isInvalidOutput = (error: unknown): boolean =>
  NoObjectGeneratedError.isInstance(error) ||
  NoOutputGeneratedError.isInstance(error) ||
  TypeValidationError.isInstance(error);

/** What a question adds to a chunk: expected output tokens and prompt characters. */
function questionCost(
  context: Pick<TPlanContext, "survey" | "texts" | "limits">,
  ref: string,
  pagesSeen: Set<string>
) {
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
 * Group questions into chunks of at most `QSF_CHUNK_OUTPUT_TOKENS` expected output and
 * `QSF_CHUNK_DATA_CHARS` of prompt data, in survey order, as many as it takes. A page bigger than a
 * chunk is split across chunks; the assembly still makes it one block.
 */
export function chunkQuestions(
  context: Pick<TPlanContext, "survey" | "texts" | "limits">,
  refs: readonly string[]
): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let tokens = 0;
  let chars = 0;
  let pagesSeen = new Set<string>();

  for (const ref of refs) {
    const cost = questionCost(context, ref, pagesSeen);
    if (
      current.length > 0 &&
      (tokens + cost.tokens > QSF_CHUNK_OUTPUT_TOKENS || chars + cost.chars > QSF_CHUNK_DATA_CHARS)
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

function addUsage(context: TPlanContext, usage: TQsfCallUsage | undefined): void {
  context.usage.inputTokens += usage?.inputTokens ?? 0;
  context.usage.outputTokens += outputTokensOf(usage);
}

async function callOnce(
  context: TPlanContext,
  refs: string[],
  timeout: number,
  failures?: ReadonlyMap<string, readonly TQsfPlanFailure[]>
): Promise<TCallOutcome> {
  if (context.calls >= context.callCap || timeout <= 0) return { kind: "budget" };

  const system = buildQsfPlanSystemPrompt();
  const prompt = buildQsfPlanPrompt({
    survey: context.survey,
    refs,
    texts: context.texts,
    limits: context.limits,
    failures,
  });
  // Never send an over-budget prompt: too big for one call means smaller calls; past the import's
  // total, what is left goes unplanned.
  const size = system.length + prompt.length;
  if (size > QSF_PROMPT_MAX_CALL_CHARS) return { kind: "too_long" };
  if (context.promptChars + size > QSF_PROMPT_MAX_TOTAL_CHARS) return { kind: "budget" };
  context.promptChars += size;
  context.calls += 1;

  try {
    const result = await context.generate({
      system,
      prompt,
      schema: ZQsfImportPlanForAI,
      schemaName: "QualtricsImportPlan",
      schemaDescription: "How each question of a Qualtrics survey becomes a Formbricks question.",
      temperature: 0,
      maxOutputTokens: QSF_PLAN_MAX_OUTPUT_TOKENS,
      timeout,
      abortSignal: context.signal,
    });
    addUsage(context, result.usage);
    return { kind: "ok", response: { refs: new Set(refs), object: result.object } };
  } catch (error) {
    // A call that failed still spent tokens — one that ran out of them spent all 8,192.
    addUsage(context, usageOfFailure(error));
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
  timeout: () => number,
  failures?: ReadonlyMap<string, readonly TQsfPlanFailure[]>
): Promise<{ responses: TQsfPlanResponse[]; failed: Map<string, TQsfPlanFailure[]> }> {
  const responses: TQsfPlanResponse[] = [];
  const failed = new Map<string, TQsfPlanFailure[]>();
  const fail = (chunkRefs: string[], outcome: TCallOutcome) => {
    const reason: TQsfPlanFailure = outcome.kind === "budget" ? "ai_budget" : "invalid_output";
    for (const ref of chunkRefs) failed.set(ref, [reason]);
  };

  // The timeout is sized again for every call: a chunk and its two halves run one after another.
  const outcome = await callOnce(context, refs, timeout(), failures);
  if (outcome.kind === "ok") {
    responses.push(outcome.response);
  } else if (outcome.kind !== "too_long" || refs.length === 1) {
    fail(refs, outcome);
  } else {
    const middle = Math.ceil(refs.length / 2);
    for (const half of [refs.slice(0, middle), refs.slice(middle)]) {
      const halfOutcome = await callOnce(context, half, timeout(), failures);
      if (halfOutcome.kind === "ok") responses.push(halfOutcome.response);
      else fail(half, halfOutcome);
    }
  }

  return { responses, failed };
}

async function planRound(
  context: TPlanContext,
  chunks: string[][],
  timeout: () => number,
  abort: AbortController,
  failures?: ReadonlyMap<string, readonly TQsfPlanFailure[]>
): Promise<TQsfCheckedPlan> {
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
  // Refused before any AI call when no limits fit the survey into the prompt budget.
  const limits = chooseQsfPromptLimits(survey, refs, texts);
  if (!limits) throw new QsfImportFailedError("prompt_budget");

  const abort = new AbortController();
  const context: TPlanContext = {
    survey,
    texts,
    limits,
    promptChars: 0,
    generate,
    signal: AbortSignal.any([params.signal, abort.signal]),
    usage: { inputTokens: 0, outputTokens: 0 },
    calls: 0,
    callCap: 0,
  };
  const chunks = chunkQuestions(context, refs);
  context.callCap = Math.min(callCapFor(chunks.length), QSF_MAX_AI_CALLS);

  const callTimeout = () =>
    Math.min(QSF_AI_CALL_TIMEOUT_MS, Math.floor(deadline - performance.now() - QSF_ASSEMBLY_RESERVE_MS));

  let plan = await planRound(context, chunks, callTimeout, abort);

  // A question the budget left unplanned is not retried: there is no budget left to retry it with.
  const unplanned = new Map([...plan.failures].filter(([, reasons]) => reasons.includes("ai_budget")));
  const failing = [...plan.failures.keys()].filter((ref) => !unplanned.has(ref));
  if (failing.length > 0) {
    const retry = await planRound(
      context,
      chunkQuestions(context, failing),
      callTimeout,
      abort,
      plan.failures
    );
    plan = mergeCheckedPlans(plan, retry);
    for (const [ref, reasons] of unplanned) plan.failures.set(ref, reasons);
  }

  for (const [ref, description] of plan.skipped) {
    issues.push({
      code: "question_skipped",
      severity: "warning",
      questionTag: survey.questions.get(ref)?.exportTag ?? ref,
      params: { cause: "ai_skipped", ...(description ? { description } : {}) },
    });
  }
  for (const [ref, reasons] of plan.failures) {
    issues.push({
      code: "question_skipped",
      severity: "warning",
      questionTag: survey.questions.get(ref)?.exportTag ?? ref,
      params: { cause: reasons.includes("ai_budget") ? "ai_budget" : "plan_invalid" },
    });
  }

  return { plan, issues, usage: context.usage, calls: context.calls };
}
