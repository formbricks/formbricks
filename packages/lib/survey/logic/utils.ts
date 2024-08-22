import { createId } from "@paralleldrive/cuid2";
import {
  TActionBase,
  TActionObjective,
  TConditionBase,
  TSurveyAdvancedLogic,
} from "@formbricks/types/surveys/logic";

export const performOperationsOnConditions = (action, advancedLogicCopy, logicIdx, resourceId, condition) => {
  const logicItem = advancedLogicCopy[logicIdx];

  console.log("performOperationsOnConditions", action, resourceId, logicItem.conditions);

  if (action === "addConditionBelow") {
    addConditionBelow(logicItem.conditions, resourceId, condition);
  } else if (action === "toggleConnector") {
    console.log("toggleConnector", resourceId, logicItem.conditions);
    toggleGroupConnector(logicItem.conditions, resourceId);
  } else if (action === "removeCondition") {
    removeCondition(logicItem.conditions, resourceId);
  } else if (action === "duplicateCondition") {
    duplicateCondition(logicItem.conditions, resourceId);
  } else if (action === "createGroup") {
    createGroupFromResource(logicItem.conditions, resourceId);
  }

  advancedLogicCopy[logicIdx] = {
    ...logicItem,
    conditions: logicItem.conditions,
  };
};

export const performOperationsOnActions = () => {};

export const removeAction = (actions: TSurveyAdvancedLogic["actions"], idx: number) => {
  return actions.slice(0, idx).concat(actions.slice(idx + 1));
};

// write the recursive function below, check if the conditions is of type group
export const addConditionBelow = (
  group: TSurveyAdvancedLogic["conditions"],
  resourceId: string,
  condition: TConditionBase
) => {
  for (let i = 0; i < group.length; i++) {
    const { type, id } = group[i];

    if (type !== "group") {
      if (id === resourceId) {
        group.splice(i + 1, 0, condition);
        break;
      }
    } else {
      if (group[i].id === resourceId) {
        group.splice(i + 1, 0, condition);
        break;
      } else {
        if (type === "group") {
          addConditionBelow(group[i].conditions, resourceId, condition);
        }
      }
    }
  }
};

export const toggleGroupConnector = (group: TSurveyAdvancedLogic["conditions"], resourceId: string) => {
  for (let i = 0; i < group.length; i++) {
    const { type, id } = group[i];

    if (id === resourceId) {
      console.log("madarchod", group[i].connector);
      group[i].connector = group[i].connector === "and" ? "or" : "and";
      return;
    }

    if (type === "group") toggleGroupConnector(group[i].conditions, resourceId);
  }
};

export const removeCondition = (group: TSurveyAdvancedLogic["conditions"], resourceId: string) => {
  for (let i = 0; i < group.length; i++) {
    const { type, id } = group[i];

    if (id === resourceId) {
      if (i === 0) group[i + 1].connector = null;
      group.splice(i, 1);
      return;
    }

    if (type === "group") removeCondition(group[i].conditions, resourceId);
  }
};

export const duplicateCondition = (group: TSurveyAdvancedLogic["conditions"], resourceId: string) => {
  for (let i = 0; i < group.length; i++) {
    const { type, id } = group[i];

    if (id === resourceId) {
      group.splice(i + 1, 0, {
        ...group[i],
        id: createId(),
        connector: i === 0 ? "and" : group[i].connector,
      });
      return;
    }

    if (type === "group") duplicateCondition(group[i].conditions, resourceId);
  }
};

export const createGroupFromResource = (group: TSurveyAdvancedLogic["conditions"], resourceId: string) => {
  for (let i = 0; i < group.length; i++) {
    const { type, id } = group[i];

    if (id === resourceId) {
      group[i] = {
        id: createId(),
        type: "group",
        connector: group.length === 1 ? null : group[i].connector || "and",
        conditions: [{ ...group[i], connector: null }],
      };
      return;
    }

    if (type === "group") createGroupFromResource(group[i].conditions, resourceId);
  }
};

export const actionObjectiveOptions: { label: string; value: TActionObjective }[] = [
  { label: "Calculate", value: TActionObjective.Calculate },
  { label: "Require Answer", value: TActionObjective.RequireAnswer },
  { label: "Jump to question", value: TActionObjective.JumpToQuestion },
];
