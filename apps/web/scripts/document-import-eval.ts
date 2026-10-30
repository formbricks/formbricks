import { createId } from "@paralleldrive/cuid2";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateObject } from "@formbricks/ai";
import { prisma } from "@formbricks/database";
import { env } from "@/lib/env";
import type { TImportPlanGenerate } from "@/modules/survey/import/core/ai-plan";
import { SurveyImportFailedError, SurveyImportInputError } from "@/modules/survey/import/core/errors";
import { checkImportDraft } from "@/modules/survey/import/core/final-gate";
import { sniffSurveyImportFile } from "@/modules/survey/import/core/sniff";
import { loadDocumentFixture } from "@/modules/survey/import/document/__fixtures__/load-fixture";
import { longQuestionnaireDocx } from "@/modules/survey/import/document/__fixtures__/long-questionnaire";
import { promptInjectionWithoutInjectedText } from "@/modules/survey/import/document/__fixtures__/prompt-injection";
import { csvImportLane, excelImportLane, wordImportLane } from "@/modules/survey/import/document/lane";
import { type TPreparedDocumentImport, runDocumentImport } from "@/modules/survey/import/document/pipeline";

/**
 * ENG-6853 — the document import (Word, Excel, CSV) against a real model, and the eval that confirms
 * its AI ceiling. Not run in CI: CI uses the recorded plans in
 * `modules/survey/import/document/__fixtures__/plans/` with the AI faked.
 *
 *   pnpm document:eval                              the ceiling set, once each
 *   pnpm document:eval --fixture=long-survey-150    one of them
 *   pnpm document:eval --runs=3                     each three times, for latency spread
 *   pnpm document:eval --record                     also rewrite the fixtures' recorded plans
 *   pnpm document:eval --record --record-dir=/tmp/plans
 *                                                   record into another directory instead
 *   pnpm document:eval --file=/path/to/list.docx    a local file; never recorded
 *
 * The ceiling set (decision 18):
 *
 * - `long-survey-150.docx`, the largest questionnaire the import is built for: it must finish inside
 *   the deadline with every question;
 * - `site-audit-checklist.xlsx`, a long checklist shaped like the Gulf Cup file (section rows, IDs,
 *   options inline, routing in a column);
 * - `synthetic-300.docx`, 300 questions laid out like Long_Survey_150: past the 200-question ceiling,
 *   it must end as `too_many_questions` without a draft;
 * - `prompt-injection.docx`, also run without its injected paragraphs: `sameAsClean` says whether the
 *   model built the same draft from both.
 *
 * It runs the real reader and pipeline — the checks, retry, assembly and final gate — with the model
 * call built from the validated environment (`AI_PROVIDER`, `AI_MODEL` and the provider's credentials,
 * from `.env`), so it needs no organization and no license. Naming the draft reads the database
 * (`DATABASE_URL`) for surveys of a workspace that does not exist, so any reachable database does.
 *
 * What it reports per run: the outcome, duration, AI calls, the file's lines, questions out, input and
 * output tokens, output tokens per question, whether the draft passes the create's checks, and the
 * report's issue codes. Never the file's text: a `--file` may be a customer's questionnaire, and its
 * recorded plan would quote it, which is why `--file` never records.
 */

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../modules/survey/import/document/__fixtures__"
);
const DEADLINE_MS = 120_000;
const SYNTHETIC_QUESTIONS = 300;

interface TSource {
  name: string;
  bytes: Uint8Array;
  /** Whether `--record` may rewrite its plan in the fixtures. */
  recordable: boolean;
  /** The same file without what it injects, to compare drafts with. */
  clean?: Uint8Array;
}

const CEILING_SET: Record<string, () => TSource> = {
  "long-survey-150": () => fixture("long-survey-150.docx"),
  "site-audit-checklist": () => fixture("site-audit-checklist.xlsx"),
  "synthetic-300": () => ({
    name: `synthetic-${SYNTHETIC_QUESTIONS}.docx`,
    bytes: longQuestionnaireDocx(SYNTHETIC_QUESTIONS),
    recordable: false,
  }),
  "prompt-injection": () => ({
    ...fixture("prompt-injection.docx"),
    clean: promptInjectionWithoutInjectedText(),
  }),
};

