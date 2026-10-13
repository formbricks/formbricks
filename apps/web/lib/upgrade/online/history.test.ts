import { expect, test } from "vitest";
import { verifyMigrationHistory } from "./history";

const source = { schema: { released: "a" }, data: ["released-data"] };
const target = { schema: { ...source.schema, addition: "b" }, data: [...source.data, "new-data"] };
const applied = (migration_name: string, checksum: string) => ({
  migration_name,
  checksum,
  finished_at: new Date(),
  rolled_back_at: null,
});
const data = [{ id: "released-data", status: "applied" }];
test("accepts stable history and only checkpointed, exact target additions", () => {
  expect(() => verifyMigrationHistory(source, target, [applied("released", "a")], data, false)).not.toThrow();
  const expanded = [applied("released", "a"), applied("addition", "b")];
  expect(() => verifyMigrationHistory(source, target, expanded, data, false)).toThrow(
    "divergent_schema_history"
  );
  expect(() => verifyMigrationHistory(source, target, expanded, data, true)).not.toThrow();
});
test("rejects partial, modified, missing and unknown histories before preparation", () => {
  expect(() =>
    verifyMigrationHistory(source, target, [{ ...applied("released", "a"), finished_at: null }], data, false)
  ).toThrow("partial_schema_history");
  expect(() => verifyMigrationHistory(source, target, [applied("released", "modified")], data, true)).toThrow(
    "divergent_schema_history"
  );
  expect(() => verifyMigrationHistory(source, target, [], data, false)).toThrow("incomplete_source_history");
  expect(() =>
    verifyMigrationHistory(
      source,
      target,
      [applied("released", "a")],
      [...data, { id: "deferred", status: "applied" }],
      true
    )
  ).toThrow("unknown_data_migration");
});
