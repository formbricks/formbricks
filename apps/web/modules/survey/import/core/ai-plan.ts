import { NoObjectGeneratedError, NoOutputGeneratedError, TypeValidationError } from "ai";
import type { z } from "zod";
import { AIOutputTokenLimitError } from "@formbricks/ai";
import { SURVEY_IMPORT_AI_MAX_OUTPUT_TOKENS_PER_CALL, SURVEY_IMPORT_AI_MAX_PARALLEL_CALLS } from "../limits";
import { decideImportCallRetry, waitForRetry } from "./call-retry";

/**
 * The AI half of every import lane that plans with AI (ENG-3479, ENG-6852): ask for the plan in chunks,
 * check it, retry what failed once. The lane says what a unit of work is (a Qualtrics question, a line of
 * a document), how its units are chunked, what the prompt says and how an answer is checked; this runs
 * the calls.
 *
 * The units are split into chunks by the output they are expected to need — a fixed budget per chunk,
 * as many chunks as the file needs — and at most four run at once. The provider's tokens-per-minute is
 * the real limit there, and nothing in the app holds it back. Per chunk:
 *
 * - a 429 or a 5xx is retried here, the SDK's own retries off (`call-retry.ts`): a 429 while its
 *   `Retry-After` fits in the call's time, a 5xx with backoff while the call has time left;
 * - a 429 that does not fit, provider auth and any other provider failure propagate unwrapped, and a
 *   shared abort cancels the sibling calls, so the route's classification keeps working;
 * - running out of output tokens, or out of the call's own time (the `timeout` its attempts share,
 *   which the AI SDK's abort check does not match, and a 5xx with no time left to retry it), is ours to
 *   fix: the chunk is split in two (once) and each half asked again, queued behind the other chunks. A
 *   half that fails the same way is dropped with a report line, never the end of the import;
 * - output that fails the schema fails the chunk's units, which go to the retry round.
 *
 * Only the import's own signal ends the import: Stop, a disconnect, or the route's deadline. Each call's
 * timeout is sized to what is left before that deadline, less the assembly reserve, so the calls left
 * when time runs out are dropped and the units planned so far are still assembled.
 *
 * Every call counts against a call cap and an output-token budget — chunks, splits and the retry round
 * together, failed calls included — sized by the lane from its own chunks and never above what its
 * costliest valid file needs, so a hostile file cannot cost more than that.
 */

/** Time kept back for assembly when a call is sized against the deadline. */
export const SURVEY_IMPORT_ASSEMBLY_RESERVE_MS = 5_000;
/**
 * The least time a call is sent with. Below it no plan can come back: the first token alone takes
 * 1–3 s, and even a 10-question half needs ~700 tokens and its thinking at 150–250 tokens a second.
 * Such a call would only time out after paying for its prompt, so its units are left unplanned
 * (`ai_budget`, like any call the import has no time left for).
 */
export const SURVEY_IMPORT_MIN_CALL_TIMEOUT_MS = 5_000;

/**
 * Calls one import may make: each chunk once, each split into two halves, and two more for the retry
 * round — `3 × chunks + 2`, which a file whose every chunk overflows or times out still fits.
 */
export const importCallCapFor = (chunks: number): number => 3 * chunks + 2;

/**
 * Output tokens one import may spend, reasoning and failed calls included: every chunk's whole call
 * budget twice (an overflow, then its halves or its retry), and two more calls for the retry round —
 * `(2 × chunks + 2) × 8,192`. Checked before each call, so at most the calls already in flight run
 * past it.
 */
export const importOutputBudgetFor = (chunks: number): number =>
  (2 * chunks + 2) * SURVEY_IMPORT_AI_MAX_OUTPUT_TOKENS_PER_CALL;

/** One structured-output call, as a plan needs it. */
export interface TImportPlanRequest<TSchema extends z.ZodType = z.ZodType> {
  system: string;
  prompt: string;
  schema: TSchema;
  schemaName: string;
  schemaDescription: string;
  temperature: number;
  maxOutputTokens: number;
  /** This attempt's time: what is left of the call's. */
  timeout: number;
  /** Always 0: the import retries its calls itself (`call-retry.ts`), the SDK must not. */
  maxRetries: 0;
  abortSignal: AbortSignal;
}

