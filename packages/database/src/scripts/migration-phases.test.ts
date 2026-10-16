import { describe, expect, test } from "vitest";
import { getMigrationPhase, parseMigrationPhase, shouldRunMigration } from "./migration-phases";

const cleanup = [
  "20260928120000_eng_2404_backfill_remaining_embedded_data",
  "20260928120001_eng_2404_drop_survey_legacy_embedded_data_columns",
];
const finalize = ["20261002120001_backfill_survey_owner", "20261002120002_add_survey_projection_trigger"];

describe("6.1 migration phases", () => {
  test.each(cleanup)("never selects deferred cleanup %s, including ordinary startup", (name) => {
    expect(getMigrationPhase(name)).toBe("deferred");
    for (const phase of ["prepare", "finalize", "maintenance"] as const) {
      expect(shouldRunMigration(name, phase)).toBe(false);
    }
  });

  test.each(finalize)("keeps %s out of preparation", (name) => {
    expect(shouldRunMigration(name, "prepare")).toBe(false);
    expect(shouldRunMigration(name, "finalize")).toBe(true);
    expect(shouldRunMigration(name, "maintenance")).toBe(true);
  });

  test("includes preparation history during finalization", () => {
    const name = "20261002120000_add_survey_visibility_columns";
    expect(shouldRunMigration(name, "prepare")).toBe(true);
    expect(shouldRunMigration(name, "finalize")).toBe(true);
  });

  test("refuses invalid arguments rather than falling back to a more permissive phase", () => {
    expect(parseMigrationPhase([])).toBe("maintenance");
    expect(parseMigrationPhase(["--phase", "prepare"])).toBe("prepare");
    expect(() => parseMigrationPhase(["--phase", "deferred"])).toThrow("Usage:");
    expect(() => parseMigrationPhase(["--phase", "prepaer"])).toThrow("Usage:");
    expect(() => parseMigrationPhase(["--phase", "prepare", "extra"])).toThrow("Usage:");
  });
});
