import { type TResponseData } from "@formbricks/types/responses";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";

const isAutoProgressElementType = (type: TSurveyElementTypeEnum): boolean =>
  type === TSurveyElementTypeEnum.Rating || type === TSurveyElementTypeEnum.NPS;

export const getAutoProgressElement = (
  elements: TSurveyElement[],
  isAutoProgressingEnabled: boolean
): TSurveyElement | null => {
  if (!isAutoProgressingEnabled || elements.length !== 1) {
    return null;
  }

  const [element] = elements;
  return isAutoProgressElementType(element.type) ? element : null;
};

export const shouldHideSubmitButtonForAutoProgress = (
  elements: TSurveyElement[],
  isAutoProgressingEnabled: boolean
): boolean => {
  const autoProgressElement = getAutoProgressElement(elements, isAutoProgressingEnabled);
  return Boolean(autoProgressElement?.required);
};

export const shouldTriggerAutoProgress = ({
  changedElementId,
  mergedValue,
  autoProgressElement,
  isAlreadyInFlight,
}: {
  changedElementId: string;
  mergedValue: TResponseData;
  autoProgressElement: TSurveyElement | null;
  isAlreadyInFlight: boolean;
}): boolean => {
  if (!autoProgressElement || isAlreadyInFlight || changedElementId !== autoProgressElement.id) {
    return false;
  }

  return mergedValue[autoProgressElement.id] !== undefined;
};
