import type { TFunction } from "i18next";
import { describe, expect, test } from "vitest";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { getFallbackTargetGroups, getJumpTargetGroups } from "./target-options";
import { getActionTargetOptions } from "./utils";

const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key} ${JSON.stringify(params)}` : key) as unknown as TFunction;

/**
 * The jump and "Otherwise go to" target lists (ENG-6969 T6.6): "Next block · <name>", then the
 * numbered Blocks and the Endings by their full names. Only the grouping and labels change: the set
 * of targets is today's (guardrail 3).
 */
const values = (groups: ReturnType<typeof getJumpTargetGroups>) =>
  groups.flatMap((group) => group.options.map((option) => option.value));
const labels = (groups: ReturnType<typeof getJumpTargetGroups>) => groups.map((group) => group.label);

const jumpAction = { id: "jump", objective: "jumpToBlock", target: "" } as const;

describe("getJumpTargetGroups", () => {
  test("offers exactly today's targets: the later blocks and every ending", () => {
    for (const blockIdx of [-1, 0, 2, 4, 5]) {
      const today = getActionTargetOptions(jumpAction, surveyFlowFixture, blockIdx, t).map((o) => o.value);
      const grouped = values(getJumpTargetGroups(surveyFlowFixture, blockIdx, t));

      expect(grouped).toHaveLength(today.length);
      expect(new Set(grouped)).toEqual(new Set(today));
    }
  });

  test("the next block comes first on its own line, then the numbered blocks after it, then the endings", () => {
    const groups = getJumpTargetGroups(surveyFlowFixture, 0, t);

    expect(labels(groups)).toEqual([
      "",
      "workspace.surveys.edit.flow.target_blocks",
      "workspace.surveys.edit.flow.target_endings",
    ]);
    expect(groups[0].options).toEqual([
      expect.objectContaining({
        value: ids.blocks.ratings,
        label: 'workspace.surveys.edit.flow.next_block_named {"name":"Ratings"}',
      }),
    ]);
    expect(groups[1].options.map((option) => [option.leading, option.value])).toEqual([
      ["3", ids.blocks.heavyUsers],
      ["4", ids.blocks.concept],
      ["5", ids.blocks.overall],
      ["6", ids.blocks.profile],
    ]);
  });

  test("before the first question the next block is the first one", () => {
    expect(getJumpTargetGroups(surveyFlowFixture, -1, t)[0].options[0].value).toBe(ids.blocks.services);
  });

  test("endings read by their full names, without an End: prefix", () => {
    const endings = getJumpTargetGroups(surveyFlowFixture, 0, t).at(-1)?.options ?? [];

    expect(endings.map((option) => option.value)).toEqual([
      ids.endings.thanks,
      ids.endings.noBundle,
      ids.endings.notForYou,
      ids.endings.internal,
    ]);
    expect(endings.find((option) => option.value === ids.endings.internal)?.label).toBe("Internal test");
    expect(endings.every((option) => !option.label.startsWith("workspace.surveys.edit.flow.end_label"))).toBe(
      true
    );
  });

  test("from the last block only the endings are left", () => {
    expect(labels(getJumpTargetGroups(surveyFlowFixture, 5, t))).toEqual([
      "workspace.surveys.edit.flow.target_endings",
    ]);
  });
});

describe("getFallbackTargetGroups", () => {
  test("offers today's Otherwise go to targets: Next block, every later block and every ending", () => {
    const endings = [ids.endings.thanks, ids.endings.noBundle, ids.endings.notForYou, ids.endings.internal];

    expect(values(getFallbackTargetGroups(surveyFlowFixture, 3, t))).toEqual([
      "defaultSelection",
      ids.blocks.overall,
      ids.blocks.profile,
      ...endings,
    ]);
    expect(values(getFallbackTargetGroups(surveyFlowFixture, 5, t))).toEqual([
      "defaultSelection",
      ...endings,
    ]);
  });

  test("Next block is the default, the one stored as no fallback", () => {
    const [next] = getFallbackTargetGroups(surveyFlowFixture, 0, t);

    expect(next.options).toEqual([
      expect.objectContaining({
        value: "defaultSelection",
        label: 'workspace.surveys.edit.flow.next_block_named {"name":"Ratings"}',
      }),
    ]);
  });

  test("from the last block, Next block has no name and the blocks group is gone", () => {
    const groups = getFallbackTargetGroups(surveyFlowFixture, 5, t);

    expect(labels(groups)).toEqual(["", "workspace.surveys.edit.flow.target_endings"]);
    expect(groups[0].options[0].label).toBe("workspace.surveys.edit.next_block");
  });
});
