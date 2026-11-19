import { describe, expect, test } from "vitest";
import type { TWorkflowFilterNode, TWorkflowRunContext } from "@formbricks/workflows";
import type { WorkflowRunEffects } from "../effects";
import type { WorkflowRunEnvironment } from "../run-environment";
import { filterStepExecutor } from "./filter";

const gate: TWorkflowFilterNode = {
  id: "gate",
  type: "filter",
  config: {
    condition: {
      id: "g",
      connector: "and",
      conditions: [
        { id: "tier", left: { path: "payload.customer.tier" }, operator: "equals", right: "gold" },
      ],
    },
  },
};

const run = (customer: Record<string, unknown>) => {
  const context: TWorkflowRunContext = { payload: { customer }, steps: {} };
  return filterStepExecutor.execute({
    node: gate,
    context,
    // A Filter acts on nothing outside the run.
    environment: { surveyResponse: null } as WorkflowRunEnvironment,
    effects: {} as WorkflowRunEffects,
    saveOutput: async () => {},
  });
};

describe("filterStepExecutor (ADR 0056)", () => {
  test("lets the run go on when its conditions hold", async () => {
    const outcome = await run({ tier: "gold" });

    expect(outcome).toEqual({
      status: "succeeded",
      error: null,
      output: { passed: true, conditions: [{ id: "tier", matched: true }] },
    });
    expect(filterStepExecutor.decide?.(outcome.output)).toEqual({ next: "continue" });
  });

  test("ends the run when they don't, as a succeeded step rather than a failure", async () => {
    const outcome = await run({ tier: "silver" });

    expect(outcome.status).toBe("succeeded");
    expect(outcome.output).toEqual({ passed: false, conditions: [{ id: "tier", matched: false }] });
    expect(filterStepExecutor.decide?.(outcome.output)).toEqual({ next: "end" });
  });

  test("refuses to route a resumed step whose stored output has no result", () => {
    expect(() => filterStepExecutor.decide?.({})).toThrow("filter step output has no result");
  });
});
