import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import {
  SURVEY_FLOW_FIXTURE_IDS as ids,
  surveyFlowFixture,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { createShowIf, getShowIf, getShowIfScope, setOptionHidden, updateShowIf } from "./show-if-editing";

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

describe("option show-if and Hidden (ENG-6937)", () => {
  // `bundle` is question 3 of the Overall block (index 2); `brand_grid` is question 3 of Profile.
  const bundleOption = (optionId: string) =>
    ({ type: "option", blockIdx: 4, elementIdx: 2, listKey: "choices", optionId }) as const;
  const gridRow = (optionId: string) =>
    ({ type: "option", blockIdx: 5, elementIdx: 2, listKey: "rows", optionId }) as const;
  const condition: TConditionGroup = {
    id: "optionshowifgroup0000001",
    connector: "and",
    conditions: [
      {
        id: "optionshowifcond00000001",
        leftOperand: { type: "element", value: "fav" },
        operator: "isSubmitted",
      },
    ],
  };

  test("an option's show-if sees what its question's sees", () => {
    const scope = getShowIfScope(surveyFlowFixture, bundleOption("no_bundle"));

    expect(elementIds(scope.survey).slice(-2)).toEqual(["fav", "apple_reason"]);
    expect(scope.blockIdx).toBe(4);
  });

  test("a new option show-if starts on the question right above the option's question", () => {
    expect(createShowIf(surveyFlowFixture, bundleOption("no_bundle"), operator)?.conditions).toEqual([
      expect.objectContaining({ leftOperand: { type: "element", value: "apple_reason" } }),
    ]);
  });

  test("sets and removes an option's and a matrix row's show-if, key and all", () => {
    const withCondition = updateShowIf(surveyFlowFixture, bundleOption("no_bundle"), () => condition);
    const withRow = updateShowIf(withCondition, gridRow("row_netflix"), () => condition);

    expect(getShowIf(withRow, bundleOption("no_bundle"))).toEqual(condition);
    expect(getShowIf(withRow, gridRow("row_netflix"))).toEqual(condition);
    expect(getShowIf(surveyFlowFixture, bundleOption("no_bundle"))).toBeUndefined();
    expect(withRow.blocks[4].elements[2].showIf).toBeUndefined();

    const removed = updateShowIf(withRow, bundleOption("no_bundle"), () => undefined);
    const restored = updateShowIf(removed, gridRow("row_netflix"), (group) => ({ ...group, conditions: [] }));
    expect(restored).toEqual(surveyFlowFixture);
  });

  test("hiding and showing an option again drops the key, so the survey compares equal to the saved one", () => {
    const hidden = setOptionHidden(surveyFlowFixture, bundleOption("no_bundle"), true);
    const bundle = hidden.blocks[4].elements[2] as unknown as { choices: { id: string; hidden?: boolean }[] };

    expect(bundle.choices.find((choice) => choice.id === "no_bundle")?.hidden).toBe(true);
    expect(setOptionHidden(hidden, bundleOption("no_bundle"), false)).toEqual(surveyFlowFixture);
    // The fixture's Hidden bundle option shows again.
    const shown = setOptionHidden(surveyFlowFixture, bundleOption("netflix_apple"), false);
    expect(
      (
        shown.blocks[4].elements[2] as unknown as { choices: { id: string; hidden?: boolean }[] }
      ).choices.find((choice) => choice.id === "netflix_apple")
    ).not.toHaveProperty("hidden");
  });
});
