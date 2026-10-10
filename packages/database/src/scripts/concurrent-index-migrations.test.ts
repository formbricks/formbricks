import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// A concurrent index build waits under `lock_timeout` for more than its table lock: for every transaction
// that wrote to the table, and for every older snapshot in the database, on any table. Any value but 0
// fails the build whenever a backup or a long query outlasts it (ENG-3701). Squawk only checks that a
// `SET lock_timeout` exists, not its value. See "How Prisma applies a migration file" in README.md.
const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migration");

// Line-anchored, so a statement quoted inside a comment or a `RAISE` message does not count.
const CONCURRENT_INDEX_BUILD = /^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/im;
const SET_LOCK_TIMEOUT = /^\s*SET\s+(?:LOCAL\s+|SESSION\s+)?lock_timeout\s*(?:=|TO)\s*([^;]+);/gim;

const concurrentIndexMigrations = fs
  .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({ name: entry.name, file: path.join(MIGRATIONS_DIR, entry.name, "migration.sql") }))
  .filter(({ file }) => fs.existsSync(file))
  .map(({ name, file }) => ({ name, sql: fs.readFileSync(file, "utf8").replaceAll(/--.*$/gm, "") }))
  .filter(({ sql }) => CONCURRENT_INDEX_BUILD.test(sql));

describe("schema migrations that build an index CONCURRENTLY", () => {
  test("are found, so the check below has something to check", () => {
    expect(concurrentIndexMigrations.length).toBeGreaterThan(0);
  });

  test.each(concurrentIndexMigrations)("$name sets lock_timeout to 0", ({ sql }) => {
    const values = Array.from(sql.matchAll(SET_LOCK_TIMEOUT), (match) => match[1].trim());

    expect(values).not.toHaveLength(0);
    expect(values.filter((value) => value !== "0" && value !== "'0'")).toEqual([]);
  });
});