export interface TImportPlanUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Usage as the AI SDK reports it. `outputTokens` is the total, reasoning included. */
export interface TImportCallUsage {
  inputTokens?: number;
  outputTokens?: number;
  outputTokenDetails?: { textTokens?: number; reasoningTokens?: number };
}

/**
 * The model call. A lane's pipeline passes the organization's (`generateOrganizationAIObject`); an eval
 * script passes one built from the environment, and tests a recorded plan.
 */
export type TImportPlanGenerate<TSchema extends z.ZodType = z.ZodType> = (
  request: TImportPlanRequest<TSchema>
) => Promise<{ object: unknown; usage?: TImportCallUsage }>;

/** Why a unit was not planned by its calls, whatever the lane. */
export type TImportCallFailure =
  /** Never asked: the import's AI budget (calls, prompt size or time) ran out first. */
  | "ai_budget"
  /** Asked, but its call ran out of its own time, split into halves too. */
  | "ai_timeout"
  /** The answer could not be read: past the output tokens, or not the schema. */
  | "invalid_output";

/** One answered AI call: the units it was asked about and what came back. */
export interface TImportPlanResponse {
  refs: ReadonlySet<string>;
  object: unknown;
}

/** What a lane's checks make of a round of answers: at least each failed unit and why. */
export interface TImportCheckedPlan<TFailure extends string> {
  failures: Map<string, (TFailure | TImportCallFailure)[]>;
}

/** What a lane tells the engine about its file. */
export interface TImportPlanLane<TFailure extends string, TPlan extends TImportCheckedPlan<TFailure>> {
  /** The units of work, in file order, grouped into the chunks one call each is asked about. */
  chunk: (refs: readonly string[]) => string[][];
  system: string;
  schema: z.ZodType;
  schemaName: string;
  schemaDescription: string;
  /** The user message for one call about `refs`, with what went wrong in their previous round, if any. */
  buildPrompt: (
    refs: readonly string[],
    failures?: ReadonlyMap<string, readonly (TFailure | TImportCallFailure)[]>
  ) => string;
  /**
   * One round of answers, checked: every unit asked about is placed, skipped or failed with why.
   * `retry` is set on the retry round, the last chance a unit gets.
   */
  check: (responses: TImportPlanResponse[], round: { retry: boolean }) => TPlan;
  /** The retry round's verdicts over the first round's. */
  merge: (first: TPlan, retry: TPlan) => TPlan;
  /** One call's characters, system prompt included. Never sent above this. */
  maxCallChars: number;
  /** All calls' characters together. */
  maxTotalChars: number;
  /** Calls one import may make, and output tokens it may spend (`importCallCapFor` and friends). */
  callCap: number;
  outputBudget: number;
}

export interface TImportPlanRun<TPlan> {
  plan: TPlan;
  usage: TImportPlanUsage;
  calls: number;
  /** Whether a call was left unsent because the time before the deadline was too short for one. */
  ranOutOfTime: boolean;
}

interface TPlanContext<TFailure extends string, TPlan extends TImportCheckedPlan<TFailure>> {
  lane: TImportPlanLane<TFailure, TPlan>;
  /** Prompt characters sent so far, system prompts included. */
  promptChars: number;
  generate: TImportPlanGenerate;
  signal: AbortSignal;
  usage: TImportPlanUsage;
  calls: number;
  ranOutOfTime: boolean;
}

type TCallOutcome =
  | { kind: "ok"; response: TImportPlanResponse }
  | { kind: "too_long" }
  /** The call ran out of its own time; the import's signal had not fired. */
  | { kind: "timed_out" }
  | { kind: "invalid" }
  /** Not sent: the import's call cap, prompt budget or time is spent. */
  | { kind: "budget" };

/**
 * The output tokens a call used, reasoning included: the reported total, or its parts when a provider
 * reports only those.
 */
const outputTokensOf = (usage: TImportCallUsage | undefined): number =>
  usage?.outputTokens ??
  (usage?.outputTokenDetails?.textTokens ?? 0) + (usage?.outputTokenDetails?.reasoningTokens ?? 0);

/**
 * What a failed call used, read from the error's token counts only — never its text, which can echo
 * the prompt. A call that ran out of output tokens used its whole budget unless it says otherwise.
 */
