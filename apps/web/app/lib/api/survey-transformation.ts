import { createId } from "@paralleldrive/cuid2";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { InvalidInputError } from "@formbricks/types/errors";
import {
  type TSurveyBlock,
  type TSurveyBlockLogic,
  type TSurveyBlockLogicAction,
} from "@formbricks/types/surveys/blocks";
import { type TConditionGroup, type TSingleCondition } from "@formbricks/types/surveys/logic";
import {
  type TSurveyEnding,
  TSurveyLogicAction,
  type TSurveyQuestion,
} from "@formbricks/types/surveys/types";
import { isConditionGroup, isSingleCondition } from "@formbricks/types/surveys/validation";
import { structuredClone } from "@/lib/pollyfills/structuredClone";

type Condition = TSingleCondition | TConditionGroup;

const conditionReferencesCTA = (
  condition: Condition | null | undefined,
  ctaElementId: string,
  operator?: string
): boolean => {
  if (!condition) return false;

  if (isSingleCondition(condition)) {
    if (condition.leftOperand.value === ctaElementId) {
      if (operator) {
        return condition.operator === operator;
      }
      return true;
    }
    return false;
  }

  if (isConditionGroup(condition)) {
    return condition.conditions.some((c) => conditionReferencesCTA(c, ctaElementId, operator));
  }

  return false;
};

const removeCtaConditions = (
  conditionGroup: TConditionGroup,
  ctaElementId: string,
  operatorsToRemove: string[]
): TConditionGroup | null => {
  const filteredConditions = conditionGroup.conditions.filter((condition) => {
    if (isSingleCondition(condition)) {
      if (condition.leftOperand.value === ctaElementId) {
        return !operatorsToRemove.includes(condition.operator);
      }
      return true;
    }

    if (isConditionGroup(condition)) {
      const cleaned = removeCtaConditions(condition, ctaElementId, operatorsToRemove);
      if (!cleaned || cleaned.conditions.length === 0) {
        return false;
      }
      Object.assign(condition, cleaned);
      return true;
    }

    return true;
  });

  if (filteredConditions.length === 0) {
    return null;
  }

  return {
    ...conditionGroup,
    conditions: filteredConditions,
  };
};

const migrateCTAQuestion = (question: Record<string, unknown>): void => {
  if (question.type !== "cta") return;

  const hasExternalButton = question.buttonExternal === true && Boolean(question.buttonUrl);

  if (hasExternalButton) {
    if (question.buttonLabel) {
      question.ctaButtonLabel = question.buttonLabel;
    }
    question.buttonExternal = true;
  } else {
    delete question.buttonExternal;
    delete question.buttonUrl;
  }

  delete question.buttonLabel;
  delete question.dismissButtonLabel;
};

const cleanCTALogicFromQuestion = (
  question: Record<string, unknown>,
  ctaQuestions: Map<string, boolean>
): void => {
  if (!question.logic || !Array.isArray(question.logic) || question.logic.length === 0) return;

  const cleanedLogic: unknown[] = [];

  question.logic.forEach((logicRule: { conditions: TConditionGroup; [key: string]: unknown }) => {
    let shouldKeepRule = true;
    let modifiedConditions = logicRule.conditions;

    ctaQuestions.forEach((hasExternalButton, ctaId) => {
      if (!hasExternalButton) {
        if (conditionReferencesCTA(modifiedConditions, ctaId)) {
          const cleanedConditions = removeCtaConditions(modifiedConditions, ctaId, [
            "isClicked",
            "isSkipped",
          ]);
          if (!cleanedConditions?.conditions || cleanedConditions.conditions.length === 0) {
            shouldKeepRule = false;
          } else {
            modifiedConditions = cleanedConditions;
          }
        }
      } else if (conditionReferencesCTA(modifiedConditions, ctaId, "isSkipped")) {
        const cleanedConditions = removeCtaConditions(modifiedConditions, ctaId, ["isSkipped"]);
        if (!cleanedConditions?.conditions || cleanedConditions.conditions.length === 0) {
          shouldKeepRule = false;
        } else {
          modifiedConditions = cleanedConditions;
        }
      }
    });

    if (shouldKeepRule) {
      cleanedLogic.push({
        ...logicRule,
        conditions: modifiedConditions,
      });
    }
  });

  if (cleanedLogic.length === 0) {
    delete question.logic;
  } else {
    question.logic = cleanedLogic;
  }
};

const processCTAQuestions = (questions: Record<string, unknown>[]): void => {
  const ctaQuestions = new Map<string, boolean>();

  questions.forEach((question) => {
    if (question.type === "cta") {
      const hasExternalButton = question.buttonExternal === true && Boolean(question.buttonUrl);
      ctaQuestions.set(question.id as string, hasExternalButton);
    }
  });

  if (ctaQuestions.size === 0) return;

  questions.forEach((question) => {
    migrateCTAQuestion(question);
  });

  questions.forEach((question) => {
    cleanCTALogicFromQuestion(question, ctaQuestions);
  });
};

