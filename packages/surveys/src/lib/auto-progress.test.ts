import { describe, expect, test } from "vitest";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import {
  getAutoProgressElement,
  isSingleSelectOtherSelected,
  shouldHideSubmitButtonForAutoProgress,
  shouldTriggerAutoProgress,
} from "./auto-progress";

const createElement = (id: string, type: TSurveyElementTypeEnum, required: boolean): TSurveyElement =>
  ({
    id,
    type,
    required,
  }) as unknown as TSurveyElement;

const createSingleSelectElement = (required: boolean): TSurveyElement =>
  ({
    id: "single_select_1",
    type: TSurveyElementTypeEnum.MultipleChoiceSingle,
    required,
    choices: [
      { id: "choice_1", label: { default: "Choice 1", de: "Auswahl 1" } },
      { id: "choice_2", label: { default: "Choice 2" } },
      { id: "other", label: { default: "Other" } },
    ],
  }) as unknown as TSurveyElement;

const createPictureSelectionElement = (required: boolean, allowMulti: boolean): TSurveyElement =>
  ({
    id: "picture_1",
    type: TSurveyElementTypeEnum.PictureSelection,
    required,
    allowMulti,
    choices: [
      { id: "pic_1", imageUrl: "https://example.com/1.png" },
      { id: "pic_2", imageUrl: "https://example.com/2.png" },
    ],
  }) as unknown as TSurveyElement;

describe("auto-progress helpers", () => {
  test("returns auto-progress element for all supported single-question types only", () => {
    const ratingElement = createElement("rating_1", TSurveyElementTypeEnum.Rating, true);
    const npsElement = createElement("nps_1", TSurveyElementTypeEnum.NPS, false);
    const singleSelectElement = createSingleSelectElement(false);
    const singlePictureElement = createPictureSelectionElement(false, false);
    const multiPictureElement = createPictureSelectionElement(false, true);
    const openTextElement = createElement("text_1", TSurveyElementTypeEnum.OpenText, false);

    expect(getAutoProgressElement([ratingElement], true)).toEqual(ratingElement);
    expect(getAutoProgressElement([npsElement], true)).toEqual(npsElement);
    expect(getAutoProgressElement([singleSelectElement], true)).toEqual(singleSelectElement);
    expect(getAutoProgressElement([singlePictureElement], true)).toEqual(singlePictureElement);
    expect(getAutoProgressElement([multiPictureElement], true)).toBeNull();
    expect(getAutoProgressElement([openTextElement], true)).toBeNull();
    expect(getAutoProgressElement([ratingElement], false)).toBeNull();
    expect(getAutoProgressElement([ratingElement, npsElement], true)).toBeNull();
  });

  test("hides submit button only for required auto-progress elements with no required+other exception", () => {
    const requiredRating = createElement("rating_required", TSurveyElementTypeEnum.Rating, true);
    const optionalRating = createElement("rating_optional", TSurveyElementTypeEnum.Rating, false);
    const requiredSingleSelect = createSingleSelectElement(true);

    expect(shouldHideSubmitButtonForAutoProgress([requiredRating], true)).toBe(true);
    expect(shouldHideSubmitButtonForAutoProgress([optionalRating], true)).toBe(false);
    expect(shouldHideSubmitButtonForAutoProgress([requiredRating], false)).toBe(false);
    expect(
      shouldHideSubmitButtonForAutoProgress([requiredSingleSelect], true, {
        [requiredSingleSelect.id]: "",
      })
    ).toBe(false);
  });

  test("triggers auto-progress only when an eligible response was changed", () => {
    const autoProgressElement = createElement("rating_1", TSurveyElementTypeEnum.Rating, true);

    expect(
      shouldTriggerAutoProgress({
        changedElementId: "rating_1",
        mergedValue: { rating_1: 5 },
        autoProgressElement,
        isAlreadyInFlight: false,
      })
    ).toBe(true);

    expect(
      shouldTriggerAutoProgress({
        changedElementId: "other",
        mergedValue: { rating_1: 5 },
        autoProgressElement,
        isAlreadyInFlight: false,
      })
    ).toBe(false);

    expect(
      shouldTriggerAutoProgress({
        changedElementId: "rating_1",
        mergedValue: {},
        autoProgressElement,
        isAlreadyInFlight: false,
      })
    ).toBe(false);

    expect(
      shouldTriggerAutoProgress({
        changedElementId: "rating_1",
        mergedValue: { rating_1: 5 },
        autoProgressElement,
        isAlreadyInFlight: true,
      })
    ).toBe(false);

    expect(
      shouldTriggerAutoProgress({
        changedElementId: "rating_1",
        mergedValue: { rating_1: 5 },
        autoProgressElement,
        isAlreadyInFlight: false,
        isCommittedSelection: false,
      })
    ).toBe(false);
  });

  test("detects single-select other selection from sentinel and custom values", () => {
    const autoProgressElement = createSingleSelectElement(true);

    expect(
      isSingleSelectOtherSelected({
        autoProgressElement,
        mergedValue: { [autoProgressElement.id]: "" },
      })
    ).toBe(true);

    expect(
      isSingleSelectOtherSelected({
        autoProgressElement,
        mergedValue: { [autoProgressElement.id]: "Custom answer" },
      })
    ).toBe(true);

    expect(
      isSingleSelectOtherSelected({
        autoProgressElement,
        mergedValue: { [autoProgressElement.id]: "Choice 1" },
      })
    ).toBe(false);

    expect(
      isSingleSelectOtherSelected({
        autoProgressElement,
        mergedValue: { [autoProgressElement.id]: "Auswahl 1" },
      })
    ).toBe(false);

    expect(
      isSingleSelectOtherSelected({
        autoProgressElement,
        mergedValue: { [autoProgressElement.id]: "choice_1" },
      })
    ).toBe(false);
  });

  test("does not auto-progress when single-select other is selected", () => {
    const autoProgressElement = createSingleSelectElement(true);

    expect(
      shouldTriggerAutoProgress({
        changedElementId: autoProgressElement.id,
        mergedValue: { [autoProgressElement.id]: "" },
        autoProgressElement,
        isAlreadyInFlight: false,
      })
    ).toBe(false);

    expect(
      shouldTriggerAutoProgress({
        changedElementId: autoProgressElement.id,
        mergedValue: { [autoProgressElement.id]: "Custom answer" },
        autoProgressElement,
        isAlreadyInFlight: false,
      })
    ).toBe(false);
  });
});
