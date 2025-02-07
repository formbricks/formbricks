import { TriggerUpdate } from "@/modules/survey/survey-editor/types/survey-trigger";
import { ActionClass } from "@prisma/client";
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
    ).replace("{{projectName}}", project.name);
  }
  if (newQuestion.subheader) {
    newQuestion.subheader[defaultLanguageCode] = getLocalizedValue(
      newQuestion.subheader,
      defaultLanguageCode
    )?.replace("{{projectName}}", project.name);
  }
  return newQuestion;
};

// replace all occurences of projectName with the actual project name in the current template
export const replacePresetPlaceholders = (template: TTemplate, project: any) => {
  const preset = structuredClone(template.preset);
  preset.name = preset.name.replace("{{projectName}}", project.name);
  preset.questions = preset.questions.map((question) => {
    return replaceQuestionPresetPlaceholders(question, project);
  });
  return { ...template, preset };
};

export const channelMapping: {
  value: TProjectConfigChannel;
  label: string;
}[] = [
  { value: "website", label: "common.website_survey" },
  { value: "app", label: "common.app_survey" },
  { value: "link", label: "common.link_survey" },
];

export const industryMapping: { value: TProjectConfigIndustry; label: string }[] = [
  { value: "eCommerce", label: "common.e_commerce" },
  { value: "saas", label: "common.saas" },
  { value: "other", label: "common.other" },
];

export const roleMapping: { value: TTemplateRole; label: string }[] = [
  { value: "productManager", label: "common.product_manager" },
  { value: "customerSuccess", label: "common.customer_success" },
  { value: "marketing", label: "common.marketing" },
  { value: "sales", label: "common.sales" },
  { value: "peopleManager", label: "common.people_manager" },
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
