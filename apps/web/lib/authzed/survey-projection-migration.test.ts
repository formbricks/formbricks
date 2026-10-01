import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";

const MIGRATIONS_DIR = new URL("../../../../packages/database/migration/", import.meta.url);

const readMigration = (name: string): string =>
  readFileSync(new URL(`${name}/migration.sql`, MIGRATIONS_DIR), "utf8");

const outboxMigration = readMigration("20260818120000_add_authzed_projection_outbox");
const surveyMigration = readMigration("20260928120002_add_survey_projection_trigger");
const columnsMigration = readMigration("20260928120000_add_survey_visibility_columns");

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

  // `ON DELETE SET NULL` writes `ownerId → NULL` once per survey a deleted user owned. As a revocation
  // that would queue one per survey and could arm the deployment-wide freshness guard; the user's own
  // revocation already removes the workspace read both owner arms intersect. The behavior itself is
  // proven against PostgreSQL in outbox-trigger.integration.test.ts.
  test("classifies an owner cleared to NULL as a grant, and only on the same workspace and visibility", () => {
    const surveyCase =
      /WHEN 'survey' THEN([\s\S]*?)\n\n\s*ELSE false/.exec(
        functionBody(surveyMigration, "authzed_projection_is_grant")
      )?.[1] ?? "";
    expect(surveyCase).toContain(
      `(previous_source ->> 'ownerId') IS NOT DISTINCT FROM (source ->> 'ownerId')
        OR (source ->> 'ownerId') IS NULL`
    );
    // The NULL arm is ANDed with the workspace and visibility conditions, never ORed past them.
    expect(surveyCase.indexOf("workspaceId")).toBeLessThan(surveyCase.indexOf("IS NULL"));
    expect(surveyCase.indexOf("IS NULL")).toBeLessThan(surveyCase.indexOf("'visibility'"));
  });

  // A new row has no graph edges until it is projected. Settled versions would send authorization to an
  // empty survey node and deny even the owner; a pending pair is decided from PostgreSQL facts instead.
  test("starts every inserted survey in its initial projection: version 0, never acknowledged", () => {
    const pendingFunction =
      /CREATE OR REPLACE FUNCTION survey_visibility_pending\(\)[\s\S]*?\n\$\$;/.exec(columnsMigration)?.[0] ??
      "";
    expect(pendingFunction).toContain(
      `IF TG_OP = 'INSERT' THEN
    NEW."visibilityVersion" := 0;
    NEW."visibilityProjectedVersion" := -1;
  END IF;`
    );
    // The insert bump runs before the flag is derived, so the flag agrees with it.
    expect(pendingFunction.indexOf(":= -1;")).toBeLessThan(
      pendingFunction.indexOf('NEW."visibilityPending" :=')
    );
    expect(columnsMigration).toContain(
      'BEFORE INSERT OR UPDATE OF "visibilityVersion", "visibilityProjectedVersion", "visibilityPending"'
    );
  });

  // The trigger fires on every `ownerId` write. If it existed before the backfill ran, an upgrade
  // would enqueue one revocation per existing survey and arm the freshness guard deployment-wide.
  test("sorts after the owner backfill it must not observe", () => {
    const ours = [
      "20260928120000_add_survey_visibility_columns",
      "20260928120001_backfill_survey_owner",
      "20260928120002_add_survey_projection_trigger",
    ];
    const names = readdirSync(MIGRATIONS_DIR)
      .filter((name) => ours.includes(name))
      .sort();
    expect(names).toEqual(ours);
  });
});
