import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TQsfPlanGenerate, TQsfPlanRequest } from "../ai-plan";

const PLAN_DIR = join(dirname(fileURLToPath(import.meta.url)), "plans");

interface TRecordedPlan {
  questions: { ref: string; [key: string]: unknown }[];
  skipped: { ref: string; reason: string }[];
  pages: { id: string; logicNotes: string[] }[];
}

/** The recorded plan for a fixture (`simple.qsf` → `plans/simple.plan.json`), or a named one. */
export const loadRecordedPlan = (name: string): TRecordedPlan =>
  (
    JSON.parse(readFileSync(join(PLAN_DIR, `${name.replace(/\.qsf$/, "")}.plan.json`), "utf8")) as {
      plan: TRecordedPlan;
    }
  ).plan;

/** The question refs one call's prompt asks about, read from its data block. */
export const refsInPrompt = (prompt: string): string[] => {
  const data = /<qualtrics_questions>\n(.*)\n<\/qualtrics_questions>/s.exec(prompt)?.[1];
  if (!data) throw new Error("The prompt has no data block");
  return (JSON.parse(data) as { questions: { ref: string }[] }).questions.map((question) => question.ref);
};

/** The part of a recorded plan one call is about: what a model asked about those questions returns. */
export const planForRefs = (plan: TRecordedPlan, refs: readonly string[]): TRecordedPlan => {
  const wanted = new Set(refs);
  // Pages are answered as the model would: every page with logic it was shown, here all of them. The
  // checks keep only the pages the call holds questions of.
  return {
    questions: plan.questions.filter((question) => wanted.has(question.ref)),
    skipped: plan.skipped.filter((skip) => wanted.has(skip.ref)),
    pages: plan.pages,
  };
};

/**
 * A model that answers every call from a recorded plan, with usage the way providers report it —
 * sometimes without one of the counts.
 */
export const recordedGenerate =
  (plan: TRecordedPlan, onCall?: (request: TQsfPlanRequest) => void): TQsfPlanGenerate =>
  (request) => {
    onCall?.(request);
    if (request.abortSignal.aborted) return Promise.reject(request.abortSignal.reason);
    const object = planForRefs(plan, refsInPrompt(request.prompt));
    const outputTokens = Math.ceil(JSON.stringify(object).length / 4);
    return Promise.resolve({
      object,
      usage: { inputTokens: Math.ceil(request.prompt.length / 4), outputTokens },
    });
  };

/**
 * A model that takes time, and honours the call's `timeout` and `abortSignal` the way the AI SDK does:
 * a call slower than its timeout fails with a `TimeoutError`, and an aborted one with the signal's
 * reason. `latencyFor` says how long a call about those questions takes, `Infinity` to stall. Meant for
 * fake timers.
 */
export const timedGenerate =
  (plan: TRecordedPlan, latencyFor: (refs: string[]) => number): TQsfPlanGenerate =>
  (request) => {
    const refs = refsInPrompt(request.prompt);
    const latency = latencyFor(refs);
    if (request.abortSignal.aborted) return Promise.reject(request.abortSignal.reason);
    return new Promise((resolve, reject) => {
      const settle = (outcome: () => void) => {
        clearTimeout(answer);
        clearTimeout(timeout);
        request.abortSignal.removeEventListener("abort", onAbort);
        outcome();
      };
      const onAbort = () => settle(() => reject(request.abortSignal.reason));
      const answer = Number.isFinite(latency)
        ? setTimeout(() => settle(() => resolve(recordedGenerate(plan)(request))), latency)
        : undefined;
      const timeout = setTimeout(
        () => settle(() => reject(new DOMException("The operation timed out.", "TimeoutError"))),
        request.timeout
      );
      request.abortSignal.addEventListener("abort", onAbort, { once: true });
    });
  };
