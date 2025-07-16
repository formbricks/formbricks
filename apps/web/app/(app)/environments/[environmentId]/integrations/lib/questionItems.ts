import { getLocalizedValue } from "@/lib/i18n/utils";
import { replaceHeadlineRecall } from "@/lib/utils/recall";
import { TFnType } from "@tolgee/react";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export interface QuestionItem {
  id: string;
  name: string;
  type: TSurveyQuestionTypeEnum;
}

/**
 * Build a flat list of selectable question / metadata items for integrations.
 * Extracted to avoid duplication between integration modals.
 */
export const buildQuestionItems = (
  selectedSurvey: TSurvey | null | undefined,
  t: TFnType
): QuestionItem[] => {
  const questions: QuestionItem[] = selectedSurvey
    ? replaceHeadlineRecall(selectedSurvey, "default")?.questions.map((q) => ({
        id: q.id,
        name: getLocalizedValue(q.headline, "default"),
        type: q.type,
      })) || []
    : [];

  const variables: QuestionItem[] =
    selectedSurvey?.variables.map((variable) => ({
      id: variable.id,
      name: variable.name,
      type: TSurveyQuestionTypeEnum.OpenText,
    })) || [];

  const hiddenFields: QuestionItem[] = selectedSurvey?.hiddenFields.enabled
    ? selectedSurvey?.hiddenFields.fieldIds?.map((fId) => ({
        id: fId,
        name: `${t("common.hidden_field")} : ${fId}`,
        type: TSurveyQuestionTypeEnum.OpenText,
      })) || []
    : [];

  const metadata: QuestionItem[] = [
    {
      id: "metadata",
      name: t("common.metadata"),
      type: TSurveyQuestionTypeEnum.OpenText,
    },
  ];

  const createdAt: QuestionItem[] = [
    {
      id: "createdAt",
      name: t("common.created_at"),
      type: TSurveyQuestionTypeEnum.Date,
    },
  ];

  return [...questions, ...variables, ...hiddenFields, ...metadata, ...createdAt];
};
