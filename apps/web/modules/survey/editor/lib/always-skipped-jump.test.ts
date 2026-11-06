import { describe, expect, test } from "vitest";
import type { TConditionGroup } from "@formbricks/types/surveys/logic";
import { surveyFlowFixture } from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getAlwaysSkippedFallback, getAlwaysSkippedJump } from "./always-skipped-jump";

// The fixture: block 0 Services (`services`), 1 Ratings, 2 Heavy users (shown only if `services`
// includes all of Netflix, Disney+ and Prime Video), 3 Concept, …
const heavyUsers = surveyFlowFixture.blocks[2];

const withHeavyUsersShowIf = (showIf: TConditionGroup): TSurvey => {
  const survey = structuredClone(surveyFlowFixture);
  survey.blocks[2].showIf = showIf;
  return survey;
};

const servicesCondition = (operator: string) => ({
  id: `c-${operator}`,
  leftOperand: { type: "element" as const, value: "services" },
  operator: operator as never,
});

describe("getAlwaysSkippedJump", () => {
  test("a start rule that jumps past Services into Heavy users always skips it", () => {
    expect(heavyUsers.showIf).toBeDefined();
    expect(getAlwaysSkippedJump(surveyFlowFixture, -1, heavyUsers.id)).toEqual({
      targetBlockId: heavyUsers.id,
      skippedElementIds: ["services"],
    });
  });

  test("a jump from after Services can reach Heavy users: Services may have the answer", () => {
    expect(getAlwaysSkippedJump(surveyFlowFixture, 0, heavyUsers.id)).toBeNull();
  });

  test("a jump to the very next block, or back, skips nothing", () => {
    expect(getAlwaysSkippedJump(surveyFlowFixture, 1, heavyUsers.id)).toBeNull();
    expect(getAlwaysSkippedJump(surveyFlowFixture, 3, heavyUsers.id)).toBeNull();
  });

  test("a block without a show-if is never flagged", () => {
    expect(getAlwaysSkippedJump(surveyFlowFixture, -1, surveyFlowFixture.blocks[3].id)).toBeNull();
  });

  test("“is skipped” on a skipped question holds, so that show-if can match", () => {
    const survey = withHeavyUsersShowIf({
      id: "g",
      connector: "and",
      conditions: [servicesCondition("isSkipped")],
    });
    expect(getAlwaysSkippedJump(survey, -1, heavyUsers.id)).toBeNull();
  });

  test("an or group is flagged only when every branch reads a skipped question", () => {
    const hiddenField = {
      id: "h",
      leftOperand: { type: "hiddenField" as const, value: "seg" },
      operator: "isSet" as never,
    };
    const both: TConditionGroup = {
      id: "g",
      connector: "or",
      conditions: [servicesCondition("isSubmitted"), hiddenField],
    };
    expect(getAlwaysSkippedJump(withHeavyUsersShowIf(both), -1, heavyUsers.id)).toBeNull();

    const andGroup: TConditionGroup = { ...both, connector: "and" };
    expect(getAlwaysSkippedJump(withHeavyUsersShowIf(andGroup), -1, heavyUsers.id)).toEqual({
      targetBlockId: heavyUsers.id,
      skippedElementIds: ["services"],
    });
  });
});

describe("getAlwaysSkippedFallback", () => {
  // Heavy users shown only if a Ratings question was answered: Services' "Otherwise go to" Heavy users
  // skips Ratings, so everyone it sends there lands on the block after it.
  const ratingsId = surveyFlowFixture.blocks[1].elements[0].id;
  const readsRatings = (): TSurvey => {
    const survey = withHeavyUsersShowIf({
      id: "g",
      connector: "and",
      conditions: [
        { id: "r", leftOperand: { type: "element", value: ratingsId }, operator: "isSubmitted" as never },
      ],
    });
    survey.blocks[0].logicFallback = heavyUsers.id;
    return survey;
  };

  test("an Otherwise go to past the question the target's show-if reads always skips it", () => {
    expect(getAlwaysSkippedFallback(readsRatings(), 0)).toEqual({
      targetBlockId: heavyUsers.id,
      skippedElementIds: [ratingsId],
    });
  });

  test("a block without an Otherwise go to, or one whose target can be shown, isn't flagged", () => {
    const noFallback = readsRatings();
    delete noFallback.blocks[0].logicFallback;
    expect(getAlwaysSkippedFallback(noFallback, 0)).toBeNull();

    // From after Ratings, Ratings may have the answer.
    const fromRatings = readsRatings();
    fromRatings.blocks[1].logicFallback = heavyUsers.id;
    expect(getAlwaysSkippedFallback(fromRatings, 1)).toBeNull();
  });
});
