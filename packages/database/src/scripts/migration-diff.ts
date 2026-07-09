// Pure, dependency-free migration-diff logic, split out from migration-check.ts so
// it can be unit-tested without importing the Prisma client. The startup gate
// compares by directory name (not the `id` embedded in each data-migration module),
// which is why it never has to import those modules.

export interface ExpectedMigrations {
  /** Directory names that contain a schema migration (`migration.sql`). */
  schema: string[];
  /** Directory names that contain a data migration (`migration.js`/`migration.ts`). */
  data: string[];
}

export interface PendingMigrations {
  schema: string[];
  data: string[];
}

/**
 * Returns the expected migrations that are not present in the applied sets, i.e.
 * those this image ships but the database has not recorded as applied.
 */
export const diffPendingMigrations = (
  expected: ExpectedMigrations,
  appliedSchema: ReadonlySet<string>,
  appliedData: ReadonlySet<string>
): PendingMigrations => ({
  schema: expected.schema.filter((name) => !appliedSchema.has(name)),
  data: expected.data.filter((name) => !appliedData.has(name)),
});
