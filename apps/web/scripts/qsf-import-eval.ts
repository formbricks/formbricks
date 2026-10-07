import { createId } from "@paralleldrive/cuid2";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateObject } from "@formbricks/ai";
import { env } from "@/lib/env";
import {
  IMPORTABLE_QSF_FIXTURES,
  loadQsfFixture,
} from "@/modules/survey/import/qsf/__fixtures__/load-fixture";
import type { TQsfPlanGenerate } from "@/modules/survey/import/qsf/ai-plan";
import { checkQsfDraft } from "@/modules/survey/import/qsf/final-gate";
import { prepareQsfImport, runQsfImport } from "@/modules/survey/import/qsf/pipeline";

/**
 * ENG-3654 — the Qualtrics import against a real model. Not run in CI: CI uses the recorded plans in
 * `modules/survey/import/qsf/__fixtures__/plans/` with the AI mocked.
 *
 *   pnpm qsf:eval                          every fixture, once
 *   pnpm qsf:eval --fixture=large-150      one fixture
 *   pnpm qsf:eval --runs=3                 each fixture three times, for latency spread
 *   pnpm qsf:eval --record                 also rewrite the fixtures' recorded plans from the model
 *   pnpm qsf:eval --file=/path/to/x.qsf    a local file; never recorded
 *
 * It runs the real pipeline — reader, sanitizer, chunking, checks, retry, assembly and the final
 * gate — with the model call built from the validated environment (`AI_PROVIDER`, `AI_MODEL` and the
 * provider's credentials, from `.env`), so it needs no organization and no license. Credentials are
 * read from the environment only. A redirect in a file asks `getExternalUrlsPermission`, which on
 * Cloud reads billing; the fixtures' redirects need no database off Cloud.
 *
 * What it reports per run: duration, AI calls, input and output tokens, output tokens per question
 * (what chunk sizing rests on), whether the draft passes the create's checks, and the report's issue
 * codes. Never the file's text: a `--file` may be a customer's survey, and its recorded plan would
 * paraphrase it in logic notes, which is why `--file` never records.
 */

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../modules/survey/import/qsf/__fixtures__"
);
const DEADLINE_MS = 120_000;

interface TArgs {
  fixtures: string[];
  file: string | null;
  runs: number;
  record: boolean;
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
  const fixture = options.get("fixture");
  const runs = Number(options.get("runs") ?? "1");
  return {
    fixtures: fixture
      ? [fixture.endsWith(".qsf") ? fixture : `${fixture}.qsf`]
      : [...IMPORTABLE_QSF_FIXTURES],
    file: options.get("file") ?? null,
    runs: Number.isSafeInteger(runs) && runs > 0 ? runs : 1,
    record: options.get("record") === "true",
  };
};

/** The model call, from the environment rather than an organization's settings. */
const environmentGenerate =
  (onResponse: (object: unknown) => void): TQsfPlanGenerate =>
  async (request) => {
    const result = await generateObject(request, env);
    onResponse(result.object);
    return result;
  };

interface TRecordedPlan {
  blocks: unknown[];
  questions: { ref?: unknown }[];
  skipped: unknown[];
}

/** One plan from every answer of a run, a question's last answer winning (the retry's). */
const mergeResponses = (responses: unknown[]): TRecordedPlan => {
  const questions = new Map<unknown, { ref?: unknown }>();
  const plan: TRecordedPlan = { blocks: [], questions: [], skipped: [] };
  for (const response of responses) {
    const object = response as Partial<TRecordedPlan>;
    plan.blocks.push(...(object.blocks ?? []));
    plan.skipped.push(...(object.skipped ?? []));
    for (const question of object.questions ?? []) questions.set(question.ref, question);
  }
  plan.questions = [...questions.values()];
  return plan;
};

const runOnce = async (name: string, qsf: Record<string, unknown>, record: boolean) => {
  const responses: unknown[] = [];
  const startedAt = performance.now();
  const prepared = prepareQsfImport(qsf, name);
  const result = await runQsfImport({
    prepared,
    workspaceId: createId(),
    organizationId: "qsf-eval",
    userId: null,
    signal: AbortSignal.timeout(DEADLINE_MS),
    deadlineMs: DEADLINE_MS,
    onProgress: () => undefined,
    generate: environmentGenerate((object) => responses.push(object)),
  });
  const durationMs = Math.round(performance.now() - startedAt);
  const questions = result.report.summary.questions;
  const outputTokens = result.usage?.outputTokens ?? 0;

  if (record) {
    const path = join(FIXTURE_DIR, "plans", `${basename(name, ".qsf")}.plan.json`);
    const recording = {
      source: "recorded",
      model: env.AI_MODEL ?? null,
      provider: env.AI_PROVIDER ?? null,
      recordedAt: new Date().toISOString(),
    };
    writeFileSync(path, `${JSON.stringify({ recording, plan: mergeResponses(responses) }, null, 2)}\n`);
  }

  return {
    fixture: name,
    durationMs,
    calls: responses.length,
    questionsIn: prepared.survey.questions.size,
    questionsOut: questions,
    inputTokens: result.usage?.inputTokens ?? 0,
    outputTokens,
    outputTokensPerQuestion: questions > 0 ? Math.round(outputTokens / questions) : null,
    passesCreateCheck: checkQsfDraft(result.payload).length === 0,
    issues: result.report.issues.map((issue) => issue.code).sort(),
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const sources: { name: string; qsf: Record<string, unknown>; recordable: boolean }[] = args.file
    ? [
        {
          name: basename(args.file),
          qsf: JSON.parse(readFileSync(resolve(args.file), "utf8")) as Record<string, unknown>,
          recordable: false,
        },
      ]
    : args.fixtures.map((name) => ({ name, qsf: loadQsfFixture(name), recordable: true }));

  if (args.record && args.file) {
    console.log("--record is ignored for --file: a recorded plan would paraphrase the file.");
  }

  for (const source of sources) {
    for (let run = 1; run <= args.runs; run++) {
      try {
        const summary = await runOnce(source.name, source.qsf, args.record && source.recordable && run === 1);
        console.log(JSON.stringify({ run, ...summary }));
      } catch (error) {
        // The name and nothing else: a provider's message can quote the prompt.
        console.log(
          JSON.stringify({
            run,
            fixture: source.name,
            failed: error instanceof Error ? error.name : "unknown",
          })
        );
        process.exitCode = 1;
      }
    }
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.name : "unknown");
  process.exitCode = 1;
});