function usageOfFailure(error: unknown): TImportCallUsage | undefined {
  if (error instanceof AIOutputTokenLimitError) {
    // Reasoning is part of the total, so a reported reasoning count alone says less than the limit hit.
    const { outputTokens, maxOutputTokens } = error.details;
    return { outputTokens: outputTokens ?? maxOutputTokens ?? SURVEY_IMPORT_AI_MAX_OUTPUT_TOKENS_PER_CALL };
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

const CALL_TIMEOUT_ERROR_NAMES: ReadonlySet<string> = new Set(["TimeoutError", "AbortError"]);

/**
 * Whether an attempt failed because its own `timeout` fired. Asked only once the import's own signal
 * is known not to have fired, so the attempt's timeout is the only abort left. The AI SDK reports it
 * as a `TimeoutError`, or as an `AbortError` carrying it (a backoff delay's "Delay was aborted", when
 * its own retries were on).
 */
const isCallTimeout = (error: unknown): boolean =>
  error instanceof Error &&
  (CALL_TIMEOUT_ERROR_NAMES.has(error.name) ||
    (error.cause instanceof Error && CALL_TIMEOUT_ERROR_NAMES.has(error.cause.name)));

const isInvalidOutput = (error: unknown): boolean =>
  NoObjectGeneratedError.isInstance(error) ||
  NoOutputGeneratedError.isInstance(error) ||
  TypeValidationError.isInstance(error);

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

function addUsage<TFailure extends string, TPlan extends TImportCheckedPlan<TFailure>>(
  context: TPlanContext<TFailure, TPlan>,
  usage: TImportCallUsage | undefined
): void {
  context.usage.inputTokens += usage?.inputTokens ?? 0;
  context.usage.outputTokens += outputTokensOf(usage);
}

async function callOnce<TFailure extends string, TPlan extends TImportCheckedPlan<TFailure>>(
  context: TPlanContext<TFailure, TPlan>,
  refs: string[],
  timeout: number,
  failures?: ReadonlyMap<string, readonly (TFailure | TImportCallFailure)[]>
): Promise<TCallOutcome> {
  const { lane } = context;
  if (context.calls >= lane.callCap || context.usage.outputTokens >= lane.outputBudget) {
    return { kind: "budget" };
  }
  if (timeout < SURVEY_IMPORT_MIN_CALL_TIMEOUT_MS) {
    context.ranOutOfTime = true;
    return { kind: "budget" };
  }

  const prompt = lane.buildPrompt(refs, failures);
  // Never send an over-budget prompt: too big for one call means smaller calls; past the import's
  // total, what is left goes unplanned.
  const size = lane.system.length + prompt.length;
  if (size > lane.maxCallChars) return { kind: "too_long" };
  if (context.promptChars + size > lane.maxTotalChars) return { kind: "budget" };

  // The call's time spans its retries: each attempt gets what is left of it.
  const callEnd = performance.now() + timeout;
  for (let attempt = 0; ; attempt += 1) {
    context.promptChars += size;
    context.calls += 1;
    try {
      const result = await context.generate({
        system: lane.system,
        prompt,
        schema: lane.schema,
        schemaName: lane.schemaName,
        schemaDescription: lane.schemaDescription,
        temperature: 0,
        maxOutputTokens: SURVEY_IMPORT_AI_MAX_OUTPUT_TOKENS_PER_CALL,
        timeout: attempt === 0 ? timeout : Math.floor(callEnd - performance.now()),
        maxRetries: 0,
        abortSignal: context.signal,
      });
      addUsage(context, result.usage);
      return { kind: "ok", response: { refs: new Set(refs), object: result.object } };
    } catch (error) {
      // A call that failed still spent tokens — one that ran out of them spent all 8,192.
      addUsage(context, usageOfFailure(error));
      // The import's own abort (Stop, disconnect, the route's deadline, a sibling's failure) is the
      // route's to classify. Any other abort is this attempt's own timeout.
      if (context.signal.aborted) throw error;
      if (isCallTimeout(error)) return { kind: "timed_out" };
      if (error instanceof AIOutputTokenLimitError) return { kind: "too_long" };
      if (isInvalidOutput(error)) return { kind: "invalid" };

      const decision = decideImportCallRetry({
        error,
        attempt,
        remainingMs: callEnd - performance.now(),
        minAttemptMs: SURVEY_IMPORT_MIN_CALL_TIMEOUT_MS,
      });
      if (decision.kind === "timed_out") return { kind: "timed_out" };
      // Not retryable, out of retries, or a quota wait that does not fit: the failure stands, as the
      // SDK's own retries ending would have left it.
      if (decision.kind === "propagate") throw error;
      // Retryable, but past the import's call cap or budgets: like any call the import cannot afford,
      // its units are dropped as `ai_budget`, and the calls beside it carry on.
      if (
        context.calls >= lane.callCap ||
        context.usage.outputTokens >= lane.outputBudget ||
        context.promptChars + size > lane.maxTotalChars
      ) {
        return { kind: "budget" };
      }
      // Waited by design: the retry must not be sent before the provider said to. Abortable by the
      // import's signal, whose reason then propagates.
      await waitForRetry(decision.delayMs, context.signal); // NOSONAR(typescript:S9382) -- a backoff
    }
  }
}

const FAILURE_OF_OUTCOME: Record<Exclude<TCallOutcome["kind"], "ok">, TImportCallFailure> = {
  budget: "ai_budget",
  timed_out: "ai_timeout",
  too_long: "invalid_output",
  invalid: "invalid_output",
};

/**
 * One round of calls: every chunk asked, at most `SURVEY_IMPORT_AI_MAX_PARALLEL_CALLS` at once. A
 * chunk whose call ran out of output tokens or of time is split into halves once, queued behind the
 * rest; its halves are not split again.
 */
async function planRound<TFailure extends string, TPlan extends TImportCheckedPlan<TFailure>>(
  context: TPlanContext<TFailure, TPlan>,
  chunks: string[][],
  timeout: () => number,
  abort: AbortController,
  failures?: ReadonlyMap<string, readonly (TFailure | TImportCallFailure)[]>
): Promise<TPlan> {
  const responses: TImportPlanResponse[] = [];
  const failed = new Map<string, TImportCallFailure[]>();

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
    SURVEY_IMPORT_AI_MAX_PARALLEL_CALLS,
    abort
  );

  const plan = context.lane.check(responses, { retry: failures !== undefined });
  for (const [ref, reasons] of failed) plan.failures.set(ref, reasons);
  return plan;
}

/**
 * Plan `refs`: every chunk asked once, then the units whose answer failed the lane's checks asked once
 * more, told what was wrong. A unit the budget left unplanned, or whose calls ran out of time even
 * split, is not retried: there is no budget left to retry it with, or no reason to expect it to be
 * faster.
 */
export async function runImportPlan<
  TFailure extends string,
  TPlan extends TImportCheckedPlan<TFailure>,
>(params: {
  lane: TImportPlanLane<TFailure, TPlan>;
  refs: readonly string[];
  generate: TImportPlanGenerate;
  signal: AbortSignal;
  /** When the import must be finished by, as `performance.now()` time. */
  deadline: number;
  /** Resolved per-call budget, before clipping it to the import deadline. */
  callTimeoutMs: number;
}): Promise<TImportPlanRun<TPlan>> {
  const { lane, refs, generate, deadline, callTimeoutMs } = params;
  const abort = new AbortController();
  const context: TPlanContext<TFailure, TPlan> = {
    lane,
    promptChars: 0,
    generate,
    signal: AbortSignal.any([params.signal, abort.signal]),
    usage: { inputTokens: 0, outputTokens: 0 },
    calls: 0,
    ranOutOfTime: false,
  };

  const callTimeout = () =>
    Math.min(callTimeoutMs, Math.floor(deadline - performance.now() - SURVEY_IMPORT_ASSEMBLY_RESERVE_MS));

  let plan = await planRound(context, lane.chunk(refs), callTimeout, abort);

  const unplanned = new Map(
    [...plan.failures].filter(
      ([, reasons]) => reasons.includes("ai_budget") || reasons.includes("ai_timeout")
    )
  );
  const failing = [...plan.failures.keys()].filter((ref) => !unplanned.has(ref));
  if (failing.length > 0) {
    const retry = await planRound(context, lane.chunk(failing), callTimeout, abort, plan.failures);
    plan = lane.merge(plan, retry);
    for (const [ref, reasons] of unplanned) plan.failures.set(ref, reasons);
  }

  return { plan, usage: context.usage, calls: context.calls, ranOutOfTime: context.ranOutOfTime };
}

/** The report's cause for a unit the plan could not place. */
export const importFailureCause = (
  reasons: readonly string[]
): "ai_budget" | "ai_timeout" | "plan_invalid" => {
  if (reasons.includes("ai_timeout")) return "ai_timeout";
  if (reasons.includes("ai_budget")) return "ai_budget";
  return "plan_invalid";
};
