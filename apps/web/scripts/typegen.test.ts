import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(scriptDir, "typegen.ts");
const appDir = path.resolve(scriptDir, "..");

// Regression guard for the failure exit-code path: `next typegen` used to swallow
// environment-validation failures and still exit 0, so CI could not detect that
// type generation ran against an invalid environment. The wrapper must now surface
// that failure as a non-zero exit while still listing the offending variables.
//
// The success path (valid env -> exit 0, "Types generated successfully") is
// exercised by the `typegen` / `typecheck` CI step, which runs the wrapper for
// real; duplicating it here would mean running a full `next typegen` inside a unit
// test.
describe("typegen wrapper", () => {
  test("exits non-zero and lists invalid variables when env validation fails", () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", scriptPath], {
      cwd: appDir,
      encoding: "utf8",
      timeout: 60_000,
      // Override DATABASE_URL with an invalid value; it takes precedence over any
      // value loaded from `.env`, so validation fails deterministically regardless
      // of the machine's env files.
      env: { ...process.env, DATABASE_URL: "not-a-valid-url" },
    });

    expect(result.status).not.toBe(0);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).toContain("Invalid environment variables");
    expect(output).not.toContain("Types generated successfully");
  });
});
