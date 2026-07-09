import { describe, expect, test } from "vitest";
import { diffPendingMigrations } from "./migration-diff";

describe("diffPendingMigrations", () => {
  const expected = { schema: ["a_init", "b_add_col"], data: ["c_backfill", "d_cleanup"] };

  test("nothing pending when every shipped migration is applied", () => {
    const result = diffPendingMigrations(
      expected,
      new Set(["a_init", "b_add_col"]),
      new Set(["c_backfill", "d_cleanup"])
    );
    expect(result).toEqual({ schema: [], data: [] });
  });

  test("reports the un-applied schema and data migrations", () => {
    const result = diffPendingMigrations(expected, new Set(["a_init"]), new Set(["c_backfill"]));
    expect(result).toEqual({ schema: ["b_add_col"], data: ["d_cleanup"] });
  });

  test("an empty database has everything pending", () => {
    const result = diffPendingMigrations(expected, new Set(), new Set());
    expect(result).toEqual({ schema: ["a_init", "b_add_col"], data: ["c_backfill", "d_cleanup"] });
  });

  test("extra applied migrations not shipped in this image are ignored (older image, newer DB)", () => {
    const result = diffPendingMigrations(
      expected,
      new Set(["a_init", "b_add_col", "z_future_schema"]),
      new Set(["c_backfill", "d_cleanup", "y_future_data"])
    );
    expect(result).toEqual({ schema: [], data: [] });
  });

  test("schema and data tracks are independent (a data name never satisfies the schema side)", () => {
    // same name in both tracks, applied only on the data side
    const result = diffPendingMigrations({ schema: ["x"], data: ["x"] }, new Set(), new Set(["x"]));
    expect(result).toEqual({ schema: ["x"], data: [] });
  });
});
