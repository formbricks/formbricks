/* eslint-disable no-console -- logging is allowed in migration scripts */
// !@gupta-piyush19: WIP
// Pending:
// 1. Options assignment: text to id
// 2. have to check and modify data storing in right operand based on the saving pattern of current logic
import { createId } from "@paralleldrive/cuid2";
import { PrismaClient } from "@prisma/client";
import type {
  TAction,
  TSingleCondition,
  TSurveyAdvancedLogic,
  TSurveyLogicCondition,
} from "@formbricks/types/surveys/logic";
import type { TSurveyQuestion } from "@formbricks/types/surveys/types";

const prisma = new PrismaClient();

interface TOldLogic {
  condition: string;
  value?: string | string[];
  destination: string;
}

const doesRightOperandExist = (operator: TSurveyLogicCondition): boolean => {
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

// Helper function to convert old logic condition to new format
function convertLogicCondition(
  oldCondition: string,
  oldValue: string | string[] | undefined,
  questionId: string
): TSingleCondition {
  const operator = mapOldConditionToNew(oldCondition);

  const newCondition: TSingleCondition = {
    id: createId(),
    leftOperand: {
      type: "question",
      id: questionId,
    },
    operator,
    ...(doesRightOperandExist(operator) && {
      rightOperand: {
        type: "static",
        value: oldValue ?? "",
      },
    }),
  };

  return newCondition;
}

// Helper function to map old conditions to new ones
function mapOldConditionToNew(oldCondition: string): TSurveyLogicCondition {
  const conditionMap: Record<string, TSurveyLogicCondition> = {
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

  return conditionMap[oldCondition];
}

// Helper function to convert old logic to new format
function convertLogic(oldLogic: TOldLogic, questionId: string): TSurveyAdvancedLogic {
  const condition: TSingleCondition = convertLogicCondition(oldLogic.condition, oldLogic.value, questionId);
  condition.leftOperand.id = questionId;

  const action: TAction = {
    id: createId(),
    objective: "jumpToQuestion",
    target: oldLogic.destination,
  };

  return {
    id: createId(),
    conditions: {
      id: createId(),
      connector: null,
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
        where: {
          questions: {
            array_contains: [{ logic: { $exists: true } }],
          },
        },
        select: {
          id: true,
          questions: true,
        },
      });

      // Process each survey
      const migrationPromises = relevantSurveys.map(async (survey) => {
        const updatedQuestions = survey.questions.map((question: TSurveyQuestion) => {
          if (question.logic && Array.isArray(question.logic)) {
            const newLogic = (question.logic as TOldLogic[]).map((oldLogic) =>
              convertLogic(oldLogic, question.id)
            );
            return { ...question, logic: newLogic };
          }
          return question;
        });

        return tx.survey.update({
          where: { id: survey.id },
          data: { questions: updatedQuestions },
        });
      });

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