const getBlockName = (questionIdx: number): string => {
  return `Block ${String(questionIdx + 1)}`;
};

const updateLogicActions = (
  actions: TSurveyLogicAction[],
  questionIdToBlockId: Map<string, string>,
  endingIds: Set<string>
): TSurveyBlockLogicAction[] => {
  return actions.map((action) => {
    if (action.objective === "jumpToQuestion") {
      const target = action.target;
      const blockId = questionIdToBlockId.get(target);

      if (blockId) {
        return {
          ...action,
          objective: "jumpToBlock",
          target: blockId,
        };
      }

      if (endingIds.has(target)) {
        return {
          ...action,
          objective: "jumpToBlock",
          target,
        };
      }

      return {
        ...action,
        objective: "jumpToBlock",
        target,
      };
    }

    return action as TSurveyBlockLogicAction;
  });
};

const updateLogicFallback = (
  fallback: string,
  questionIdToBlockId: Map<string, string>,
  endingIds: Set<string>
): string | undefined => {
  const blockId = questionIdToBlockId.get(fallback);

  if (blockId) {
    return blockId;
  }

  if (endingIds.has(fallback)) {
    return fallback;
  }

  return undefined;
};

const convertQuestionToElementType = (condition: Condition | null | undefined): Condition | null => {
  if (!condition) return null;

  if (isSingleCondition(condition)) {
    const newCondition = { ...condition } as Record<string, unknown>;
    const leftOperand = { ...condition.leftOperand } as Record<string, unknown>;

    if ((leftOperand.type as string) === "question") {
      leftOperand.type = "element";
    }
    newCondition.leftOperand = leftOperand;

    if (condition.rightOperand) {
      const rightOperand = { ...condition.rightOperand } as Record<string, unknown>;
      if ((rightOperand.type as string) === "question") {
        rightOperand.type = "element";
      }
      newCondition.rightOperand = rightOperand;
    }

    return newCondition as TSingleCondition;
  }

  if (isConditionGroup(condition)) {
    const newConditionGroup: TConditionGroup = {
      ...condition,
      conditions: condition.conditions.map((nestedCondition) => {
        const converted = convertQuestionToElementType(nestedCondition);
        return converted ?? nestedCondition;
      }),
    };

    return newConditionGroup;
  }

  return null;
};

const convertElementToQuestionType = (condition: Condition | null | undefined): Condition | null => {
  if (!condition) return null;

  if (isSingleCondition(condition)) {
    const newCondition = { ...condition } as Record<string, unknown>;
    const leftOperand = { ...condition.leftOperand } as Record<string, unknown>;

    newCondition.leftOperand = {
      ...leftOperand,
      type: leftOperand.type === "element" ? "question" : leftOperand.type,
    };

    if (condition.rightOperand) {
      const rightOperand = { ...condition.rightOperand } as Record<string, unknown>;
      newCondition.rightOperand = {
        ...rightOperand,
        type: rightOperand.type === "element" ? "question" : rightOperand.type,
      };
    }

    return newCondition as TSingleCondition;
  }

  if (isConditionGroup(condition)) {
    const newConditionGroup: TConditionGroup = {
      ...condition,
      conditions: condition.conditions.map((nestedCondition) => {
        const converted = convertElementToQuestionType(nestedCondition);
        return converted ?? nestedCondition;
      }),
    };

    return newConditionGroup;
  }

  return null;
};

const reverseLogicActions = (
  actions: TSurveyBlockLogicAction[],
  blockIdToQuestionId: Map<string, string>,
  endingIds: Set<string>
): TSurveyLogicAction[] => {
  return actions.map((action) => {
    if (action.objective === "jumpToBlock") {
      const target = action.target;
      const questionId = blockIdToQuestionId.get(target);

      if (questionId) {
        return {
          ...action,
          objective: "jumpToQuestion",
          target: questionId,
        };
      }

      if (endingIds.has(target)) {
        return {
          ...action,
          objective: "jumpToQuestion",
          target,
        };
      }

      return {
        ...action,
        objective: "jumpToQuestion",
        target,
      };
    }

    return action;
  });
};

const reverseLogicFallback = (
  fallback: string,
  blockIdToQuestionId: Map<string, string>,
  endingIds: Set<string>
): string | undefined => {
  const questionId = blockIdToQuestionId.get(fallback);

  if (questionId) {
    return questionId;
  }

  if (endingIds.has(fallback)) {
    return fallback;
  }

  return undefined;
};

