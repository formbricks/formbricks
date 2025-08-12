import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

type I18nString = Record<string, string>;

interface MatrixChoice {
  id?: string;
  label?: I18nString;
}

interface SurveyRecord {
  id: string;
  questions: {
    type: string;
    rows?: I18nString[] | MatrixChoice[];
    columns?: I18nString[] | MatrixChoice[];
  }[];
}

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
    const updatePromises: Promise<unknown>[] = [];

    for (const survey of matrixSurveys) {
      const questions = survey.questions;
      let shouldUpdate = false;

      for (let qIdx = 0; qIdx < questions.length; qIdx++) {
        const question = questions[qIdx];
        if ((question as { type?: string }).type !== "matrix") continue;

        const rows = question.rows ?? [];
        const columns = question.columns ?? [];

        const normalizeChoice = (choice: I18nString): MatrixChoice => {
          return {
            id: createId(),
            label: choice,
          };
        };

        const rowsNeedUpdate = rows.some((r) => {
          return !(r.hasOwnProperty("id") && r.hasOwnProperty("label"));
        });

        const colsNeedUpdate = columns.some((c) => {
          return !(c.hasOwnProperty("id") && c.hasOwnProperty("label"));
        });

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
        updatePromises.push(
          tx.$queryRaw`
            UPDATE "Survey"
            SET questions = ${JSON.stringify(questions)}::jsonb
            WHERE id = ${survey.id}
          `
        );
      }
    }

    await Promise.all(updatePromises);
    logger.info(`Updated ${updatedCount.toString()} surveys to add ids to matrix question labels`);
  },
};
