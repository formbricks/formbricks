import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

type I18nString = Record<string, string>;

interface MatrixChoice {
  id: string;
  label: I18nString;
}

interface SurveyRecord {
  id: string;
  questions: {
    type: string;
    rows?: I18nString[] | MatrixChoice[];
    columns?: I18nString[] | MatrixChoice[];
  }[];
}

const isMatrixChoice = (choice: unknown): choice is MatrixChoice => {
  return typeof choice === "object" && choice !== null && "id" in choice && "label" in choice;
};

const normalizeChoice = (choice: I18nString | MatrixChoice): MatrixChoice => {
  // If already a MatrixChoice with id and label, return as-is
  if (isMatrixChoice(choice)) return choice;

  // Otherwise, treat as I18nString and normalize with cuid2
  return {
    id: createId(),
    label: choice,
  };
};

const processMatrixQuestion = (question: SurveyRecord["questions"][0]): boolean => {
  const rows = question.rows ?? [];
  const columns = question.columns ?? [];

  const rowsNeedUpdate = rows.some((r) => !isMatrixChoice(r));
  const colsNeedUpdate = columns.some((c) => !isMatrixChoice(c));

  if (rowsNeedUpdate || colsNeedUpdate) {
    const newRows = rowsNeedUpdate ? rows.map((r) => normalizeChoice(r)) : rows;
    const newColumns = colsNeedUpdate ? columns.map((c) => normalizeChoice(c)) : columns;

    Object.assign(question, {
      rows: newRows,
      columns: newColumns,
    });
    return true;
  }
  return false;
};

export const addsIdToMatrixQuestionLabels: MigrationScript = {
  type: "data",
  id: "dc990fgnxoynpfao31n5kj6q",
  name: "20250812114145_adds_id_to_matrix_question_labels",
  run: async ({ tx }) => {
    // select all surveys with matrix questions (questions is a jsonb field)
    const matrixSurveys = await tx.$queryRaw<SurveyRecord[]>`
      SELECT id, questions
      FROM "Survey"
      WHERE questions @> '[{"type": "matrix"}]'
    `;

    if (matrixSurveys.length === 0) {
      logger.info("No surveys found");
      return;
    }

    // Process surveys and collect updates
    const updates: { id: string; questions: SurveyRecord["questions"] }[] = [];

    for (const survey of matrixSurveys) {
      let shouldUpdate = false;

      for (const question of survey.questions) {
        if ((question as { type?: string }).type === "matrix") {
          const wasUpdated = processMatrixQuestion(question);
          if (wasUpdated) shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        updates.push({ id: survey.id, questions: survey.questions });
      }
    }

    if (updates.length === 0) {
      logger.info("No surveys needed updating");
      return;
    }

    // Execute all updates in a single SQL statement using VALUES
    const valuesList = updates
      .map((update) => `('${update.id}', '${JSON.stringify(update.questions).replace(/'/g, "''")}'::jsonb)`)
      .join(", ");

    const result = await tx.$executeRawUnsafe(`
        UPDATE "Survey" 
        SET questions = v.questions
        FROM (VALUES ${valuesList}) AS v(id, questions)
        WHERE "Survey".id = v.id
      `);

    logger.info(`Updated ${result.toString()} surveys to add ids to matrix question labels`);
  },
};
