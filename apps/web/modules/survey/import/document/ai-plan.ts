import {
  type TImportPlanGenerate,
  type TImportPlanLane,
  type TImportPlanUsage,
  importCallCapFor,
  importFailureCause,
  importOutputBudgetFor,
  runImportPlan,
} from "../core/ai-plan";
import { SurveyImportTimeoutError } from "../core/errors";
import type { TSurveyImportPipelineIssue } from "../core/report";
import { SURVEY_IMPORT_AI_CALL_TIMEOUT_MS, SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS } from "../limits";
import type { TDocumentModel } from "./model";
import {
  DocumentPlanContext,
  type TDocumentCheckedPlan,
  type TDocumentPlanFailure,
  checkDocumentPlanResponses,
  mergeDocumentPlans,
} from "./plan-checks";
import { ZDocumentImportPlanForAI } from "./plan-schema";
import {
  DOCUMENT_PROMPT_MAX_CALL_CHARS,
  DOCUMENT_PROMPT_MAX_TOTAL_CHARS,
  buildDocumentPlanPrompt,
  buildDocumentPlanSystemPrompt,
  describedLineChars,
} from "./prompt";

/**
 * The AI half of a document import (ENG-6852): the file's lines, chunked by the output they are
 * expected to need, planned by the lane-neutral engine (`../core/ai-plan.ts`) and checked by
 * `plan-checks.ts`. A unit of work is a line; an entry is planned by the call asked about the line it
 * starts on.
 */

/**
 * Expected output tokens per line: a planned entry's fields where a line starts one, and the parts of
 * cells a split quotes back. Most cells are named whole (`text: null`), so about a quarter of the text
 * is expected to come back, at about 4 characters a token. A chunk that needs more than expected runs
 * out of output tokens and is split, like any other.
 */
const TOKENS_PER_LINE = 10;
const CHARS_PER_TOKEN = 4;

/**
 * Data characters per chunk: half of one call's cap, leaving room for the system prompt and for the
 * lines shown around the chunk's own.
 */
const DOCUMENT_CHUNK_DATA_CHARS = DOCUMENT_PROMPT_MAX_CALL_CHARS / 2;

/**
 * Chunks one import may plan: the Qualtrics lane's ceiling (50 chunks, 152 calls, about 70,000 expected
 * output tokens), so a document costs at most what the costliest Qualtrics import does. It holds 240k
 * characters of text in lines of a few hundred characters or more; a file that needs more chunks than
 * this is past the AI ceiling like one past 240k characters, and is refused before any AI call.
 */
export const DOCUMENT_MAX_CHUNKS = 50;

const lineCost = (line: TDocumentModel["lines"][number]): { tokens: number; chars: number } => {
  const textChars = line.cells.reduce((sum, cell) => sum + cell.text.length, 0);
  return {
    tokens: TOKENS_PER_LINE + Math.ceil(textChars / CHARS_PER_TOKEN),
    chars: describedLineChars(line),
  };
};

/**
 * Group lines into chunks of at most `SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS` expected output and
 * `DOCUMENT_CHUNK_DATA_CHARS` of data, in document order, as many as it takes.
 */
export function chunkDocumentLines(model: TDocumentModel, refs: readonly string[]): string[][] {
  const lineByKey = new Map(model.lines.map((line) => [line.key, line]));
  const chunks: string[][] = [];
  let current: string[] = [];
  let tokens = 0;
  let chars = 0;

  for (const ref of refs) {
    const line = lineByKey.get(ref);
    if (!line) continue;
    const cost = lineCost(line);
    if (
      current.length > 0 &&
      (tokens + cost.tokens > SURVEY_IMPORT_AI_CHUNK_OUTPUT_TOKENS ||
        chars + cost.chars > DOCUMENT_CHUNK_DATA_CHARS)
    ) {
      chunks.push(current);
      current = [];
      tokens = 0;
      chars = 0;
    }
    current.push(ref);
    tokens += cost.tokens;
    chars += cost.chars;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** How many chunks the whole document plans in: what `prepare` holds to `DOCUMENT_MAX_CHUNKS`. */
export const countDocumentChunks = (model: TDocumentModel): number =>
  chunkDocumentLines(
    model,
    model.lines.map((line) => line.key)
  ).length;

export interface TDocumentPlanResult {
  plan: TDocumentCheckedPlan;
  context: DocumentPlanContext;
  issues: TSurveyImportPipelineIssue[];
  usage: TImportPlanUsage;
  calls: number;
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
    maxCallChars: DOCUMENT_PROMPT_MAX_CALL_CHARS,
    maxTotalChars: DOCUMENT_PROMPT_MAX_TOTAL_CHARS,
    callCap: Math.min(importCallCapFor(chunkCount), importCallCapFor(DOCUMENT_MAX_CHUNKS)),
    outputBudget: Math.min(importOutputBudgetFor(chunkCount), importOutputBudgetFor(DOCUMENT_MAX_CHUNKS)),
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

  return { plan, context, issues, usage: run.usage, calls: run.calls };
}
