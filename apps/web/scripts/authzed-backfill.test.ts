import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

/**
 * `apps/web/scripts/**` is excluded from coverage, so this is a contract test rather than a behavioural
 * one: it asserts the entry point stays a thin argv shim and that every decision lives in the covered
 * command module.
 */
describe("authzed backfill script", () => {
  const scriptSource = readFileSync(new URL("./authzed-backfill.ts", import.meta.url), "utf8");

  test("delegates parsing and execution to the covered command module", () => {
    expect(scriptSource).toContain("parseAuthzedBackfillCommand");
    expect(scriptSource).toContain("runAuthzedBackfillCli");
  });

  test("contains no guard logic of its own", () => {
    // The prune guards must be in lib/authzed/backfill-cli.ts, where the coverage gate applies.
    for (const guard of ["--prune", "--confirm-prune", "--expected-endpoint", "maxPrune"]) {
      // Mentioning a flag in the usage doc-block is fine; branching on one is not.
      expect(scriptSource).not.toMatch(new RegExp(`(if|includes|startsWith)[^\\n]*${guard}`));
    }
  });

  test("reports an exit code rather than exiting the process", () => {
    // process.exit would skip the single-JSON-line output contract the automation depends on.
    expect(scriptSource).toContain("process.exitCode");
    expect(scriptSource).not.toContain("process.exit(");
  });
});