function fixture(name: string): TSource {
  return { name, bytes: loadDocumentFixture(name), recordable: true };
}

interface TArgs {
  sources: string[];
  file: string | null;
  runs: number;
  record: boolean;
  recordDir: string;
}

const parseArgs = (argv: ReadonlyArray<string>): TArgs => {
  const options = new Map(
    argv
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => {
        const [key, value] = arg.slice(2).split("=", 2);
        return [key, value ?? "true"] as const;
      })
  );
  const only = options.get("fixture")?.replace(/\.(docx|xlsx|csv)$/, "");
  const runs = Number(options.get("runs") ?? "1");
  return {
    sources: only ? [only] : Object.keys(CEILING_SET),
    file: options.get("file") ?? null,
    runs: Number.isSafeInteger(runs) && runs > 0 ? runs : 1,
    record: options.get("record") === "true",
    recordDir: resolve(options.get("record-dir") ?? join(FIXTURE_DIR, "plans")),
  };
};

/** The model call, from the environment rather than an organization's settings. */
const environmentGenerate =
  (onResponse: (object: unknown) => void): TImportPlanGenerate =>
  async (request) => {
    const result = await generateObject(request, env);
    onResponse(result.object);
    return result;
  };

/** Read a file the way the import route does: its type from its bytes, then its lane's reader. */
const prepare = async (bytes: Uint8Array, fileName: string): Promise<TPreparedDocumentImport> => {
  const upload = sniffSurveyImportFile(bytes);
  switch (upload.type) {
    case "docx":
      return wordImportLane.prepare({ type: "docx", archive: upload.archive, fileName });
    case "xlsx":
      return excelImportLane.prepare({
        type: "xlsx",
        bytes: upload.bytes,
        archive: upload.archive,
        fileName,
      });
    case "csv":
      return csvImportLane.prepare({ type: "csv", text: upload.text, encoding: upload.encoding, fileName });
    default:
      throw new Error(`Not a document: ${upload.type}`);
  }
};

interface TRecordedPlan {
  defaultLanguage?: unknown;
  languages?: unknown;
  titleCell?: unknown;
  questions: { ref?: unknown }[];
  skipped: { ref?: unknown }[];
}

/** One plan from every answer of a run, a line's last answer winning (the retry's). */
const mergeResponses = (responses: unknown[]): TRecordedPlan => {
  const questions = new Map<unknown, { ref?: unknown }>();
  const skipped = new Map<unknown, { ref?: unknown }>();
  let first: Partial<TRecordedPlan> = {};
  for (const response of responses) {
    const object = response as Partial<TRecordedPlan>;
    if (first.defaultLanguage === undefined) first = object;
    for (const question of object.questions ?? []) questions.set(question.ref, question);
    for (const skip of object.skipped ?? []) skipped.set(skip.ref, skip);
  }
  return {
    defaultLanguage: first.defaultLanguage,
    languages: first.languages,
    titleCell: first.titleCell ?? null,
    questions: [...questions.values()],
    skipped: [...skipped.values()],
  };
};

/** Keys whose values are ids a run makes anew, which two drafts of one file never share. */
const RUN_IDS: ReadonlySet<string> = new Set(["id", "target", "logicFallback"]);

/** What a draft says, without the ids each run makes anew. */
const contentOf = (payload: unknown): string =>
  JSON.stringify(payload, (key, value: unknown) => (RUN_IDS.has(key) ? undefined : value));

