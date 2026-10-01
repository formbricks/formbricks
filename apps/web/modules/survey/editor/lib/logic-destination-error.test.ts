import { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import type { z } from "zod";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { getLogicDestinationErrorMessage } from "./logic-destination-error";

// Echoes the key and its interpolation values, so each assertion shows exactly what was asked for.
const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key) as unknown as TFunction;

const blocks = [
  { id: "b1", name: "Intro questions" },
  { id: "b2", name: "  " },
] as unknown as TSurveyBlock[];

const issue = (path: (string | number)[], params?: Record<string, unknown>) =>
  ({ code: "custom", message: "raw schema message", path, params }) as unknown as z.core.$ZodIssue;

describe("getLogicDestinationErrorMessage", () => {
  test("names the rule and the block's title for a missing jump destination", () => {
    expect(
      getLogicDestinationErrorMessage(
        issue(["blocks", 0, "logic", 2], { missingLogicDestination: "jump" }),
        blocks,
        t
      )
    ).toBe(
      'workspace.surveys.edit.logic_jump_destination_missing {"ruleNumber":3,"blockName":"Intro questions"}'
    );
  });

  test("names the block's title for a missing fallback destination", () => {
    expect(
      getLogicDestinationErrorMessage(
        issue(["blocks", 0], { missingLogicDestination: "fallback" }),
        blocks,
        t
      )
    ).toBe('workspace.surveys.edit.logic_fallback_destination_missing {"blockName":"Intro questions"}');
  });

  test("falls back to the block's position when its title is blank", () => {
    expect(
      getLogicDestinationErrorMessage(
        issue(["blocks", 1], { missingLogicDestination: "fallback" }),
        blocks,
        t
      )
    ).toBe(
      'workspace.surveys.edit.logic_fallback_destination_missing {"blockName":"workspace.surveys.edit.block_n {\\"blockNumber\\":2}"}'
    );
  });

  test("leaves every other issue to the caller", () => {
    expect(getLogicDestinationErrorMessage(issue(["blocks", 0, "logic", 0]), blocks, t)).toBeNull();
    expect(
      getLogicDestinationErrorMessage(issue(["endings", 0], { missingLogicDestination: "jump" }), blocks, t)
    ).toBeNull();
  });
});
