/* eslint-disable @typescript-eslint/restrict-template-expressions  -- string interpolation is allowed in migration scripts */

/* eslint-disable no-console -- logging is allowed in migration scripts */
import { createId } from "@paralleldrive/cuid2";
import { PrismaClient } from "@prisma/client";
import type {
  TAction,
  TRightOperand,
  TSingleCondition,
  TSurveyAdvancedLogic,
  TSurveyLogicConditionsOperator,
} from "@formbricks/types/surveys/logic";
import {
  type TSurveyEndings,
  type TSurveyMultipleChoiceQuestion,
  type TSurveyQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";

const prisma = new PrismaClient();

interface TOldLogic {
  condition: string;
  value?: string | string[];
  destination: string;
}

const isOldLogic = (logic: TOldLogic | TSurveyAdvancedLogic): logic is TOldLogic => {
  return Object.keys(logic).some((key) => ["condition", "destination", "value"].includes(key));
};

const doesRightOperandExist = (operator: TSurveyLogicConditionsOperator): boolean => {
  return ![
    "isAccepted",
    "isBooked",
    "isClicked",
    "isCompletelySubmitted",
    "isPartiallySubmitted",
    "isSkipped",
    "isSubmitted",
  ].includes(operator);
};

const getChoiceId = (question: TSurveyMultipleChoiceQuestion, choiceText: string): string | undefined => {
  const choiceOption = question.choices.find((choice) => choice.label.default === choiceText);
  if (choiceOption) {
    return choiceOption.id;
  }
  if (question.choices.at(-1)?.id === "other") {
    return "other";
  }
};

const getRightOperandValue = (
  surveyId: string,
  oldCondition: string,
  oldValue: string | string[] | undefined,
  question: TSurveyQuestion
): TRightOperand | undefined => {
  if (["lessThan", "lessEqual", "greaterThan", "greaterEqual"].includes(oldCondition)) {
    return {
      type: "static",
      value: parseInt(oldValue as string),
    };
  }

  if (["equals", "notEquals"].includes(oldCondition)) {
    if (["string", "number"].includes(typeof oldValue)) {
      if (question.type === TSurveyQuestionTypeEnum.Rating || question.type === TSurveyQuestionTypeEnum.NPS) {
        return {
          type: "static",
          value: parseInt(oldValue as string),
        };
      } else if (
        question.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ||
        question.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti
      ) {
        const choiceId = getChoiceId(question, oldValue as string);
        if (choiceId) {
          return {
            type: "static",
            value: choiceId,
          };
        }
        return undefined;
      } else if (question.type === TSurveyQuestionTypeEnum.PictureSelection) {
        return {
          type: "static",
          value: oldValue as string,
        };
      }
    }

    throw new Error(`Invalid value for 'equals' or 'notEquals' condition in survey ${surveyId}`);
  }

  if (["includesAll", "includesOne"].includes(oldCondition)) {
    let choiceIds: string[] = [];

    if (oldValue && Array.isArray(oldValue)) {
      if (
        question.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti ||
        question.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle
      ) {
        oldValue.forEach((choiceText) => {
          const choiceId = getChoiceId(question, choiceText);
          if (choiceId) {
            choiceIds.push(choiceId);
          }
        });

        choiceIds = Array.from(new Set(choiceIds));

        return {
          type: "static",
          value: choiceIds,
        };
      }

      return {
        type: "static",
        value: oldValue,
      };
    }

    throw new Error(`Invalid value for 'includesAll' or 'includesOne' condition in survey ${surveyId}`);
  }

  throw new Error(`Invalid condition ${oldCondition} in survey ${surveyId}`);
};

// Helper function to convert old logic condition to new format
function convertLogicCondition(
  surveyId: string,
  oldCondition: string,
  oldValue: string | string[] | undefined,
  question: TSurveyQuestion
): TSingleCondition | undefined {
  const operator = mapOldOperatorToNew(oldCondition, question.type);

  let rightOperandValue: TRightOperand | undefined;

  const doesRightOperandExistResult = doesRightOperandExist(operator);
  if (doesRightOperandExistResult) {
    rightOperandValue = getRightOperandValue(surveyId, oldCondition, oldValue, question);

    if (!rightOperandValue) {
      return undefined;
    }
  }

  const newCondition: TSingleCondition = {
    id: createId(),
    leftOperand: {
      type: "question",
      value: question.id,
    },
    operator,
    ...(doesRightOperandExistResult ? { rightOperand: rightOperandValue } : {}),
  };

  return newCondition;
}

// Helper function to map old conditions to new ones
function mapOldOperatorToNew(
  oldCondition: string,
  questionType: TSurveyQuestionTypeEnum
): TSurveyLogicConditionsOperator {
  const conditionMap: Record<string, TSurveyLogicConditionsOperator> = {
    accepted: "isAccepted",
    clicked: "isClicked",
    submitted: "isSubmitted",
    skipped: "isSkipped",
    equals: "equals",
    notEquals: "doesNotEqual",
    lessThan: "isLessThan",
    lessEqual: "isLessThanOrEqual",
    greaterThan: "isGreaterThan",
    greaterEqual: "isGreaterThanOrEqual",
    includesAll: "includesAllOf",
    includesOne: "includesOneOf",
    uploaded: "isSubmitted", // Assuming 'uploaded' maps to 'isSubmitted'
    notUploaded: "isSkipped", // Assuming 'notUploaded' maps to 'isSkipped'
    booked: "isBooked",
    isCompletelySubmitted: "isCompletelySubmitted",
    isPartiallySubmitted: "isPartiallySubmitted",
  };

  const newOpeator = conditionMap[oldCondition];

  if (questionType === TSurveyQuestionTypeEnum.MultipleChoiceSingle && newOpeator === "includesOneOf") {
    return "equalsOneOf";
  }

  return newOpeator;
}

// Helper function to convert old logic to new format
function convertLogic(
  surveyId: string,
  surveyEndings: TSurveyEndings,
  oldLogic: TOldLogic,
  question: TSurveyQuestion
): TSurveyAdvancedLogic | undefined {
  if (!oldLogic.condition || !oldLogic.destination) {
    return undefined;
  }

  const condition = convertLogicCondition(surveyId, oldLogic.condition, oldLogic.value, question);

  if (!condition) {
    return undefined;
  }

  let actionTarget = oldLogic.destination;

  if (actionTarget === "end") {
    if (surveyEndings.length > 0) {
      actionTarget = surveyEndings[0].id;
    } else {
      return undefined;
    }
  }

  const action: TAction = {
    id: createId(),
    objective: "jumpToQuestion",
    target: actionTarget,
  };

  return {
    id: createId(),
    conditions: {
      id: createId(),
      connector: "and",
      conditions: [condition],
    },
    actions: [action],
  };
}

async function runMigration(): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const startTime = Date.now();
      console.log("Starting survey logic migration...");

      // Get all surveys with questions containing old logic
      const relevantSurveys = await tx.survey.findMany({
        select: {
          id: true,
          questions: true,
          endings: true,
        },
      });

      // Process each survey
      const migrationPromises = relevantSurveys
        .map((survey) => {
          let doesThisSurveyHasOldLogic = false;
          const questions: TSurveyQuestion[] = [];

          for (const question of survey.questions) {
            if (question.logic && Array.isArray(question.logic) && question.logic.some(isOldLogic)) {
              doesThisSurveyHasOldLogic = true;
              const newLogic = (question.logic as unknown as TOldLogic[])
                .map((oldLogic) => convertLogic(survey.id, survey.endings, oldLogic, question))
                .filter((logic) => logic !== undefined);

              questions.push({ ...question, logic: newLogic });
            } else {
              questions.push(question);
            }
          }

          if (!doesThisSurveyHasOldLogic) {
            return null;
          }

          return tx.survey.update({
            where: { id: survey.id },
            data: { questions },
          });
        })
        .filter((promise) => promise !== null);

      console.log(`Found ${migrationPromises.length} surveys with old logic`);

      await Promise.all(migrationPromises);

      const endTime = Date.now();
      console.log(
        `Survey logic migration completed. Total time: ${((endTime - startTime) / 1000).toString()}s`
      );
    },
    {
      timeout: 300000, // 5 minutes
    }
  );
}

function handleError(error: unknown): void {
  console.error("An error occurred during migration:", error);
  process.exit(1);
}

function handleDisconnectError(): void {
  console.error("Failed to disconnect Prisma client");
  process.exit(1);
}

function main(): void {
  runMigration()
    .catch(handleError)
    .finally(() => {
      prisma.$disconnect().catch(handleDisconnectError);
    });
}

main();
