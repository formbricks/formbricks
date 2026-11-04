import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { type TImportCheckedPlan, type TImportPlanLane, runImportPlan } from "./ai-plan";

// The engine's prompt budget, on a lane small enough to see it: a schema whose text alone is longer
// than one call may be.
const schema = z.object({ answer: z.string().describe("x".repeat(5_000)) });

type TPlan = TImportCheckedPlan<never> & { answered: number };

const laneWith = (maxCallChars: number): TImportPlanLane<never, TPlan> => ({
  chunk: (refs) => [refs.slice()],
  system: "Plan it.",
  schema,
  schemaName: "Plan",
  schemaDescription: "A plan.",
  buildPrompt: (refs) => `Units: ${refs.join(", ")}`,
  check: (responses) => ({ failures: new Map(), answered: responses.length }),
  merge: (first, retry) => ({ failures: retry.failures, answered: first.answered + retry.answered }),
  maxCallChars,
  maxTotalChars: 1_000_000,
  callCap: 10,
  outputBudget: 1_000_000,
});

const plan = (maxCallChars: number) => {
  const generate = vi.fn(async () => ({ object: { answer: "yes" } }));
  const run = runImportPlan({
    lane: laneWith(maxCallChars),
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

  test("sends the call when the schema fits too", async () => {
    const { run, generate } = plan(100_000);

    expect((await run).plan.answered).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
