import { describe, expect, test, vi } from "vitest";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TResponseData } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { copyOptionsFrom } from "@formbricks/types/surveys/copied-options";
import { getPageVisibility } from "./block-flow";

vi.mock("@/lib/i18n", () => ({
  getLocalizedValue: vi.fn((value, language) =>
    typeof value === "object" ? value[language] || value["default"] || "" : value
  ),
}));

/**
 * Copied options at runtime (ENG-6938): a question whose options are copied from an earlier one offers
 * exactly the options the respondent picked there, plus its fixed options, in every language. Answers
 * are stored as labels in the respondent's language, so a German respondent's picks are German labels.
 *
 * b1 asks "brands" (the source, of the type under test). b2 asks "fav", which copies its options and
 * adds a fixed "None of these".
 */

let sequence = 0;
const createId = () => {
  sequence += 1;
  return `copiedrt${String(sequence).padStart(16, "0")}`;
};

const brand = (id: string, name: string, code: string) => ({
  id,
  code,
  label: { default: name, de: `${name} (de)` },
});

const sourceOfType = (type: string) => ({
  id: "brands",
  type,
  headline: { default: "Brands you know" },
  required: false,
  choices: [brand("acme", "Acme", "1"), brand("globex", "Globex", "2"), brand("initech", "Initech", "3")],
});

const makeSurvey = (sourceType: string, targetType: string) => {
  const source = sourceOfType(sourceType);
  const target = {
    id: "fav",
    type: targetType,
    headline: { default: "Favourite" },
    required: false,
    optionsCopiedFrom: "brands",
    choices: [{ id: "none", code: "4", label: { default: "None of these", de: "Keine davon" } }],
  };
  target.choices = copyOptionsFrom(source, target, { createId }) as typeof target.choices;

  return {
    id: "survey1",
    name: "Survey",
    blocks: [
      { id: "b1", name: "b1", elements: [source] },
      { id: "b2", name: "b2", elements: [target] },
    ],
    endings: [{ id: "end1", type: "endScreen", headline: { default: "end" } }],
    variables: [],
    embeddedFields: [],
    welcomeCard: { enabled: false },
    languages: [],
  } as unknown as TJsWorkspaceStateSurvey;
};

const offeredIn = (survey: TJsWorkspaceStateSurvey, responseData: TResponseData, language: string) => {
  const page = getPageVisibility({
    survey,
    blockId: "b2",
    responseData,
    variables: {},
    selectedLanguage: language,
    reservedFieldValues: {},
  });
  if (!page.visibleElementIds.includes("fav")) return null;
  const notShown = page.optionsNotShown.fav?.choices ?? [];
  const fav = survey.blocks[1].elements[0] as unknown as { choices: { id: string }[] };
  return fav.choices.map((choice) => choice.id).filter((id) => !notShown.includes(id));
};

describe("copied options: the target offers what was picked in the source", () => {
  test.each([
    ["multipleChoiceMulti", TSurveyElementTypeEnum.MultipleChoiceMulti],
    ["ranking", TSurveyElementTypeEnum.Ranking],
  ])("from a %s, in the default language and in German", (_name, sourceType) => {
    const survey = makeSurvey(sourceType, TSurveyElementTypeEnum.MultipleChoiceSingle);

    expect(offeredIn(survey, { brands: ["Acme", "Initech"] }, "default")).toEqual([
      "acme",
      "initech",
      "none",
    ]);
    expect(offeredIn(survey, { brands: ["Globex (de)"] }, "de")).toEqual(["globex", "none"]);
  });

  test("from a single select, which holds one pick", () => {
    const survey = makeSurvey(TSurveyElementTypeEnum.MultipleChoiceSingle, TSurveyElementTypeEnum.Ranking);

    expect(offeredIn(survey, { brands: "Globex" }, "default")).toEqual(["globex", "none"]);
    expect(offeredIn(survey, { brands: "Acme (de)" }, "de")).toEqual(["acme", "none"]);
  });

  test("nothing picked leaves only the fixed option", () => {
    const survey = makeSurvey(
      TSurveyElementTypeEnum.MultipleChoiceMulti,
      TSurveyElementTypeEnum.MultipleChoiceMulti
    );

    expect(offeredIn(survey, {}, "default")).toEqual(["none"]);
  });

  test("pictures copied from a picture selection follow the picked ids", () => {
    const picture = (id: string) => ({ id, imageUrl: `https://example.com/${id}.png` });
    const source = {
      id: "brands",
      type: TSurveyElementTypeEnum.PictureSelection,
      headline: { default: "Posters" },
      required: false,
      allowMulti: true,
      choices: [picture("acme"), picture("globex"), picture("initech")],
    };
    const target = {
      id: "fav",
      type: TSurveyElementTypeEnum.PictureSelection,
      headline: { default: "Favourite poster" },
      required: false,
      allowMulti: false,
      optionsCopiedFrom: "brands",
      choices: [] as unknown[],
    };
    target.choices = copyOptionsFrom(source, target, { createId });
    const survey = {
      ...makeSurvey(TSurveyElementTypeEnum.MultipleChoiceMulti, TSurveyElementTypeEnum.MultipleChoiceMulti),
      blocks: [
        { id: "b1", name: "b1", elements: [source] },
        { id: "b2", name: "b2", elements: [target] },
      ],
    } as unknown as TJsWorkspaceStateSurvey;

    expect(offeredIn(survey, { brands: ["globex", "initech"] }, "de")).toEqual(["globex", "initech"]);
  });
});
