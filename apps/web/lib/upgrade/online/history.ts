import { OnlineUpgradeBlocked } from "./coordinator";

export type ReleaseHistory = { schema: Record<string, string>; data: string[] };
export type SchemaHistoryRow = {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};
export type DataHistoryRow = { id: string; status: string };

/** A checkpoint authorizes only this release's exact migrations, never an arbitrary prerelease. */
export const verifyMigrationHistory = (
  source: ReleaseHistory,
  target: ReleaseHistory,
  schema: SchemaHistoryRow[],
  data: DataHistoryRow[],
  hasPreparationIntent: boolean
): void => {
  const allowed = hasPreparationIntent ? target : source;
  const applied = new Set<string>();
  for (const row of schema) {
    if (row.rolled_back_at) continue;
    if (!row.finished_at) throw new OnlineUpgradeBlocked("partial_schema_history");
    if (allowed.schema[row.migration_name] !== row.checksum)
      throw new OnlineUpgradeBlocked("divergent_schema_history");
    applied.add(row.migration_name);
  }
  if (Object.keys(source.schema).some((name) => !applied.has(name)))
    throw new OnlineUpgradeBlocked("incomplete_source_history");
  const dataApplied = new Set<string>();
  for (const row of data) {
    if (!allowed.data.includes(row.id)) throw new OnlineUpgradeBlocked("unknown_data_migration");
    if (
      row.status !== "applied" &&
      !(hasPreparationIntent && !source.data.includes(row.id) && row.status === "failed")
    ) {
      throw new OnlineUpgradeBlocked("partial_data_history");
    }
    if (row.status === "applied") dataApplied.add(row.id);
  }
  if (source.data.some((name) => !dataApplied.has(name)))
    throw new OnlineUpgradeBlocked("incomplete_source_data_history");
};