export const transformQuestionsToBlocks = (
  questions: TSurveyQuestion[],
  endings: TSurveyEnding[] = []
): TSurveyBlock[] => {
  if (questions.length === 0) {
    return [];
  }

  const questionsCopy = structuredClone(questions);

  processCTAQuestions(questionsCopy);

  const endingIds = new Set<string>(endings.map((ending) => ending.id));

  const questionIdToBlockId = new Map<string, string>();
  const blocks: Record<string, unknown>[] = [];

  for (let i = 0; i < questionsCopy.length; i++) {
    const question = questionsCopy[i];

    const blockId = createId();
    questionIdToBlockId.set(question.id as string, blockId);

    const { logic, logicFallback, buttonLabel, backButtonLabel, ...baseElement } = question;

    blocks.push({
      id: blockId,
      name: getBlockName(i),
      elements: [baseElement],
      buttonLabel,
      backButtonLabel,
      logic,
      logicFallback,
    });
  }

  for (const block of blocks) {
    if (Array.isArray(block.logic) && block.logic.length > 0) {
      block.logic = block.logic.map(
        (item: { conditions: TConditionGroup; actions: TSurveyLogicAction[] }) => {
          const updatedConditions = convertQuestionToElementType(item.conditions);

          if (!updatedConditions || !isConditionGroup(updatedConditions)) {
            return item;
          }

          return {
            ...item,
            conditions: updatedConditions,
            actions: updateLogicActions(item.actions, questionIdToBlockId, endingIds),
          };
        }
      );
    }

    if (typeof block.logicFallback === "string") {
      block.logicFallback = updateLogicFallback(block.logicFallback, questionIdToBlockId, endingIds);
    }
  }

  return blocks as TSurveyBlock[];
};

const transformBlockLogicToQuestionLogic = (
  blockLogic: TSurveyBlockLogic[],
  blockIdToQuestionId: Map<string, string>,
  endingIds: Set<string>
): unknown[] => {
  return blockLogic.map((item) => {
    const updatedConditions = convertElementToQuestionType(item.conditions);

    if (!updatedConditions || !isConditionGroup(updatedConditions)) {
      return item;
    }

    return {
      ...item,
      conditions: updatedConditions,
      actions: reverseLogicActions(item.actions, blockIdToQuestionId, endingIds),
    };
  });
};

const applyBlockAttributesToElement = (
  element: Record<string, unknown>,
  block: TSurveyBlock,
  blockIdToQuestionId: Map<string, string>,
  endingIds: Set<string>
): void => {
  if (element.type === "cta" && element.ctaButtonLabel) {
    element.buttonLabel = element.ctaButtonLabel;
  }

  if (Array.isArray(block.logic) && block.logic.length > 0) {
    element.logic = transformBlockLogicToQuestionLogic(block.logic, blockIdToQuestionId, endingIds);
  }

  if (block.logicFallback) {
    element.logicFallback = reverseLogicFallback(block.logicFallback, blockIdToQuestionId, endingIds);
  }

  if (block.buttonLabel) {
    element.buttonLabel = block.buttonLabel;
  }

  if (block.backButtonLabel) {
    element.backButtonLabel = block.backButtonLabel;
  }
};

export const transformBlocksToQuestions = (
  blocks: TSurveyBlock[],
  endings: TSurveyEnding[] = []
): TSurveyQuestion[] => {
  if (blocks.length === 0) {
    return [];
  }

  const endingIds = new Set<string>(endings.map((ending) => ending.id));
  const questions: Record<string, unknown>[] = [];

  const blockIdToQuestionId = blocks.reduce((acc, block) => {
    if (block.elements.length === 0) return acc;
    acc.set(block.id, block.elements[0].id);
    return acc;
  }, new Map<string, string>());

  for (const block of blocks) {
    if (block.elements.length === 0) continue;

    const element = { ...block.elements[0] };

    applyBlockAttributesToElement(element, block, blockIdToQuestionId, endingIds);

    questions.push(element);
  }

  return questions as TSurveyQuestion[];
};

export const validateSurveyInput = (input: {
  questions?: TSurveyQuestion[];
  blocks?: TSurveyBlock[];
  updateOnly?: boolean;
}): Result<{ hasQuestions: boolean; hasBlocks: boolean }, InvalidInputError> => {
  const hasQuestions = Boolean(input.questions && input.questions.length > 0);
  const hasBlocks = Boolean(input.blocks && input.blocks.length > 0);

  if (hasQuestions && hasBlocks) {
    return err(
      new InvalidInputError(
        "Cannot provide both questions and blocks. Please provide only one of these fields."
      )
    );
  }

  if (!hasQuestions && !hasBlocks && !input.updateOnly) {
    return err(new InvalidInputError("Must provide either questions or blocks. Both cannot be empty."));
  }

  return ok({ hasQuestions, hasBlocks });
};
