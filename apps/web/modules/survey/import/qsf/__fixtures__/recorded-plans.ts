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
  async (request) => {
    onCall?.(request);
    request.abortSignal.throwIfAborted();
    const object = planForRefs(plan, refsInPrompt(request.prompt));
    const outputTokens = Math.ceil(JSON.stringify(object).length / 4);
    return { object, usage: { inputTokens: Math.ceil(request.prompt.length / 4), outputTokens } };
  };
