import { loadEnvConfig } from "@next/env";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Wrapper around `next typegen` that fails loudly on an invalid environment.
 *
 * `next typegen` loads `next.config.mjs`, which imports `lib/env`. When required
 * variables are missing or invalid, `@t3-oss/env-nextjs` throws and the offending
 * variables are logged — but `next typegen` swallows that failure (it surfaces
 * only as an unhandled promise rejection) and still exits `0`. CI and scripts can
 * therefore not tell that type generation ran against an invalid environment.
 *
 * Importing `lib/env` here first runs the same validation up front, so a failure
 * becomes a hard non-zero exit before `next typegen` is ever spawned.
 */
async function main(): Promise<void> {
  // Load `.env` files exactly as `next typegen` does before it evaluates
  // `next.config.mjs`, so the preflight validation below sees the same
  // environment Next would. Existing `process.env` values (e.g. the ones the
  // package script injects via cross-env) take precedence over `.env`.
  loadEnvConfig(process.cwd());

  try {
    await import("../lib/env");
  } catch {
    // `throwEnvValidationError` already printed the formatted list of invalid
    // variables. Set the exit code and return rather than calling `process.exit`
    // so that buffered diagnostics are flushed before the process terminates.
    process.exitCode = 1;
    return;
  }

  const nextBin = require.resolve("next/dist/bin/next");
  const result = spawnSync(process.execPath, [nextBin, "typegen"], { stdio: "inherit" });

  // `spawnSync` returns a null status when the process was killed by a signal;
  // treat that as a failure too rather than reporting success.
  process.exit(result.status ?? 1);
}

void main();
