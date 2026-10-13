/** Release phases are keyed by the checked-in directory, never inferred from a timestamp. */
export type MigrationPhase = "prepare" | "finalize" | "deferred";
export type MigrationRunPhase = "prepare" | "finalize" | "maintenance";

const RELEASE_PHASES: Readonly<Record<string, MigrationPhase>> = {
  "20260928120000_eng_2404_backfill_remaining_embedded_data": "deferred",
  "20260928120001_eng_2404_drop_survey_legacy_embedded_data_columns": "deferred",
  "20261002120001_backfill_survey_owner": "finalize",
  "20261002120002_add_survey_projection_trigger": "finalize",
};

export const getMigrationPhase = (name: string): MigrationPhase => RELEASE_PHASES[name] ?? "prepare";

/** Finalization includes preparation so Prisma can see the complete non-deferred history. */
export const shouldRunMigration = (name: string, phase: MigrationRunPhase): boolean => {
  const migrationPhase = getMigrationPhase(name);
  return migrationPhase !== "deferred" && (phase !== "prepare" || migrationPhase === "prepare");
};

export const parseMigrationPhase = (args: string[]): MigrationRunPhase => {
  if (args.length === 0) return "maintenance";
  if (args.length === 2 && args[0] === "--phase") {
    const phase = args[1];
    if (phase === "prepare" || phase === "finalize" || phase === "maintenance") return phase;
  }
  throw new Error("Usage: apply-migrations [--phase prepare|finalize|maintenance]");
};
