import { describe, expect, test } from "vitest";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import {
  getAutoProgressElement,
  shouldHideSubmitButtonForAutoProgress,
  shouldTriggerAutoProgress,
} from "./auto-progress";

const createElement = (id: string, type: TSurveyElementTypeEnum, required: boolean): TSurveyElement =>
  ({
    id,
    type,
    required,
  }) as unknown as TSurveyElement;

describe("auto-progress helpers", () => {
  test("returns auto-progress element for single rating/nps blocks only", () => {
    const ratingElement = createElement("rating_1", TSurveyElementTypeEnum.Rating, true);
    const npsElement = createElement("nps_1", TSurveyElementTypeEnum.NPS, false);
    const openTextElement = createElement("text_1", TSurveyElementTypeEnum.OpenText, false);

    expect(getAutoProgressElement([ratingElement], true)).toEqual(ratingElement);
    expect(getAutoProgressElement([npsElement], true)).toEqual(npsElement);
    expect(getAutoProgressElement([openTextElement], true)).toBeNull();
    expect(getAutoProgressElement([ratingElement], false)).toBeNull();
    expect(getAutoProgressElement([ratingElement, npsElement], true)).toBeNull();
  });

  test("hides submit button only for required auto-progress elements", () => {
    const requiredRating = createElement("rating_required", TSurveyElementTypeEnum.Rating, true);
    const optionalRating = createElement("rating_optional", TSurveyElementTypeEnum.Rating, false);

    expect(shouldHideSubmitButtonForAutoProgress([requiredRating], true)).toBe(true);
    expect(shouldHideSubmitButtonForAutoProgress([optionalRating], true)).toBe(false);
    expect(shouldHideSubmitButtonForAutoProgress([requiredRating], false)).toBe(false);
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
  });
});
