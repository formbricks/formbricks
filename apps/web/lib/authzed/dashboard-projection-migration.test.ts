import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { AUTHZED_OUTBOX_TARGET_TYPES } from "./outbox-types";

const MIGRATIONS_DIR = new URL("../../../../packages/database/migration/", import.meta.url);

const readMigration = (name: string): string =>
  readFileSync(new URL(`${name}/migration.sql`, MIGRATIONS_DIR), "utf8");

const surveyMigration = readMigration("20261002120002_add_survey_projection_trigger");
const dashboardMigration = readMigration("20261123120001_dashboard_access_control_projection");

/** The body of one `CREATE OR REPLACE FUNCTION` statement, up to its `LANGUAGE` clause. */
const functionBody = (sql: string, name: string): string => {
  const match = new RegExp(`CREATE OR REPLACE FUNCTION ${name}\\([\\s\\S]*?\\$\\$ LANGUAGE \\w+`).exec(sql);
  if (!match) throw new Error(`function ${name} not found`);
  return match[0];
};

/** Every regex metacharacter in `text`, backslash included, taken literally. */
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const withoutComments = (sql: string): string => sql.replace(/^[ \t]*--[^\n]*\n/gm, "");

/** The `is_revocation := CASE … END;` assignment of the enqueue function. */
const REVOCATION_CASE = /is_revocation := CASE[\s\S]*?\n {2}END;/;

describe("dashboard projection trigger migration (ADR-0059)", () => {
  // Both shared functions are re-declared whole. Anything changed beyond the INSERT and DELETE
  // classification would silently reclassify every other trigger's events.
  test("re-declares the grant classifier unchanged and the enqueue function with only its classification", () => {
    expect(withoutComments(functionBody(dashboardMigration, "authzed_projection_is_grant"))).toBe(
      withoutComments(functionBody(surveyMigration, "authzed_projection_is_grant"))
    );

    const strip = (sql: string) =>
      withoutComments(functionBody(sql, "enqueue_authzed_projection")).replace(REVOCATION_CASE, "<case>");
    expect(strip(dashboardMigration)).toBe(strip(surveyMigration));
  });

  test("keeps every earlier classification: inserts are grants, deletes revocations, surveys hygiene", () => {
    const revocationCase = REVOCATION_CASE.exec(
      functionBody(dashboardMigration, "enqueue_authzed_projection")
    )?.[0];
    expect(revocationCase).toContain(
      "WHEN TG_TABLE_NAME IN ('Survey', 'Dashboard', 'DashboardPage') THEN false"
    );
    expect(revocationCase).toContain("ELSE true");
    expect(revocationCase).toContain(
      "ELSE NOT authzed_projection_is_grant(target_type, previous_source, source)"
    );
  });

  // The unsafe mistake is calling a narrowing a grant: an unprojected narrowing would not arm the
  // freshness guard. The behavior itself is exercised against PostgreSQL by the trigger integration suite.
  test("classifies a page limit and a team's dashboard selection as the narrowings they can be", () => {
    const revocationCase = REVOCATION_CASE.exec(
      functionBody(dashboardMigration, "enqueue_authzed_projection")
    )?.[0];
    expect(revocationCase).toContain(
      `WHEN TG_OP = 'INSERT' THEN
      TG_TABLE_NAME = 'DashboardPageTeam'
      OR (TG_TABLE_NAME = 'TeamDashboard' AND target_type = 'team')`
    );
    expect(revocationCase).toContain(
      `EXISTS (SELECT 1 FROM "DashboardPageTeam" WHERE "pageId" = source ->> 'pageId')`
    );
    expect(revocationCase).toContain(`target_type = 'dashboard'
        AND EXISTS (SELECT 1 FROM "Dashboard" WHERE id = source ->> 'dashboardId')`);
  });

  test("watches exactly the facts the dashboard and team projectors read", () => {
    const triggers = [
      ['AFTER INSERT OR DELETE ON "Dashboard"', "('dashboard', 'id', '')"],
      ['AFTER UPDATE OF "workspaceId" ON "Dashboard"', "('dashboard', 'id', '')"],
      ['AFTER INSERT OR DELETE ON "DashboardPage"', "('dashboard_page', 'id', '')"],
      ['AFTER UPDATE OF "dashboardId" ON "DashboardPage"', "('dashboard_page', 'id', '')"],
      [
        'AFTER INSERT OR DELETE OR UPDATE OF "pageId", "teamId" ON "DashboardPageTeam"',
        "('dashboard_page', 'pageId', '')",
      ],
      [
        'AFTER INSERT OR DELETE OR UPDATE OF "teamId", "dashboardId" ON "TeamDashboard"',
        "('dashboard', 'dashboardId', '')",
      ],
      [
        'AFTER INSERT OR DELETE OR UPDATE OF "teamId", "dashboardId" ON "TeamDashboard"',
        "('team', 'teamId', '')",
      ],
    ] as const;
    for (const [timing, target] of triggers) {
      expect(dashboardMigration).toMatch(
        new RegExp(
          `${escapeRegExp(timing)}\\n(?:FOR EACH ROW WHEN [^\\n]*\\n)?(?:FOR EACH ROW )?EXECUTE FUNCTION enqueue_authzed_projection${escapeRegExp(target)}`
        )
      );
    }
    expect(dashboardMigration.match(/CREATE TRIGGER/g)).toHaveLength(triggers.length);
  });

  // ENG-7471: the migration, not a later step, queues every existing dashboard and page, so the drain in
  // `upgrade prepare` projects them.
  test("queues every existing dashboard, page and limited team for delivery", () => {
    expect(dashboardMigration).toContain(
      `SELECT gen_random_uuid()::text, 'dashboard', "id", false, NOW() FROM "Dashboard";`
    );
    expect(dashboardMigration).toContain(
      `SELECT gen_random_uuid()::text, 'dashboard_page', "id", false, NOW() FROM "DashboardPage";`
    );
    expect(dashboardMigration).toContain(`SELECT gen_random_uuid()::text, 'team', "teamId", true, NOW()`);
  });

  test("ships the outbox target types its triggers write", () => {
    expect(AUTHZED_OUTBOX_TARGET_TYPES).toEqual(
      expect.arrayContaining(["dashboard", "dashboard_page", "team"])
    );
  });
});
