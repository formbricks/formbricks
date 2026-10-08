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
 * chunk, as many chunks as the survey needs — and at most four run at once. The provider's
 * tokens-per-minute is the real limit there, and nothing in the app holds it back. Per chunk:
 *
 * - 429, provider auth and any other provider failure propagate unwrapped, and a shared abort cancels
 *   the sibling calls, so the route's classification keeps working;
 * - running out of output tokens, or out of the call's own time (the AI SDK's `timeout`, which spans
 *   its retries and which its abort check does not match), is ours to fix: the chunk is split in two
 *   (once) and each half asked again, queued behind the other chunks. A half that fails the same way
 *   is dropped with a report line — never "split it in Qualtrics", and never the end of the import;
 * - output that fails the schema fails the chunk's questions, which go to the retry round.
 *
 * Only the import's own signal ends the import: Stop, a disconnect, or the route's deadline. Each call's
 * timeout is sized to what is left before that deadline, less the assembly reserve, so the calls left
 * when time runs out are dropped and the questions planned so far are still assembled. Only when time
 * ran out before any question was planned is it `QsfImportTimeoutError`, the route's timeout event.
 *
 * Every call counts against a call cap and an output-token budget — chunks, splits and the retry
 * round together, failed calls included — sized from the import's own chunks and never above
 * `QSF_MAX_AI_CALLS` and `QSF_MAX_OUTPUT_TOKENS`, so a hostile file cannot cost more than the costliest
 * valid one. Past either, the prompt budget or the deadline, the questions left are dropped with a
 * report line; the import fails only when none survives (ENG-3411).
 */

/** The model's output budget per call. Room for reasoning tokens as well as the plan. */
export const QSF_PLAN_MAX_OUTPUT_TOKENS = 8192;
/**
 * Output a chunk is sized to expect: about 20 questions without logic, or 8 with two rules each.
 *
 * Sized by time, not by the 8,192-token budget. Gemini 2.5 Flash, the default, writes about 150–250
 * tokens a second with its thinking included, and thinks up to about 3,000 tokens before a plan. At
 * the slow end a chunk then takes about 2 s + (3,000 + 1,400) / 150 ≈ 31 s, well inside the 45 s call
 * timeout; a 3,000-token chunk took about 42 s, and on a live run one timed out.
 */
export const QSF_CHUNK_OUTPUT_TOKENS = 1_400;
/** Data characters per chunk: one call's cap, less room for the system prompt and instructions. */
const QSF_CHUNK_DATA_CHARS = QSF_PROMPT_MAX_CALL_CHARS - 20_000;
/**
 * Calls in flight at once, per import. The 150-question survey the import is built for is 8 chunks
 * (about 10,500 expected tokens): two waves of at most ~31 s, then a retry wave, about 95 s — inside the
 * route's 120 s deadline less the assembly reserve. Three at a time would take three waves before the
 * retry, which would not fit. Bounded, because the provider's tokens-per-minute is the real limit: four
 * calls of at most ~30k prompt tokens each.
 */
export const QSF_MAX_PARALLEL_CALLS = 4;
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
 * Chunks of the costliest valid survey: the reader's 200 questions, each on its own page, every
 * question and page with as many rules as the loosest prompt describes (3) — 70 + 10 + 2 × 3 × 45 =
 * 350 expected tokens a question, 70,000 in all, in 1,400-token chunks: 50.
 */
const QSF_MAX_CHUNKS = Math.ceil(
  (QSF_MAX_QUESTIONS *
    (TOKENS_PER_QUESTION + TOKENS_PER_PAGE + 2 * TOKENS_PER_NOTE * QSF_LOOSEST_PROMPT_LIMITS.rules)) /
    QSF_CHUNK_OUTPUT_TOKENS
);

/**
 * Calls one import may make: each chunk once, each split into two halves, and two more for the retry
 * round — `3 × chunks + 2`, which a survey whose every chunk overflows or times out still fits.
 */
