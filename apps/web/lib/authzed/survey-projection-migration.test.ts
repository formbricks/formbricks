import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";

const MIGRATIONS_DIR = new URL("../../../../packages/database/migration/", import.meta.url);

const readMigration = (name: string): string =>
  readFileSync(new URL(`${name}/migration.sql`, MIGRATIONS_DIR), "utf8");

const outboxMigration = readMigration("20260818120000_add_authzed_projection_outbox");
const surveyMigration = readMigration("20260928120002_eng_3282_survey_projection_trigger");

/** The body of one `CREATE OR REPLACE FUNCTION` statement, up to its `LANGUAGE` clause. */
const functionBody = (sql: string, name: string): string => {
  const match = new RegExp(`CREATE OR REPLACE FUNCTION ${name}\\([\\s\\S]*?\\$\\$ LANGUAGE \\w+`).exec(sql);
  if (!match) throw new Error(`function ${name} not found`);
  return match[0];
};

describe("survey projection trigger migration (ENG-3282)", () => {
  test("watches exactly the columns the survey projector reads", () => {
    expect(surveyMigration).toContain(
      'AFTER INSERT OR DELETE OR UPDATE OF "visibility", "ownerId", "workspaceId" ON "Survey"'
    );
    expect(surveyMigration).toContain("enqueue_authzed_projection('survey', 'id', '')");
    expect(surveyMigration.match(/CREATE TRIGGER/g)).toHaveLength(1);
  });

  // The survey file re-declares both shared functions. Anything it changes beyond the survey case
  // silently changes the classification of all eleven other triggers, so only the two intended edits
  // may differ from the original.
  test("re-declares the shared functions with only the survey changes", () => {
    const withoutSurveyCase = functionBody(surveyMigration, "authzed_projection_is_grant").replace(
      /\n(?:\s*--[^\n]*\n)*\s*WHEN 'survey' THEN[\s\S]*?\n(?=\n\s*ELSE false)/,
      "\n"
    );
    expect(withoutSurveyCase).toBe(functionBody(outboxMigration, "authzed_projection_is_grant"));

    const surveyEnqueue = functionBody(surveyMigration, "enqueue_authzed_projection");
    expect(surveyEnqueue).toContain("WHEN TG_OP = 'DELETE' THEN (target_type <> 'survey')");
    expect(
      surveyEnqueue.replace(
        /(?:\s*--[^\n]*\n)*\s*WHEN TG_OP = 'DELETE' THEN \(target_type <> 'survey'\)/,
        "\n    WHEN TG_OP = 'DELETE' THEN true"
      )
    ).toBe(functionBody(outboxMigration, "enqueue_authzed_projection"));
  });

  // The trigger fires on every `ownerId` write. If it existed before the backfill ran, an upgrade
  // would enqueue one revocation per existing survey and arm the freshness guard deployment-wide.
  test("sorts after the owner backfill it must not observe", () => {
    const names = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.includes("eng_3282"))
      .sort();
    expect(names).toEqual([
      "20260928120000_eng_3282_survey_visibility_columns",
      "20260928120001_eng_3282_backfill_survey_owner",
      "20260928120002_eng_3282_survey_projection_trigger",
    ]);
  });
});
