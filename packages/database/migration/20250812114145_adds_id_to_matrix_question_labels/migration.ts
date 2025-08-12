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

const CHUNK_SIZE = 10000;

const isMatrixChoice = (choice: unknown): choice is MatrixChoice => {
  return typeof choice === "object" && choice !== null && "id" in choice && "label" in choice;
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

    let updatedCount = 0;
    const updatePromises: { id: string; questions: Record<string, unknown>[] }[] = [];

    for (const survey of matrixSurveys) {
      const questions = survey.questions;
      let shouldUpdate = false;

      for (let qIdx = 0; qIdx < questions.length; qIdx++) {
        const question = questions[qIdx];
        if ((question as { type?: string }).type !== "matrix") continue;

        const rows = question.rows ?? [];
        const columns = question.columns ?? [];

        const normalizeChoice = (choice: I18nString | MatrixChoice): MatrixChoice => {
          // If already a MatrixChoice with id and label, return as-is
          if (isMatrixChoice(choice)) return choice;

          // Otherwise, treat as I18nString and normalize
          return {
            id: createId(),
            label: choice,
          };
        };

        const rowsNeedUpdate = rows.some((r) => !isMatrixChoice(r));

        const colsNeedUpdate = columns.some((c) => !isMatrixChoice(c));

        const newRows = rowsNeedUpdate ? rows.map((r) => normalizeChoice(r)) : rows;
        const newColumns = colsNeedUpdate ? columns.map((c) => normalizeChoice(c)) : columns;

        if (rowsNeedUpdate || colsNeedUpdate) {
          questions[qIdx] = {
            ...question,
            rows: newRows,
            columns: newColumns,
          };
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        updatedCount++;
        updatePromises.push({
          id: survey.id,
          questions,
        });
      }
    }

    if (updatePromises.length > 0) {
      const chunkSize = Math.min(CHUNK_SIZE, updatePromises.length);
      for (let i = 0; i < updatePromises.length; i += chunkSize) {
        const chunk = updatePromises.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(
            (update) =>
              tx.$executeRaw`
                  UPDATE "Survey"
                  SET questions = ${JSON.stringify(update.questions)}::jsonb
                  WHERE id = ${update.id}
                `
          )
        );
      }
    }

    logger.info(`Updated ${updatedCount.toString()} surveys to add ids to matrix question labels`);
  },
};
