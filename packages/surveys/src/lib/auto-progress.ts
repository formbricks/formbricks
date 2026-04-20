import { type TResponseData } from "@formbricks/types/responses";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";

const isAutoProgressElement = (element: TSurveyElement): boolean => {
  if (element.type === TSurveyElementTypeEnum.Rating || element.type === TSurveyElementTypeEnum.NPS) {
    return true;
  }

  if (element.type === TSurveyElementTypeEnum.MultipleChoiceSingle) {
    return true;
  }

  if (element.type === TSurveyElementTypeEnum.PictureSelection) {
    return !element.allowMulti;
  }

  return false;
};

const getAllChoiceLabels = (
  element: Extract<TSurveyElement, { type: TSurveyElementTypeEnum.MultipleChoiceSingle }>
) =>
  element.choices.filter((choice) => choice.id !== "other").flatMap((choice) => Object.values(choice.label));

export const isSingleSelectOtherSelected = ({
  autoProgressElement,
  mergedValue,
}: {
  autoProgressElement: TSurveyElement | null;
  mergedValue: TResponseData;
}): boolean => {
  if (!autoProgressElement || autoProgressElement.type !== TSurveyElementTypeEnum.MultipleChoiceSingle) {
    return false;
  }

  const hasOtherOption = autoProgressElement.choices.some((choice) => choice.id === "other");
  if (!hasOtherOption) {
    return false;
  }

  const currentValue = mergedValue[autoProgressElement.id];
  if (currentValue === undefined) {
    return false;
  }

  if (currentValue === "") {
    return true;
  }

  if (typeof currentValue !== "string") {
    return false;
  }

  const regularChoiceIds = autoProgressElement.choices
    .filter((choice) => choice.id !== "other")
    .map((choice) => choice.id);
  if (regularChoiceIds.includes(currentValue)) {
    return false;
  }

  return !getAllChoiceLabels(autoProgressElement).includes(currentValue);
};

export const getAutoProgressElement = (
  elements: TSurveyElement[],
  isAutoProgressingEnabled: boolean
): TSurveyElement | null => {
  if (!isAutoProgressingEnabled || elements.length !== 1) {
    return null;
  }

  const [element] = elements;
  return isAutoProgressElement(element) ? element : null;
};

export const shouldHideSubmitButtonForAutoProgress = (
  elements: TSurveyElement[],
  isAutoProgressingEnabled: boolean,
  mergedValue: TResponseData = {}
): boolean => {
  const autoProgressElement = getAutoProgressElement(elements, isAutoProgressingEnabled);
  if (!autoProgressElement?.required) {
    return false;
  }

  if (isSingleSelectOtherSelected({ autoProgressElement, mergedValue })) {
    return false;
  }

  return true;
};

export const shouldTriggerAutoProgress = ({
  changedElementId,
  mergedValue,
  autoProgressElement,
  isAlreadyInFlight,
  isCommittedSelection = true,
}: {
  changedElementId: string;
  mergedValue: TResponseData;
  autoProgressElement: TSurveyElement | null;
  isAlreadyInFlight: boolean;
  isCommittedSelection?: boolean;
}): boolean => {
  if (
    !autoProgressElement ||
    isAlreadyInFlight ||
    changedElementId !== autoProgressElement.id ||
    !isCommittedSelection
  ) {
    return false;
  }

  if (isSingleSelectOtherSelected({ autoProgressElement, mergedValue })) {
    return false;
  }

  return mergedValue[autoProgressElement.id] !== undefined;
};
