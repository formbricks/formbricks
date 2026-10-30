import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TImportPlanGenerate, TImportPlanRequest } from "../../core/ai-plan";

const PLAN_DIR = join(dirname(fileURLToPath(import.meta.url)), "plans");

/** A plan as the model returns it, for every line of the file at once. */
export interface TRecordedDocumentPlan {
  defaultLanguage: string;
  languages: string[];
  titleCell: string | null;
  questions: { ref: string; [key: string]: unknown }[];
  skipped: { ref: string; reason: string }[];
}

/** The recorded plan for a fixture (`library-visit.xlsx` → `plans/library-visit.plan.json`). */
export const loadRecordedDocumentPlan = (name: string): TRecordedDocumentPlan =>
  (
    JSON.parse(readFileSync(join(PLAN_DIR, `${name.replace(/\.(xlsx|csv)$/, "")}.plan.json`), "utf8")) as {
      plan: TRecordedDocumentPlan;
    }
  ).plan;

/** The line keys one call's prompt asks about, read from its data block. */
export const linesInPrompt = (prompt: string): string[] => {
  const data = /<document_lines>\n(.*)\n<\/document_lines>/s.exec(prompt)?.[1];
  if (!data) throw new Error("The prompt has no data block");
  return (JSON.parse(data) as { lines: { line: string }[] }).lines.map((line) => line.line);
};

/** The part of a recorded plan one call is about: what a model asked about those lines returns. */
export const planForLines = (
  plan: TRecordedDocumentPlan,
  lines: readonly string[]
): TRecordedDocumentPlan => {
  const wanted = new Set(lines);
  return {
    ...plan,
    questions: plan.questions.filter((question) => wanted.has(question.ref)),
    skipped: plan.skipped.filter((skip) => wanted.has(skip.ref)),
  };
};

/** A model that answers every call from a recorded plan, with usage the way providers report it. */
export const recordedDocumentGenerate =
  (
    plan: TRecordedDocumentPlan,
    onCall?: (request: TImportPlanRequest) => TRecordedDocumentPlan | undefined
  ): TImportPlanGenerate =>
  (request) => {
    if (request.abortSignal.aborted) return Promise.reject(request.abortSignal.reason);
    const object = onCall?.(request) ?? planForLines(plan, linesInPrompt(request.prompt));
    return Promise.resolve({
      object,
      usage: {
        inputTokens: Math.ceil(request.prompt.length / 4),
        outputTokens: Math.ceil(JSON.stringify(object).length / 4),
      },
    });
  };
