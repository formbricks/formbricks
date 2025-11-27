import { TFunction } from "i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

export const convertFloatToNDecimal = (num: number, N: number = 2) => {
  return Math.round(num * Math.pow(10, N)) / Math.pow(10, N);
};

export const convertFloatTo2Decimal = (num: number) => {
  return Math.round(num * 100) / 100;
};

export const constructToastMessage = (
  elementType: TSurveyElementTypeEnum,
  filterValue: string,
  survey: TSurvey,
  elementId: string,
  t: TFunction,
  filterComboBoxValue?: string | string[]
) => {
  const elements = getElementsFromBlocks(survey.blocks);
  const elementIdx = elements.findIndex((element) => element.id === elementId);
  if (elementType === "matrix") {
    return t("environments.surveys.summary.added_filter_for_responses_where_answer_to_question", {
      questionIdx: elementIdx + 1,
      filterComboBoxValue: filterComboBoxValue?.toString() ?? "",
      filterValue,
    });
  } else if (filterComboBoxValue === undefined) {
    return t("environments.surveys.summary.added_filter_for_responses_where_answer_to_question_is_skipped", {
      questionIdx: elementIdx + 1,
    });
  } else {
    return t("environments.surveys.summary.added_filter_for_responses_where_answer_to_question", {
      questionIdx: elementIdx + 1,
      filterComboBoxValue: Array.isArray(filterComboBoxValue)
        ? filterComboBoxValue.join(",")
        : filterComboBoxValue,
      filterValue,
    });
  }
};
