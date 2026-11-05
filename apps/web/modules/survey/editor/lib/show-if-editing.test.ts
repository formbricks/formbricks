import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import { surveyFlowFixture } from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import {
  applyOptionsShowIfDraft,
  canAddShowIf,
  canFinishShowIfDraft,
  createDraftShowIf,
  editShowIfDraft,
  getShowIf,
  getShowIfScope,
  hasUnchosenField,
  isShowIfComplete,
  setOptionHidden,
  updateShowIf,
} from "./show-if-editing";

/**
 * Show-if editing on the Flow tab (ENG-6931). The fixture's blocks: 0 services (`services`),
 * 1 ratings (`sat_netflix`, `sat_disney`), 2 heavy users (`hours`, block show-if), 3 concept,
 * 4 overall (`fav`, `apple_reason` with a show-if, `bundle`, `email`), 5 profile.
 */

const elementIds = (survey: TSurvey) => survey.blocks.flatMap((block) => block.elements.map((e) => e.id));

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

describe("createDraftShowIf: a new show-if starts with an empty field (ENG-6969 T6)", () => {
  test("it opens on one condition with no field picked yet", () => {
    const draft = createDraftShowIf();

    expect(draft.connector).toBe("and");
    expect(draft.conditions).toHaveLength(1);
    expect(draft.conditions[0]).toMatchObject({ leftOperand: { value: "" } });
  });

  test("Done stays disabled until a field is picked: a condition can't be stored without one", () => {
    expect(isShowIfComplete(createDraftShowIf())).toBe(false);
  });
});

describe("editShowIfDraft / canFinishShowIfDraft: emptying a saved show-if waits for Done", () => {
  const saved = getShowIf(surveyFlowFixture, { type: "block", blockIdx: 2 }) as TConditionGroup;
  const emptied: TConditionGroup = { ...saved, conditions: [] };

  test("deleting the last condition of a saved show-if keeps the empty draft open", () => {
    expect(editShowIfDraft(emptied, false)).toEqual({ type: "keep", draft: emptied });
  });

  test("Done is enabled on the emptied draft, and saving it removes the show-if", () => {
    expect(canFinishShowIfDraft(emptied, false)).toBe(true);

    const updated = updateShowIf(surveyFlowFixture, { type: "block", blockIdx: 2 }, () => emptied);
    expect(updated.blocks[2]).not.toHaveProperty("showIf");
  });

  test("a new show-if emptied the same way just closes: there is nothing to remove", () => {
    expect(editShowIfDraft({ ...createDraftShowIf(), conditions: [] }, true)).toEqual({ type: "close" });
    expect(canFinishShowIfDraft({ ...createDraftShowIf(), conditions: [] }, true)).toBe(false);
  });

  test("any other edit keeps the draft, and Done waits for it to be complete", () => {
    const draft = createDraftShowIf();
    expect(editShowIfDraft(draft, true)).toEqual({ type: "keep", draft });
    expect(canFinishShowIfDraft(draft, false)).toBe(false);
    expect(canFinishShowIfDraft(saved, false)).toBe(true);
  });
});

describe("canAddShowIf: a show-if needs something before it to depend on", () => {
  test("a question or a block with an earlier question can get one", () => {
    expect(canAddShowIf(surveyFlowFixture, { type: "element", blockIdx: 4, elementIdx: 2 })).toBe(true);
    expect(canAddShowIf(surveyFlowFixture, { type: "block", blockIdx: 4 })).toBe(true);
  });

  test("with no question before it, a hidden field is enough", () => {
    expect(canAddShowIf(surveyFlowFixture, { type: "block", blockIdx: 0 })).toBe(true);
  });

  test("a CTA without an external button records no answer, so it doesn't count", () => {
    const survey = structuredClone(surveyFlowFixture);
    survey.hiddenFields = { enabled: false, fieldIds: [] };
    survey.blocks[0].elements = [
      {
        id: "intro_cta",
        type: TSurveyElementTypeEnum.CTA,
        headline: { default: "Read this" },
        required: false,
        buttonExternal: false,
      } as never,
    ];

    expect(canAddShowIf(survey, { type: "block", blockIdx: 1 })).toBe(false);
  });

  test("with nothing to use at all, there is no show-if to start", () => {
    const survey = structuredClone(surveyFlowFixture);
    survey.hiddenFields = { enabled: false, fieldIds: [] };

    expect(canAddShowIf(survey, { type: "block", blockIdx: 0 })).toBe(false);
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

describe("show-if drafts: a popover saves only on Done", () => {
  const condition = {
    id: "draftcond000000000000001",
    leftOperand: { type: "element", value: "fav" },
    operator: "isSubmitted",
  } as const;
  const complete: TConditionGroup = {
    id: "draftgroup00000000000001",
    connector: "and",
    conditions: [condition],
  };

  test("a draft can be saved once every condition has what its operator needs", () => {
    expect(isShowIfComplete(complete)).toBe(true);
    // `equals` needs a value: Done stays disabled until one is picked.
    expect(isShowIfComplete({ ...complete, conditions: [{ ...condition, operator: "equals" }] })).toBe(false);
  });

  test("a draft without conditions can't be saved", () => {
    expect(isShowIfComplete({ ...complete, conditions: [] })).toBe(false);
  });

  const bundleOption = (optionId: string) =>
    ({ type: "option", blockIdx: 4, elementIdx: 2, listKey: "choices", optionId }) as const;

  test("Done writes the options draft's show-ifs and Hidden flags into the survey", () => {
    const draft = setOptionHidden(
      updateShowIf(surveyFlowFixture, bundleOption("no_bundle"), () => complete),
      bundleOption("netflix_apple"),
      false
    );

    const saved = applyOptionsShowIfDraft(surveyFlowFixture, draft, 4, 2, ["choices"]);

    expect(saved).toEqual(draft);
  });

  test("an untouched options draft leaves the survey equal to the saved one", () => {
    expect(applyOptionsShowIfDraft(surveyFlowFixture, surveyFlowFixture, 4, 2, ["choices"])).toEqual(
      surveyFlowFixture
    );
  });

  test("Done keeps what changed elsewhere in the survey while the popover was open", () => {
    const draft = updateShowIf(surveyFlowFixture, bundleOption("no_bundle"), () => complete);
    const changedMeanwhile = { ...surveyFlowFixture, name: "Renamed meanwhile" };

    const saved = applyOptionsShowIfDraft(changedMeanwhile, draft, 4, 2, ["choices"]);

    expect(saved.name).toBe("Renamed meanwhile");
    expect(getShowIf(saved, bundleOption("no_bundle"))).toEqual(complete);
  });
});

describe("hasUnchosenField: the options popover's cell while a condition is drafted", () => {
  const cond = (value: string) =>
    ({
      id: `c${value || "empty"}0000000000000000000`.slice(0, 24),
      leftOperand: { type: "element", value },
      operator: "equals",
    }) as const;

  test("a condition without its field reads as one to choose", () => {
    expect(hasUnchosenField({ id: "g1", connector: "and", conditions: [cond("fav"), cond("")] })).toBe(true);
  });

  test("conditions with every field chosen, values missing or not, have none to choose", () => {
    expect(hasUnchosenField({ id: "g1", connector: "and", conditions: [cond("fav"), cond("bundle")] })).toBe(
      false
    );
  });

  test("an unchosen field inside a nested group counts", () => {
    const nested: TConditionGroup = { id: "g2", connector: "or", conditions: [cond("")] };
    expect(hasUnchosenField({ id: "g1", connector: "and", conditions: [cond("fav"), nested] })).toBe(true);
  });
});
