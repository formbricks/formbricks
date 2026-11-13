import { describe, expect, test } from "vitest";
import type { TWorkflowRunContext, TWorkflowSwitchNode } from "@formbricks/workflows";
import type { WorkflowRunEffects } from "../effects";
import type { WorkflowRunEnvironment } from "../run-environment";
import { switchStepExecutor } from "./switch";

const node = (cases: TWorkflowSwitchNode["config"]["cases"]): TWorkflowSwitchNode => ({
  id: "route",
  type: "switch",
  config: { left: { path: "payload.customer.tier" }, cases },
});

const tiers = node([
  { id: "gold", name: "Gold", operator: "equals", right: "gold" },
  { id: "silver", name: "Silver", operator: "equals", right: "silver" },
  // Matches anything set, so it only wins when no case before it does.
  { id: "any", name: "Any tier", operator: "isSet" },
]);

const run = (customer: Record<string, unknown>, switchNode: TWorkflowSwitchNode = tiers) => {
  const context: TWorkflowRunContext = { payload: { customer }, steps: {} };
  return switchStepExecutor.execute({
    node: switchNode,
    context,
    // A Switch acts on nothing outside the run.
    environment: {} as WorkflowRunEnvironment,
    effects: {} as WorkflowRunEffects,
  });
};

describe("switchStepExecutor", () => {
  test("takes the first case that matches and records the cases tried up to it", async () => {
    const outcome = await run({ tier: "silver" });

    expect(outcome).toEqual({
      status: "succeeded",
      error: null,
      output: {
        branch: "silver",
        cases: [
          { id: "gold", matched: false },
          { id: "silver", matched: true },
        ],
      },
    });
    expect(switchStepExecutor.decide?.(outcome.output)).toEqual({ next: "branch", branch: "silver" });
  });

  test("a later case that also matches never wins over an earlier one", async () => {
    const outcome = await run({ tier: "gold" });

    expect(outcome.output.branch).toBe("gold");
  });

  test("takes Default when no case matches", async () => {
    const outcome = await run({}, node([{ id: "gold", name: "Gold", operator: "equals", right: "gold" }]));

    expect(outcome.output).toEqual({ branch: "default", cases: [{ id: "gold", matched: false }] });
    expect(switchStepExecutor.decide?.(outcome.output)).toEqual({ next: "branch", branch: "default" });
  });

  test("compares like survey logic: a number sent as text still compares as a number", async () => {
    const outcome = await run(
      { tier: "412" },
      node([{ id: "big", name: "Big spender", operator: "isGreaterThan", right: 400 }])
    );

    expect(outcome.output.branch).toBe("big");
  });

  test("reads legacy operator names as the survey operator they mean", async () => {
    const outcome = await run(
      { tier: "bronze" },
      node([{ id: "not-gold", name: "Not gold", operator: "notEquals", right: "gold" }])
    );

    expect(outcome.output.branch).toBe("not-gold");
  });

  test("refuses to route a resumed step whose stored output has no branch", () => {
    expect(() => switchStepExecutor.decide?.({ cases: [] })).toThrow(/no branch/);
  });
});
