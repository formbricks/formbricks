import { InvalidInputError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { updateSurveyInternal } from "@/lib/survey/service";
import { TriggerUpdate } from "@/modules/survey/editor/types/survey-trigger";

export const updateSurveyDraft = async (updatedSurvey: TSurvey): Promise<TSurvey> => {
  // Use the internal variant with validation disabled so drafts can remain incomplete while editing.
  return updateSurveyInternal(updatedSurvey, true);
};

export const updateSurvey = async (updatedSurvey: TSurvey): Promise<TSurvey> => {
  return updateSurveyInternal(updatedSurvey);
};

const getTriggerIds = (triggers: unknown): string[] | null => {
  if (!triggers) return null;
  if (!Array.isArray(triggers)) {
    throw new InvalidInputError("Invalid trigger id");
  }

  return triggers.map((trigger) => {
    const actionClassId = (trigger as { actionClass?: { id?: unknown } })?.actionClass?.id;
    if (typeof actionClassId !== "string") {
      throw new InvalidInputError("Invalid trigger id");
    }
    return actionClassId;
  });
};

export const checkTriggersValidity = (triggers: unknown, actionClasses: Array<{ id: string }>) => {
  const triggerIds = getTriggerIds(triggers);
  if (!triggerIds) return;

  triggerIds.forEach((triggerId) => {
    if (!actionClasses.find((actionClass) => actionClass.id === triggerId)) {
      throw new InvalidInputError("Invalid trigger id");
    }
  });

  if (new Set(triggerIds).size !== triggerIds.length) {
    throw new InvalidInputError("Duplicate trigger id");
  }
};

export const handleTriggerUpdates = (
  updatedTriggers: unknown,
  currentTriggers: unknown,
  actionClasses: Array<{ id: string }>
) => {
  const updatedTriggerIds = getTriggerIds(updatedTriggers);
  if (!updatedTriggerIds) return {};

  checkTriggersValidity(updatedTriggers, actionClasses);

  const currentTriggerIds = getTriggerIds(currentTriggers) ?? [];
  const addedTriggerIds = updatedTriggerIds.filter((triggerId) => !currentTriggerIds.includes(triggerId));
  const deletedTriggerIds = currentTriggerIds.filter((triggerId) => !updatedTriggerIds.includes(triggerId));
  const triggersUpdate: TriggerUpdate = {};

  if (addedTriggerIds.length > 0) {
    triggersUpdate.create = addedTriggerIds.map((triggerId) => ({
      actionClassId: triggerId,
    }));
  }

  if (deletedTriggerIds.length > 0) {
    triggersUpdate.deleteMany = {
      actionClassId: {
        in: deletedTriggerIds,
      },
    };
  }

  return triggersUpdate;
};
