import { mockSurvey } from "@/app/api/(internal)/pipeline/lib/__mocks__/survey-follow-up.mock";
import { describe, expect, test } from "vitest";
import { type TI18nString } from "@formbricks/types/i18n";
import { ZSurvey } from "@formbricks/types/surveys/types";
import { mockSurveyLanguages } from "@/lib/survey/__mock__/survey.mock";

/**
 * ENG-3417: creator-supplied image alt text is respondent-facing copy, so once its default has text it
 * needs every enabled language, like `subheader`. An empty default marks the image decorative and needs
 * none. Lives in apps/web because the complete `TSurvey` fixtures live here.
 */
const both = (en: string, de: string): TI18nString => ({ default: en, de });

const buildSurvey = (alt: { element?: TI18nString; choice?: TI18nString; ending?: TI18nString }) => ({
  ...mockSurvey,
  followUps: [],
  questions: [],
  languages: mockSurveyLanguages,
  blocks: [
    {
      id: "pa4bl0ckzx9hq2m8tnw3kvjd",
      name: "Block 1",
      elements: [
        {
          id: "favourite",
          type: "pictureSelection",
          headline: both("Pick one", "Wähle eins"),
          required: true,
          allowMulti: false,
          imageUrl: "https://example.com/hero.jpg",
          ...(alt.element ? { imageAltText: alt.element } : {}),
          choices: [
            {
              id: "a",
              imageUrl: "https://example.com/a.jpg",
              ...(alt.choice ? { imageAltText: alt.choice } : {}),
            },
            { id: "b", imageUrl: "https://example.com/b.jpg" },
          ],
        },
      ],
    },
  ],
  endings: [
    {
      id: "e6ndx2k9wq4hz7m1tnb3vcjp",
      type: "endScreen",
      headline: both("Thanks!", "Danke!"),
      imageUrl: "https://example.com/thanks.jpg",
      ...(alt.ending ? { imageAltText: alt.ending } : {}),
    },
  ],
});

const issuePaths = (alt: Parameters<typeof buildSurvey>[0]): string[] =>
  ZSurvey.safeParse(buildSurvey(alt)).error?.issues.map((issue) => issue.path.join(".")) ?? [];

describe("image alt text refinement", () => {
  test("a fully translated alt text on element, choice and ending parses", () => {
    const result = ZSurvey.safeParse(
      buildSurvey({
        element: both("Hero shot", "Titelbild"),
        choice: both("Blue mug", "Blaue Tasse"),
        ending: both("Team waving", "Team winkt"),
      })
    );

    expect(result.error).toBeUndefined();
  });

  test("an empty default is decorative and needs no translations", () => {
    expect(
      issuePaths({ element: { default: "" }, choice: { default: "" }, ending: { default: "" } })
    ).toEqual([]);
  });

  test("a missing translation is reported on the element's alt text", () => {
    expect(issuePaths({ element: both("Hero shot", "") })).toContain("blocks.0.elements.0.imageAltText");
  });

  test("a missing translation is reported on the choice's alt text", () => {
    expect(issuePaths({ choice: both("Blue mug", "") })).toContain(
      "blocks.0.elements.0.choices.0.imageAltText"
    );
  });

  test("a missing translation is reported on the ending's alt text", () => {
    expect(issuePaths({ ending: both("Team waving", "") })).toContain("endings.0.imageAltText");
  });
});
