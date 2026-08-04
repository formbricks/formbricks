import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");

// Regression guard for the failure exit-code path: `next typegen` used to swallow
// environment-validation failures and still exit 0, so CI could not detect that
// type generation ran against an invalid environment. The `typegen` script must
// now surface that failure as a non-zero exit while still listing the offending
// variables.
//
// This drives the real package entrypoint (`pnpm typegen`) rather than the wrapper
// module directly, so a regression in the script command itself — e.g. re-adding a
// hardcoded `cross-env DATABASE_URL=...` that would mask a caller-supplied invalid
// value — is also caught.
//
// The success path (valid env -> exit 0, "Types generated successfully") is
// exercised by the `typegen` / `typecheck` CI step, which runs the entrypoint for
// real; duplicating it here would mean running a full `next typegen` inside a unit
// test.
describe("typegen entrypoint", () => {
  test("exits non-zero and lists invalid variables when env validation fails", () => {
    const result = spawnSync("pnpm", ["typegen"], {
      cwd: appDir,
      encoding: "utf8",
      timeout: 120_000,
      // Override DATABASE_URL with an invalid value. dotenv does not overwrite an
      // already-set variable, so this takes precedence over `.env` and validation
      // fails deterministically regardless of the machine's env files.
      env: { ...process.env, DATABASE_URL: "not-a-valid-url" },
    });

    expect(result.status).not.toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).toContain("Invalid environment variables");
    // Assert the specific overridden variable is reported, not just that *some*
    // validation failed — otherwise an unrelated missing var could mask a
    // DATABASE_URL validation/reporting regression.
    expect(output).toContain("DATABASE_URL");
    expect(output).not.toContain("Types generated successfully");
  });
});
