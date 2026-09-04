import { describe, expect, test } from "vitest";
import type { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { PUBLIC_API_SURVEY_NAME_PLACEHOLDER } from "@formbricks/types/js-constants";
import { getSurveyDisplayName, getSurveyPagePosition, hasSurveyInstructions } from "./survey-page";

const block = (id: string) => ({ id, name: id, elements: [] });

interface SurveyShape {
  welcomeCardEnabled?: boolean;
  welcomeCardSubheader?: Record<string, string>;
  blockIds?: string[];
  endingCount?: number;
}

const makeSurvey = ({
  welcomeCardEnabled = false,
  welcomeCardSubheader,
  blockIds = ["b1", "b2", "b3"],
  endingCount = 1,
}: SurveyShape = {}): TJsWorkspaceStateSurvey =>
  ({
    welcomeCard: {
      enabled: welcomeCardEnabled,
      ...(welcomeCardSubheader ? { subheader: welcomeCardSubheader } : {}),
    },
    blocks: blockIds.map(block),
    endings: Array.from({ length: endingCount }, (_, i) => ({ id: `e${i.toString()}` })),
  }) as unknown as TJsWorkspaceStateSurvey;

describe("getSurveyPagePosition", () => {
  test("counts welcome, blocks and one ending", () => {
    // 1 welcome + 3 blocks + 1 ending
    expect(getSurveyPagePosition(makeSurvey({ welcomeCardEnabled: true }), "start").total).toBe(5);
  });

  test("omits the welcome card from the count when it is disabled", () => {
    expect(getSurveyPagePosition(makeSurvey(), "b1").total).toBe(4);
  });

  test("counts multiple endings as a single card, because only one is ever shown", () => {
    expect(getSurveyPagePosition(makeSurvey({ endingCount: 3 }), "b1").total).toBe(4);
  });

  test("omits the ending from the count when the survey has none", () => {
    expect(getSurveyPagePosition(makeSurvey({ endingCount: 0 }), "b1").total).toBe(3);
  });

  test("reports the welcome card as page 1", () => {
    expect(getSurveyPagePosition(makeSurvey({ welcomeCardEnabled: true }), "start")).toEqual({
      index: 1,
      total: 5,
    });
  });

  test("offsets block positions by the welcome card", () => {
    const survey = makeSurvey({ welcomeCardEnabled: true });
    expect(getSurveyPagePosition(survey, "b1").index).toBe(2);
    expect(getSurveyPagePosition(survey, "b3").index).toBe(4);
  });

  test("does not offset block positions when there is no welcome card", () => {
    const survey = makeSurvey();
    expect(getSurveyPagePosition(survey, "b1").index).toBe(1);
    expect(getSurveyPagePosition(survey, "b3").index).toBe(3);
  });

  test('treats "start" as page 1 even when the welcome card is disabled', () => {
    // The renderer still points at "start" before the first block resolves.
    expect(getSurveyPagePosition(makeSurvey(), "start")).toEqual({ index: 1, total: 4 });
  });

  test("reports an ending card as the last page", () => {
    expect(getSurveyPagePosition(makeSurvey({ welcomeCardEnabled: true }), "e0")).toEqual({
      index: 5,
      total: 5,
    });
  });

  test("reports an unresolvable block id as the last page rather than a negative index", () => {
    // A survey edited mid-session can leave the pointer aimed at a block that no longer exists;
    // findIndex returns -1, which must not surface as "page 0 of 4".
    expect(getSurveyPagePosition(makeSurvey(), "deleted-block")).toEqual({ index: 4, total: 4 });
  });

  test("never reports a total below 1", () => {
    const empty = makeSurvey({ blockIds: [], endingCount: 0 });
    expect(getSurveyPagePosition(empty, "start")).toEqual({ index: 1, total: 1 });
  });

  test("never reports an index above the total", () => {
    const survey = makeSurvey({ welcomeCardEnabled: true, blockIds: ["b1"], endingCount: 1 });
    const { index, total } = getSurveyPagePosition(survey, "b1");
    expect(total).toBe(3);
    expect(index).toBeLessThanOrEqual(total);
  });
});

describe("hasSurveyInstructions", () => {
  test("is true when the welcome card has a subheader", () => {
    expect(hasSurveyInstructions(makeSurvey({ welcomeCardSubheader: { default: "Take a minute." } }))).toBe(
      true
    );
  });

  test("is false when the survey has no subheader at all", () => {
    expect(hasSurveyInstructions(makeSurvey())).toBe(false);
  });

  test("is false for a subheader that is present but blank", () => {
    expect(hasSurveyInstructions(makeSurvey({ welcomeCardSubheader: { default: "   " } }))).toBe(false);
  });

  test("is true when only a translation is filled in", () => {
    // A survey may leave the default empty and translate only the languages it ships.
    expect(
      hasSurveyInstructions(makeSurvey({ welcomeCardSubheader: { default: "", "de-DE": "Kurz." } }))
    ).toBe(true);
  });

  test("does not depend on the welcome card being enabled", () => {
    // The instructions are exposed on every page, so they outlive the card that authored them.
    expect(
      hasSurveyInstructions(
        makeSurvey({ welcomeCardEnabled: false, welcomeCardSubheader: { default: "Take a minute." } })
      )
    ).toBe(true);
  });
});

describe("getSurveyDisplayName", () => {
  test("keeps a real survey name", () => {
    expect(getSurveyDisplayName("Product feedback")).toBe("Product feedback");
  });

  test("drops the public client API's placeholder", () => {
    // An app survey is fetched from the public client API, which substitutes this for every name.
    // Rendering it would announce an internal deprecation notice as the dialog's accessible name.
    expect(getSurveyDisplayName(PUBLIC_API_SURVEY_NAME_PLACEHOLDER)).toBeUndefined();
  });

  test("drops a missing or empty name", () => {
    expect(getSurveyDisplayName(undefined)).toBeUndefined();
    expect(getSurveyDisplayName("")).toBeUndefined();
    expect(getSurveyDisplayName("   ")).toBeUndefined();
  });

  test("keeps a name that merely contains the placeholder as a substring", () => {
    // Only an exact match is the API's substitution; anything else is a name someone chose.
    expect(getSurveyDisplayName(`Re: ${PUBLIC_API_SURVEY_NAME_PLACEHOLDER}`)).toBe(
      `Re: ${PUBLIC_API_SURVEY_NAME_PLACEHOLDER}`
    );
  });
});
