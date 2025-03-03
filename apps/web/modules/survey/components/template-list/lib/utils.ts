import { TriggerUpdate } from "@/modules/survey/editor/types/survey-trigger";
import { ActionClass } from "@prisma/client";
import { TFnType } from "@tolgee/react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { InvalidInputError } from "@formbricks/types/errors";
import { TProject, TProjectConfigChannel, TProjectConfigIndustry } from "@formbricks/types/project";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import { TTemplate, TTemplateRole } from "@formbricks/types/templates";

export const replaceQuestionPresetPlaceholders = (
  question: TSurveyQuestion,
  project: TProject
): TSurveyQuestion => {
  if (!project) return question;
  const newQuestion = structuredClone(question);
  const defaultLanguageCode = "default";
  if (newQuestion.headline) {
    newQuestion.headline[defaultLanguageCode] = getLocalizedValue(
      newQuestion.headline,
      defaultLanguageCode
    ).replace("$[projectName]", project.name);
  }
  if (newQuestion.subheader) {
    newQuestion.subheader[defaultLanguageCode] = getLocalizedValue(
      newQuestion.subheader,
      defaultLanguageCode
    )?.replace("$[projectName]", project.name);
  }
  return newQuestion;
};

// replace all occurences of projectName with the actual project name in the current template
export const replacePresetPlaceholders = (template: TTemplate, project: any) => {
  const preset = structuredClone(template.preset);
  preset.name = preset.name.replace("$[projectName]", project.name);
  preset.questions = preset.questions.map((question) => {
    return replaceQuestionPresetPlaceholders(question, project);
  });
  return { ...template, preset };
};

export const getChannelMapping = (t: TFnType): { value: TProjectConfigChannel; label: string }[] => [
  { value: "website", label: t("common.website_survey") },
  { value: "app", label: t("common.app_survey") },
  { value: "link", label: t("common.link_survey") },
];

export const getIndustryMapping = (t: TFnType): { value: TProjectConfigIndustry; label: string }[] => [
  { value: "eCommerce", label: t("common.e_commerce") },
  { value: "saas", label: t("common.saas") },
  { value: "other", label: t("common.other") },
];

export const getRoleMapping = (t: TFnType): { value: TTemplateRole; label: string }[] => [
  { value: "productManager", label: t("common.product_manager") },
  { value: "customerSuccess", label: t("common.customer_success") },
  { value: "marketing", label: t("common.marketing") },
  { value: "sales", label: t("common.sales") },
  { value: "peopleManager", label: t("common.people_manager") },
];

const checkTriggersValidity = (triggers: TSurvey["triggers"], actionClasses: ActionClass[]) => {
  if (!triggers) return;

  // check if all the triggers are valid
  triggers.forEach((trigger) => {
    if (!actionClasses.find((actionClass) => actionClass.id === trigger.actionClass.id)) {
      throw new InvalidInputError("Invalid trigger id");
    }
  });

  // check if all the triggers are unique
  const triggerIds = triggers.map((trigger) => trigger.actionClass.id);

  if (new Set(triggerIds).size !== triggerIds.length) {
    throw new InvalidInputError("Duplicate trigger id");
  }
};

export const handleTriggerUpdates = (
  updatedTriggers: TSurvey["triggers"],
  currentTriggers: TSurvey["triggers"],
  actionClasses: ActionClass[]
) => {
  if (!updatedTriggers) return {};
  checkTriggersValidity(updatedTriggers, actionClasses);

  const currentTriggerIds = currentTriggers.map((trigger) => trigger.actionClass.id);
  const updatedTriggerIds = updatedTriggers.map((trigger) => trigger.actionClass.id);

  // added triggers are triggers that are not in the current triggers and are there in the new triggers
  const addedTriggers = updatedTriggers.filter(
    (trigger) => !currentTriggerIds.includes(trigger.actionClass.id)
  );

  // deleted triggers are triggers that are not in the new triggers and are there in the current triggers
  const deletedTriggers = currentTriggers.filter(
    (trigger) => !updatedTriggerIds.includes(trigger.actionClass.id)
  );

  // Construct the triggers update object
  const triggersUpdate: TriggerUpdate = {};

  if (addedTriggers.length > 0) {
    triggersUpdate.create = addedTriggers.map((trigger) => ({
      actionClassId: trigger.actionClass.id,
    }));
  }

  if (deletedTriggers.length > 0) {
    // disconnect the public triggers from the survey
    triggersUpdate.deleteMany = {
      actionClassId: {
        in: deletedTriggers.map((trigger) => trigger.actionClass.id),
      },
    };
  }

  [...addedTriggers, ...deletedTriggers].forEach((trigger) => {
    surveyCache.revalidate({
      actionClassId: trigger.actionClass.id,
    });
  });

  return triggersUpdate;
};
