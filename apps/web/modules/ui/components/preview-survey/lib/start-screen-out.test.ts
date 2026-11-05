import { describe, expect, test } from "vitest";
import type { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { toJsWorkspaceStateSurvey } from "@/lib/survey/client-utils";
import { findStartScreenOut, getScreenOutFieldKey } from "./start-screen-out";

const withStartLogic = (startLogic: TSurveyBlockLogic[] | null): TSurvey => ({
  ...surveyFlowFixture,
  startLogic,
});

const find = (survey: TSurvey, hiddenFieldsRecord: Record<string, string> = {}) =>
  findStartScreenOut({
    survey: toJsWorkspaceStateSurvey(survey),
    hiddenFieldsRecord,
    languageCode: "default",
  });

const rule = (
  id: string,
  field: string,
  operator: "isSet" | "isNotSet",
  target: string,
  extra: TSurveyBlockLogic["actions"] = []
): TSurveyBlockLogic => ({
  id,
  conditions: {
    id: `${id}group`,
    connector: "and",
    conditions: [{ id: `${id}cond`, leftOperand: { type: "hiddenField", value: field }, operator }],
  },
  actions: [...extra, { id: `${id}jump`, objective: "jumpToBlock", target }],
});

const panelMissing = rule(
  "rulepanelmissing00000001",
  ids.hiddenFields.panelId,
  "isNotSet",
  ids.endings.notForYou
);
const segMissing = rule("rulesegmissing0000000001", ids.hiddenFields.seg, "isNotSet", ids.endings.noBundle);
const panelMissingToBlock = rule(
  "rulepanelblock0000000001",
  ids.hiddenFields.panelId,
  "isNotSet",
  ids.blocks.heavyUsers
);

/**
 * The rule before the first question that ended the editor preview (ENG-6969 T13 ①), worked out in
 * the editor the way the renderer's `startSurvey` decides it (P8, P33).
 */
describe("findStartScreenOut", () => {
  test("finds nothing when the survey has no rules before the first question", () => {
    expect(find(withStartLogic(null))).toBeNull();
    expect(find(withStartLogic([]))).toBeNull();
  });

  test("finds nothing when no rule matches the test values", () => {
    expect(find(withStartLogic([panelMissing]), { [ids.hiddenFields.panelId]: "4711" })).toBeNull();
  });

  test("a matching rule that jumps to a block is not a screen-out", () => {
    expect(find(withStartLogic([panelMissingToBlock]))).toBeNull();
  });

  test("a matching rule that jumps to an ending ended the preview", () => {
    expect(find(withStartLogic([panelMissing]))).toEqual({
      rule: panelMissing,
      endingId: ids.endings.notForYou,
    });
  });

  test("the first matching jump wins, also over a later screen-out", () => {
    expect(find(withStartLogic([segMissing, panelMissing]))).toEqual({
      rule: segMissing,
      endingId: ids.endings.noBundle,
    });
    expect(find(withStartLogic([panelMissingToBlock, panelMissing]))).toBeNull();
  });

  test("explains the fixture's screener until panel_id is given", () => {
    // The fixture's own start logic: "If panel_id is not set → Thanks — this survey isn't for you".
    expect(find(surveyFlowFixture)?.endingId).toBe(ids.endings.notForYou);
    expect(find(surveyFlowFixture, { [ids.hiddenFields.panelId]: "4711" })).toBeNull();
  });

  test("a jump to a deleted ending counts as no jump, as in the renderer", () => {
    const stale = rule(
      "rulestale000000000000001",
      ids.hiddenFields.panelId,
      "isNotSet",
      "deletedending00000000001"
    );
    expect(find(withStartLogic([stale]))).toBeNull();
  });
});

describe("getScreenOutFieldKey", () => {
  const keys = [ids.hiddenFields.panelId, ids.hiddenFields.seg];

  test("is the first field the rule reads that a test value can be given for", () => {
    expect(getScreenOutFieldKey(panelMissing, keys)).toBe(ids.hiddenFields.panelId);
    expect(getScreenOutFieldKey(segMissing, keys)).toBe(ids.hiddenFields.seg);
  });

  test("looks into nested groups and skips what isn't a test value", () => {
    const nested: TSurveyBlockLogic = {
      ...panelMissing,
      conditions: {
        id: "outergroup00000000000001",
        connector: "or",
        conditions: [
          {
            id: "urlcond00000000000000001",
            leftOperand: { type: "reserved", value: "url" },
            operator: "isSet",
          },
          { ...segMissing.conditions },
        ],
      },
    };
    expect(getScreenOutFieldKey(nested, keys)).toBe(ids.hiddenFields.seg);
    expect(getScreenOutFieldKey(nested, [])).toBeUndefined();
  });
});