/** One import of one file: its outcome, and the draft's content for a comparison. */
const importOnce = async (bytes: Uint8Array, name: string, responses: unknown[]) => {
  const startedAt = performance.now();
  const prepared = await prepare(bytes, name);
  try {
    const result = await runDocumentImport({
      prepared,
      workspaceId: createId(),
      organizationId: "document-eval",
      userId: null,
      signal: AbortSignal.timeout(DEADLINE_MS),
      deadlineMs: DEADLINE_MS,
      onProgress: () => undefined,
      generate: environmentGenerate((object) => responses.push(object)),
    });
    const questions = result.report.summary.questions;
    const outputTokens = result.usage?.outputTokens ?? 0;
    return {
      summary: {
        outcome: "done",
        durationMs: Math.round(performance.now() - startedAt),
        calls: responses.length,
        linesIn: prepared.model.lines.length,
        questionsOut: questions,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens,
        outputTokensPerQuestion: questions > 0 ? Math.round(outputTokens / questions) : null,
        passesCreateCheck: checkImportDraft(result.payload).length === 0,
        issues: result.report.issues
          .map((issue) => issue.code)
          .sort((left, right) => left.localeCompare(right)),
      },
      content: contentOf(result.payload),
    };
  } catch (error) {
    // The ceiling's refusals are outcomes, not failures of the eval.
    if (!(error instanceof SurveyImportFailedError)) throw error;
    return {
      summary: {
        outcome: `failed:${error.reason}`,
        durationMs: Math.round(performance.now() - startedAt),
        calls: responses.length,
        linesIn: prepared.model.lines.length,
      },
      content: null,
    };
  }
};

const runOnce = async (source: TSource, recordDir: string | null) => {
  const responses: unknown[] = [];
  const { summary, content } = await importOnce(source.bytes, source.name, responses);

  if (recordDir !== null && responses.length > 0) {
    const path = join(recordDir, `${basename(source.name).replace(/\.(docx|xlsx|csv)$/, "")}.plan.json`);
    const recording = {
      source: "recorded",
      model: env.AI_MODEL ?? null,
      provider: env.AI_PROVIDER ?? null,
      recordedAt: new Date().toISOString(),
    };
    writeFileSync(path, `${JSON.stringify({ recording, plan: mergeResponses(responses) }, null, 2)}\n`);
  }

  if (!source.clean) return summary;
  const clean = await importOnce(source.clean, source.name, []);
  return { ...summary, sameAsClean: content !== null && content === clean.content };
};

/** One run, printed as a line of JSON: its summary, or the error's name and nothing else. */
const printRun = async (source: TSource, run: number, recordDir: string | null): Promise<void> => {
  try {
    console.log(JSON.stringify({ run, fixture: source.name, ...(await runOnce(source, recordDir)) }));
  } catch (error) {
    // The name, and for a refused file which limit: a provider's message can quote the prompt.
    const limit =
      error instanceof SurveyImportInputError
        ? (error.invalidParams[0] as { identifier?: string } | undefined)?.identifier
        : undefined;
    console.log(
      JSON.stringify({
        run,
        fixture: source.name,
        failed: error instanceof Error ? error.name : "unknown",
        ...(limit ? { limit } : {}),
      })
    );
    process.exitCode = 1;
  }
};

const loadSources = (args: TArgs): TSource[] => {
  if (args.file) {
    const path = resolve(args.file);
    return [{ name: basename(path), bytes: new Uint8Array(readFileSync(path)), recordable: false }];
  }
  return args.sources.map((name) => {
    const load = CEILING_SET[name];
    if (load) return load();
    // Any other fixture by its file name.
    return fixture(name.includes(".") ? name : `${name}.docx`);
  });
};

const evaluate = async () => {
  const args = parseArgs(process.argv.slice(2));
  const sources = loadSources(args);
  if (args.record && args.file)
    console.log("--record is ignored for --file: a recorded plan would quote the file.");

  // One run at a time, by design: runs side by side would share the provider's rate limit and skew
  // the latencies this script is for.
  for (const source of sources) {
    for (let run = 1; run <= args.runs; run++) {
      const record = args.record && source.recordable && run === 1;
      await printRun(source, run, record ? args.recordDir : null); // NOSONAR(typescript:S9382) -- runs are sequential on purpose
    }
  }
};

/**
 * The eval. Run through `run-esm-script.mts` (`pnpm document:eval`), which loads the app as ES modules
 * and awaits this; nothing runs on import.
 */
export const main = async (): Promise<void> => {
  try {
    await evaluate();
  } catch (error) {
    console.error(error instanceof Error ? error.name : "unknown");
    process.exitCode = 1;
  } finally {
    // The database's connection pool would hold the process open for minutes after the last run.
    await prisma.$disconnect();
  }
};