const callCapFor = (chunks: number): number => 3 * chunks + 2;

/**
 * Output tokens one import may spend, reasoning and failed calls included: every chunk's whole call
 * budget twice (an overflow, then its halves or its retry), and two more calls for the retry round —
 * `(2 × chunks + 2) × 8,192`. Checked before each call, so at most the calls already in flight run
 * past it.
 */
const outputBudgetFor = (chunks: number): number => (2 * chunks + 2) * QSF_PLAN_MAX_OUTPUT_TOKENS;

/**
 * The ceilings, whatever the file: the costliest valid survey's own allowance, so a hostile file
 * cannot cost more than it. 152 calls (3 × 50 + 2) and 835,584 output tokens ((2 × 50 + 2) × 8,192) —
 * every call's whole budget, reasoning included, for a survey expected to need 70,000.
 */
export const QSF_MAX_AI_CALLS = callCapFor(QSF_MAX_CHUNKS);
export const QSF_MAX_OUTPUT_TOKENS = outputBudgetFor(QSF_MAX_CHUNKS);

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
  /** Output tokens this import may spend. */
  outputBudget: number;
}

type TCallOutcome =
  | { kind: "ok"; response: TQsfPlanResponse }
  | { kind: "too_long" }
  /** The call ran out of its own time; the import's signal had not fired. */
  | { kind: "timed_out" }
  | { kind: "invalid" }
  /** Not sent: the import's call cap, prompt budget or time is spent. */
  | { kind: "budget" };

const CALL_TIMEOUT_ERROR_NAMES: ReadonlySet<string> = new Set(["TimeoutError", "AbortError"]);

/**
 * Whether a call failed because its own `timeout` fired. Asked only once the import's own signal is
 * known not to have fired, so the call's timeout is the only abort left. The AI SDK reports it as a
 * `TimeoutError`, or — when the timeout fires during its retry backoff — as the backoff delay's
 * `AbortError` ("Delay was aborted").
 */
const isCallTimeout = (error: unknown): boolean =>
  error instanceof Error &&
  (CALL_TIMEOUT_ERROR_NAMES.has(error.name) ||
    (error.cause instanceof Error && CALL_TIMEOUT_ERROR_NAMES.has(error.cause.name)));

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

/** A unit of work for `runPool`. It may queue more with `enqueue`: the halves of a split chunk. */
type TPoolTask = (enqueue: (task: TPoolTask) => void) => Promise<void>;

/**
 * Run tasks `limit` at a time, including the ones they queue, until none is left. The first failure
 * aborts the rest — the queued ones never start — and is rethrown once the running ones settle.
 */
async function runPool(tasks: TPoolTask[], limit: number, abort: AbortController): Promise<void> {
  const queue = [...tasks];
  const running = new Set<Promise<void>>();
  const enqueue = (task: TPoolTask) => queue.push(task);
  const state: { failure: { error: unknown } | null } = { failure: null };

  while (running.size > 0 || (queue.length > 0 && state.failure === null)) {
    while (state.failure === null && running.size < limit && queue.length > 0) {
      const task = queue.shift();
      if (!task) break;
      const run: Promise<void> = task(enqueue)
        .catch((error: unknown) => {
          if (state.failure !== null) return;
          state.failure = { error };
          abort.abort();
        })
        .finally(() => running.delete(run));
      running.add(run);
    }
    // A scheduler: it waits for one call to finish before it starts the next, by design.
    await Promise.race(running); // NOSONAR(typescript:S9382) -- the pool's bound on calls in flight
  }

  if (state.failure !== null) throw state.failure.error;
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
  if (
    context.calls >= context.callCap ||
    context.usage.outputTokens >= context.outputBudget ||
    timeout <= 0
  ) {
    return { kind: "budget" };
  }

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
    // The import's own abort (Stop, disconnect, the route's deadline, a sibling's failure) is the
    // route's to classify. Any other abort is this call's own timeout.
    if (context.signal.aborted) throw error;
    if (isCallTimeout(error)) return { kind: "timed_out" };
    if (error instanceof AIOutputTokenLimitError) return { kind: "too_long" };
    if (isInvalidOutput(error)) return { kind: "invalid" };
    throw error;
  }
}

