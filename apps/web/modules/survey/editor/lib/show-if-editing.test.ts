import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { createShowIf, getShowIf, getShowIfScope, updateShowIf } from "./show-if-editing";

/**
 * Show-if editing on the Flow tab (ENG-6931). The fixture's blocks: 0 services (`services`),
 * 1 ratings (`sat_netflix`, `sat_disney`), 2 heavy users (`hours`, block show-if), 3 concept,
 * 4 overall (`fav`, `apple_reason` with a show-if, `bundle`, `email`), 5 profile.
 */

const elementIds = (survey: TSurvey) => survey.blocks.flatMap((block) => block.elements.map((e) => e.id));
const operator = () => "isSubmitted" as const;

describe("getShowIfScope: the conditions editor offers only what the reference rule allows", () => {
  test("a block's show-if sees the earlier blocks only", () => {
    const scope = getShowIfScope(surveyFlowFixture, { type: "block", blockIdx: 2 });

    expect(elementIds(scope.survey)).toEqual(["services", "sat_netflix", "sat_disney"]);
    expect(scope.blockIdx).toBe(1);
    // Fields stay available.
    expect(scope.survey.hiddenFields).toEqual(surveyFlowFixture.hiddenFields);
  });

  test("a question's show-if sees the earlier blocks and the questions above it on its page", () => {
    const scope = getShowIfScope(surveyFlowFixture, { type: "element", blockIdx: 4, elementIdx: 2 });

    expect(elementIds(scope.survey).slice(-3)).toEqual(["concept", "fav", "apple_reason"]);
    expect(elementIds(scope.survey)).not.toContain("bundle");
    expect(scope.blockIdx).toBe(4);
  });

  test("the first question of a page sees the earlier blocks only", () => {
    const scope = getShowIfScope(surveyFlowFixture, { type: "element", blockIdx: 4, elementIdx: 0 });

    expect(elementIds(scope.survey).at(-1)).toBe("concept");
    expect(scope.blockIdx).toBe(3);
  });

  test("the first block sees no questions at all", () => {
    expect(elementIds(getShowIfScope(surveyFlowFixture, { type: "block", blockIdx: 0 }).survey)).toEqual([]);
  });
});

describe("createShowIf: a new show-if starts from the nearest question it may use", () => {
  test("a question's show-if starts on the question right above it", () => {
    const showIf = createShowIf(surveyFlowFixture, { type: "element", blockIdx: 4, elementIdx: 2 }, operator);

    expect(showIf).toMatchObject({
      connector: "and",
      conditions: [{ leftOperand: { type: "element", value: "apple_reason" }, operator: "isSubmitted" }],
    });
  });

  test("a block's show-if starts on the last question of the block before it", () => {
    expect(
      createShowIf(surveyFlowFixture, { type: "block", blockIdx: 4 }, operator)?.conditions[0]
    ).toMatchObject({ leftOperand: { type: "element", value: "concept" } });
  });

  test("a CTA without an external button can't be used, so it is passed over", () => {
    const survey = structuredClone(surveyFlowFixture);
    survey.blocks[3].elements = [
      {
        id: "intro_cta",
        type: TSurveyElementTypeEnum.CTA,
        headline: { default: "Read this" },
        required: false,
        buttonExternal: false,
      } as never,
    ];

    expect(createShowIf(survey, { type: "block", blockIdx: 4 }, operator)?.conditions[0]).toMatchObject({
      leftOperand: { type: "element", value: "hours" },
    });
  });

  test("with no question before it, it starts on a hidden field", () => {
    expect(
      createShowIf(surveyFlowFixture, { type: "block", blockIdx: 0 }, operator)?.conditions[0]
    ).toMatchObject({
      leftOperand: { type: "hiddenField", value: ids.hiddenFields.panelId },
      operator: "isSet",
    });
  });

  test("with nothing to use at all, there is no show-if to start", () => {
    const survey = structuredClone(surveyFlowFixture);
    survey.hiddenFields = { enabled: false, fieldIds: [] };

    expect(createShowIf(survey, { type: "block", blockIdx: 0 }, operator)).toBeNull();
  });
});

describe("updateShowIf and getShowIf", () => {
  const group: TConditionGroup = {
    id: "showifgroup0000000000009",
    connector: "or",
    conditions: [
      {
        id: "showifcond00000000000009",
        leftOperand: { type: "element", value: "services" },
        operator: "isSubmitted",
      },
    ],
  };

  test("sets a block's and a question's show-if without touching the input", () => {
    const blockTarget = { type: "block", blockIdx: 1 } as const;
    const elementTarget = { type: "element", blockIdx: 4, elementIdx: 3 } as const;

    const next = updateShowIf(
      updateShowIf(surveyFlowFixture, blockTarget, () => group),
      elementTarget,
      () => group
    );

    expect(getShowIf(next, blockTarget)).toEqual(group);
    expect(getShowIf(next, elementTarget)).toEqual(group);
    expect(getShowIf(surveyFlowFixture, blockTarget)).toBeUndefined();
  });

  test("a show-if left without conditions is removed, key and all", () => {
    const target = { type: "element", blockIdx: 4, elementIdx: 1 } as const;
    const next = updateShowIf(surveyFlowFixture, target, (showIf) => ({ ...showIf, conditions: [] }));

    expect("showIf" in next.blocks[4].elements[1]).toBe(false);
    expect(getShowIf(surveyFlowFixture, target)).toBeDefined();
  });

  test("removing a block's show-if drops the key", () => {
    const next = updateShowIf(surveyFlowFixture, { type: "block", blockIdx: 2 }, () => undefined);

    expect("showIf" in next.blocks[2]).toBe(false);
  });
});
