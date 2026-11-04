import { describe, expect, test } from "vitest";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TResponseData } from "@formbricks/types/responses";
import {
  SURVEY_FLOW_FIXTURE_IDS,
  surveyFlowFixture,
  surveyFlowFixtureNotShown,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { advanceFromBlock } from "./block-flow";
import {
  type TNotShownStep,
  appendNotShownStep,
  buildNotShownRecord,
  getRestorableNotShownSteps,
  mergeSubmittedAnswers,
} from "./not-shown-record";

const survey = surveyFlowFixture as unknown as TJsWorkspaceStateSurvey;
const { blocks } = SURVEY_FLOW_FIXTURE_IDS;

/**
 * The renderer's bookkeeping, without rendering: the card it shows, its history, the steps and the
 * answers. `submit` and `back` do what `survey.tsx`'s `onSubmit` and `onBack` do with the decision
 * `advanceFromBlock` returns.
 */
const startRespondent = () => {
  let cardId = "start";
  let history: string[] = [];
  let steps: TNotShownStep[] = [];
  let responseData: TResponseData = {};

  return {
    get cardId() {
      return cardId;
    },
    submit(answers: TResponseData = {}) {
      const decision = advanceFromBlock({
        survey,
        blockId: cardId,
        responseData,
        submittedData: answers,
        variables: {},
        selectedLanguage: "default",
        reservedFieldValues: {},
      });
      steps = appendNotShownStep(steps, history.length, {
        blockId: cardId,
        hiddenElementIds: decision.hiddenElementIds,
        skippedBlockIds: decision.skippedBlockIds,
        optionsNotShown: decision.optionsNotShown,
      });
      responseData = { ...responseData, ...decision.submittedData };
      history = [...history, cardId];
      cardId = decision.nextCardId;
      return buildNotShownRecord(survey, steps);
    },
    back() {
      cardId = history[history.length - 1];
      history = history.slice(0, -1);
    },
  };
};

const netflixOnly = { services: ["Netflix"] };
const bigThree = { services: ["Netflix", "Disney+", "Prime Video"] };
const allFour = { services: ["Netflix", "Disney+", "Prime Video", "Apple TV+"] };
/** ENG-6937: the Overall page never offers the Hidden bundle option. */
const hiddenBundleOption = { options: { bundle: ["netflix_apple"] } };

describe("the not-shown record the survey sends", () => {
  test("lists a block whose show-if failed and a question hidden on its page", () => {
    const respondent = startRespondent();
    respondent.submit();
    respondent.submit(netflixOnly);
    expect(respondent.submit({ sat_netflix: 5 })).toEqual({ blocks: [blocks.heavyUsers] });
    expect(respondent.cardId).toBe(blocks.concept);
    respondent.submit({ concept: 9 });

    expect(respondent.submit({ fav: "Netflix", bundle: "Yes" })).toEqual(surveyFlowFixtureNotShown);
  });

  test("is empty, not unknown, when the respondent was shown everything on their path", () => {
    const respondent = startRespondent();
    respondent.submit();

    expect(respondent.submit(bigThree)).toEqual({});
  });

  test("after Back and a changed answer, a block that is no longer shown joins the record", () => {
    const respondent = startRespondent();
    respondent.submit();
    respondent.submit(bigThree);
    respondent.submit({ sat_netflix: 5 });
    expect(respondent.cardId).toBe(blocks.heavyUsers);
    expect(respondent.submit({ hours: "12" })).toEqual({});

    respondent.back();
    respondent.back();
    respondent.back();
    expect(respondent.cardId).toBe(blocks.services);
    respondent.submit(netflixOnly);

    expect(respondent.submit({ sat_netflix: 5 })).toEqual({ blocks: [blocks.heavyUsers] });
  });

  test("after Back and a changed answer, a block shown again drops out of the record", () => {
    const respondent = startRespondent();
    respondent.submit();
    respondent.submit(netflixOnly);
    expect(respondent.submit({ sat_netflix: 5 })).toEqual({ blocks: [blocks.heavyUsers] });

    respondent.back();
    respondent.back();
    respondent.submit(bigThree);

    expect(respondent.submit({ sat_netflix: 5 })).toEqual({});
    expect(respondent.cardId).toBe(blocks.heavyUsers);
  });

  test("re-submitting a page with a changed answer hides the follow-up it showed before", () => {
    const respondent = startRespondent();
    respondent.submit();
    respondent.submit(allFour);
    respondent.submit({ sat_netflix: 5 });
    respondent.submit({ hours: "12" });
    respondent.submit({ concept: 9 });
    expect(respondent.submit({ fav: "Apple TV+", apple_reason: "Price" })).toEqual(hiddenBundleOption);

    respondent.back();
    expect(respondent.cardId).toBe(blocks.overall);

    expect(respondent.submit({ fav: "Netflix", apple_reason: "Price" })).toEqual({
      elements: ["apple_reason"],
      ...hiddenBundleOption,
    });
  });
});

describe("offline progress (ENG-6936)", () => {
  const step = (blockId: string): TNotShownStep => ({ blockId, hiddenElementIds: [], skippedBlockIds: [] });

  test("restores the steps of blocks that still exist, aligned with the restored history", () => {
    const steps = [step("start"), step(blocks.services), step("deleted-block"), step(blocks.overall)];
    expect(getRestorableNotShownSteps(survey, steps).map((kept) => kept.blockId)).toEqual([
      "start",
      blocks.services,
      blocks.overall,
    ]);
  });

  test("the answers saved after a submit leave out the ones the record now lists", () => {
    expect(
      mergeSubmittedAnswers({ services: ["netflix"], apple_reason: "Price" }, { fav: "Netflix" }, [
        "apple_reason",
      ])
    ).toEqual({ services: ["netflix"], fav: "Netflix" });
  });
});