const FAILURE_OF_OUTCOME: Record<Exclude<TCallOutcome["kind"], "ok">, TQsfPlanFailure> = {
  budget: "ai_budget",
  timed_out: "ai_timeout",
  too_long: "invalid_output",
  invalid: "invalid_output",
};

/**
 * One round of calls: every chunk asked, at most `QSF_MAX_PARALLEL_CALLS` at once. A chunk whose call
 * ran out of output tokens or of time is split into halves once, queued behind the rest; its halves
 * are not split again.
 */
async function planRound(
  context: TPlanContext,
  chunks: string[][],
  timeout: () => number,
  abort: AbortController,
  failures?: ReadonlyMap<string, readonly TQsfPlanFailure[]>
): Promise<TQsfCheckedPlan> {
  const responses: TQsfPlanResponse[] = [];
  const failed = new Map<string, TQsfPlanFailure[]>();

  const ask =
    (refs: string[], splittable: boolean): TPoolTask =>
    async (enqueue) => {
      // Sized when the call starts: a split's halves run later than the chunk did.
      const outcome = await callOnce(context, refs, timeout(), failures);
      if (outcome.kind === "ok") {
        responses.push(outcome.response);
        return;
      }
      if ((outcome.kind === "too_long" || outcome.kind === "timed_out") && splittable && refs.length > 1) {
        const middle = Math.ceil(refs.length / 2);
        enqueue(ask(refs.slice(0, middle), false));
        enqueue(ask(refs.slice(middle), false));
        return;
      }
      for (const ref of refs) failed.set(ref, [FAILURE_OF_OUTCOME[outcome.kind]]);
    };

  await runPool(
    chunks.map((chunk) => ask(chunk, true)),
    QSF_MAX_PARALLEL_CALLS,
    abort
  );

  const plan = checkPlanResponses(context.survey, responses);
  for (const [ref, reasons] of failed) plan.failures.set(ref, reasons);
  return plan;
}

/** The report's cause for a question the plan could not place. */
const failureCause = (reasons: readonly TQsfPlanFailure[]): "ai_budget" | "ai_timeout" | "plan_invalid" => {
  if (reasons.includes("ai_timeout")) return "ai_timeout";
  if (reasons.includes("ai_budget")) return "ai_budget";
  return "plan_invalid";
};

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
    outputBudget: 0,
  };
  const chunks = chunkQuestions(context, refs);
  context.callCap = Math.min(callCapFor(chunks.length), QSF_MAX_AI_CALLS);
  context.outputBudget = Math.min(outputBudgetFor(chunks.length), QSF_MAX_OUTPUT_TOKENS);

  const callTimeout = () =>
    Math.min(QSF_AI_CALL_TIMEOUT_MS, Math.floor(deadline - performance.now() - QSF_ASSEMBLY_RESERVE_MS));

  let plan = await planRound(context, chunks, callTimeout, abort);

  // A question the budget left unplanned, or whose calls ran out of time even split, is not retried:
  // there is no budget left to retry it with, or no reason to expect it to be faster.
  const unplanned = new Map(
    [...plan.failures].filter(
      ([, reasons]) => reasons.includes("ai_budget") || reasons.includes("ai_timeout")
    )
  );
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
      params: { cause: failureCause(reasons) },
    });
  }

  // Nothing to assemble because the calls ran out of time: to the user, the import took too long.
  if (
    plan.questions.size === 0 &&
    [...plan.failures.values()].some((reasons) => reasons.includes("ai_timeout"))
  ) {
    throw new QsfImportTimeoutError();
  }

  return { plan, issues, usage: context.usage, calls: context.calls };
}
