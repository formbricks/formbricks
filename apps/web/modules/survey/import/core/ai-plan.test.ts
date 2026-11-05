import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import {
  type TImportCheckedPlan,
  type TImportPlanLane,
  type TImportPlanResponse,
  runImportPlan,
} from "./ai-plan";

// The engine's prompt budget, on a lane small enough to see it: a schema whose text alone is longer
// than one call may be.
const schema = z.object({ answer: z.string().describe("x".repeat(5_000)) });

type TPlan = TImportCheckedPlan<never> & { answered: number };

const laneWith = (maxCallChars: number, maxTotalChars = 1_000_000): TImportPlanLane<never, TPlan> => ({
  chunk: (refs) => [refs.slice()],
  system: "Plan it.",
  schema,
  schemaName: "Plan",
  schemaDescription: "A plan.",
  buildPrompt: (refs) => `Units: ${refs.join(", ")}`,
  check: (responses) => ({ failures: new Map(), answered: responses.length }),
  merge: (first, retry) => ({ failures: retry.failures, answered: first.answered + retry.answered }),
  maxCallChars,
  maxTotalChars,
  callCap: 10,
  outputBudget: 1_000_000,
});

const plan = (maxCallChars: number, maxTotalChars?: number) => {
  const generate = vi.fn(async () => ({ object: { answer: "yes" } }));
  const run = runImportPlan({
    lane: laneWith(maxCallChars, maxTotalChars),
    refs: ["Q1"],
    generate,
    signal: new AbortController().signal,
    deadline: performance.now() + 60_000,
    callTimeoutMs: 30_000,
  });
  return { run, generate };
};

describe("runImportPlan: the prompt budget", () => {
  test("counts the schema a JSON-mode provider is sent, not only the system prompt and the prompt", async () => {
    const { run, generate } = plan(1_000);

    const { plan: result } = await run;
    expect(generate).not.toHaveBeenCalled();
    expect(result.failures.get("Q1")).toEqual(["invalid_output"]);
  });

  test("leaves the schema out of the import's total, so counting it takes nothing from the file", async () => {
    // The total holds the system prompt and the prompt alone; only each call's own cap counts the schema.
    const { run, generate } = plan(100_000, 100);

    expect((await run).plan.answered).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test("sends the call when the schema fits too", async () => {
    const { run, generate } = plan(100_000);

    expect((await run).plan.answered).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe("runImportPlan: the request", () => {
  test("lets the model think: with thinking turned down, Gemini answered real questionnaires with an empty plan", async () => {
    const { run, generate } = plan(100_000);
    await run;

    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ lowReasoning: false }));
  });
});

describe("runImportPlan: a silent answer", () => {
  type TSeen = { refs: string[]; askedAgain: boolean }[];

  const silentLane = (seen: TSeen, chunk: (refs: readonly string[]) => string[][]) => ({
    ...laneWith(100_000),
    chunk,
    callCap: 20,
    isSilent: (response: TImportPlanResponse) => (response.object as { answer: string }).answer === "",
    check: (responses: TImportPlanResponse[]) => {
      seen.push(...responses.map((r) => ({ refs: [...r.refs], askedAgain: r.askedAgain === true })));
      return { failures: new Map(), answered: responses.length };
    },
  });

  const run = (lane: TImportPlanLane<never, TPlan>, refs: string[], answer: (call: number) => string) => {
    let calls = 0;
    const generate = vi.fn(async () => ({ object: { answer: answer(calls++) } }));
    return {
      generate,
      result: runImportPlan({
        lane,
        refs,
        generate,
        signal: new AbortController().signal,
        deadline: performance.now() + 60_000,
        callTimeoutMs: 30_000,
      }),
    };
  };

  test("is asked again once, in halves, whose answers are believed and marked askedAgain", async () => {
    const seen: TSeen = [];
    // Silent every time: the halves are not asked a third time.
    const { generate, result } = run(
      silentLane(seen, (refs) => [refs.slice()]),
      ["Q1", "Q2", "Q3"],
      () => ""
    );

    await result;

    expect(generate).toHaveBeenCalledTimes(3);
    expect(seen).toEqual([
      { refs: ["Q1", "Q2"], askedAgain: true },
      { refs: ["Q3"], askedAgain: true },
    ]);
  });

  test("a one-unit chunk is asked again whole, and an answer that names its units is kept unmarked", async () => {
    const seen: TSeen = [];
    const { generate, result } = run(
      silentLane(seen, (refs) => refs.map((ref) => [ref])),
      ["Q1", "Q2"],
      // Q1's first answer is silent, every other answer names its unit.
      (call) => (call === 0 ? "" : "yes")
    );

    await result;

    expect(generate).toHaveBeenCalledTimes(3);
    expect(seen).toEqual(
      expect.arrayContaining([
        { refs: ["Q1"], askedAgain: true },
        { refs: ["Q2"], askedAgain: false },
      ])
    );
  });

  test("calls in flight stay within the lane's maxParallelCalls", async () => {
    let inFlight = 0;
    let most = 0;
    const generate = vi.fn(async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return { object: { answer: "yes" } };
    });
    await runImportPlan({
      lane: {
        ...laneWith(100_000),
        callCap: 20,
        chunk: (refs) => refs.map((ref) => [ref]),
        maxParallelCalls: 3,
      },
      refs: Array.from({ length: 9 }, (_, i) => `Q${i + 1}`),
      generate,
      signal: new AbortController().signal,
      deadline: performance.now() + 60_000,
      callTimeoutMs: 30_000,
    });

    expect(generate).toHaveBeenCalledTimes(9);
    expect(most).toBe(3);
  });
});
