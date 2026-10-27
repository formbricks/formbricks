import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const script = fileURLToPath(
  new URL("../../apps/web/scripts/docker/formbricks-authzed-prepare", import.meta.url)
);
const directories: string[] = [];
const acknowledgements = ["--backup-confirmed", "--writers-stopped"];

const execute = (args = acknowledgements, overrides: NodeJS.ProcessEnv = {}) => {
  const directory = mkdtempSync(join(tmpdir(), "formbricks-maintenance-"));
  directories.push(directory);
  const trace = join(directory, "trace");
  writeFileSync(trace, "");
  for (const name of ["node", "formbricks-authzed"]) {
    writeFileSync(
      join(directory, name),
      `#!/bin/sh
printf '%s\\n' "$*" >> "$TRACE"
printf '%s\\n' "$PRIVATE_VALUE"
printf '%s\\n' "$PRIVATE_VALUE" >&2
if [ -n "$STUB_OUTPUT" ]; then printf '%s\\n' "$STUB_OUTPUT" >&2; fi
if [ "$*" = "$FAIL_STEP" ]; then
  if [ -n "$STUB_RESULT" ]; then printf '%s\\n' "$STUB_RESULT"; fi
  exit 1
fi
`,
      { mode: 0o700 }
    );
  }
  // Records each step's limit, then stands in for a step that ran out its time: it moves the stubbed clock
  // past the limit and exits as BusyBox does (143), or as a step's own SIGTERM handler might.
  writeFileSync(
    join(directory, "timeout"),
    `#!/bin/sh
printf '%s\\n' "$1" >> "$TRACE.limits"
shift
command="$1"
shift
if [ "$TIMEOUT_STEP" = "$*" ]; then
  printf '%s\\n' "$*" >> "$TRACE"
  : > "$TRACE.expired"
  exit "$TIMEOUT_EXIT"
fi
exec "$command" "$@"
`,
    { mode: 0o700 }
  );
  writeFileSync(
    join(directory, "date"),
    `#!/bin/sh\nif [ -e "$TRACE.expired" ]; then echo 1000000; else echo 1000; fi\n`,
    { mode: 0o700 }
  );
  const result = spawnSync("sh", [script, ...args], {
    cwd: directory,
    env: {
      ...process.env,
      AUTHZED_ENABLED: "true",
      AUTHZED_CONSISTENCY: "fully_consistent",
      FAIL_STEP: "",
      FORMBRICKS_AUTHZED_PREPARE_STEP_TIMEOUT_SECONDS: undefined,
      STUB_OUTPUT: "",
      STUB_RESULT: "",
      TIMEOUT_EXIT: "143",
      TIMEOUT_STEP: "",
      PATH: `${directory}:${process.env.PATH}`,
      PRIVATE_VALUE: "token-database-password-relationship-id",
      TRACE: trace,
      ...overrides,
    },
    encoding: "utf8",
    timeout: 5_000,
  });
  expect(result.stderr).toBe("");
  expect(result.stdout).not.toContain("token-database-password-relationship-id");
  expect(result.stdout.trim().split("\n")).toHaveLength(1);
  return {
    ...result,
    output: JSON.parse(result.stdout),
    trace: readFileSync(trace, "utf8").trim().split("\n").filter(Boolean),
    limits: existsSync(`${trace}.limits`)
      ? readFileSync(`${trace}.limits`, "utf8").trim().split("\n").filter(Boolean)
      : [],
  };
};

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("maintenance-only preparation", () => {
  test.each(
    [[], ["--backup-confirmed"], ["--writers-stopped"], [...acknowledgements, "--unknown"]].map((args) => ({
      args,
    }))
  )("requires acknowledgements and recognized arguments before running commands: $args", ({ args }) => {
    const result = execute(args);
    expect(result.status).toBe(2);
    expect(result.trace).toEqual([]);
    expect(result.output).not.toHaveProperty("restartRequired");
  });

  test.each(["", "sha256:invalid", "sha256:" + "g".repeat(64), "token-secret"])(
    "rejects invalid digest %s",
    (digest) => {
      const result = execute([...acknowledgements, "--expected-current-digest", digest]);
      expect(result.status).toBe(2);
      expect(result.trace).toEqual([]);
      expect(result.output.code).toBe("upgrade_invalid_arguments");
    }
  );

  test.each([
    { env: { AUTHZED_ENABLED: "false" }, variable: "AUTHZED_ENABLED" },
    { env: { AUTHZED_ENABLED: "" }, variable: "AUTHZED_ENABLED" },
    { env: { AUTHZED_CONSISTENCY: "minimize_latency" }, variable: "AUTHZED_CONSISTENCY" },
  ])("rejects incompatible authorization before migrations, naming $variable", ({ env, variable }) => {
    const result = execute(acknowledgements, env);
    expect(result.status).toBe(2);
    expect(result.trace).toEqual([]);
    expect(result.output).toEqual({
      status: "blocked",
      code: "upgrade_configuration_invalid",
      variables: [variable],
    });
  });

  test("names the variables the environment check rejects, and nothing else of its output", () => {
    // The validator's real shape: one "  - NAME: message" line per variable, then the issues it threw.
    const validatorOutput = [
      "Invalid environment variables:",
      "  - REDIS_URL: REDIS_URL is required for caching, rate limiting, and audit logging",
      "  - ENCRYPTION_KEY: Invalid input",
      "  issues: [ { path: 'ENCRYPTION_KEY', message: 'Invalid input' } ]",
    ].join("\n");
    const result = execute(acknowledgements, {
      FAIL_STEP: "/home/nextjs/validate-env.mjs",
      STUB_OUTPUT: validatorOutput,
    });

    expect(result.status).toBe(2);
    expect(result.trace).toEqual(["/home/nextjs/validate-env.mjs"]);
    expect(result.output).toEqual({
      status: "blocked",
      code: "upgrade_configuration_invalid",
      variables: ["ENCRYPTION_KEY", "REDIS_URL"],
    });
    expect(result.stdout).not.toContain("Invalid input");
  });

  const steps = [
    ["/home/nextjs/validate-env.mjs", "upgrade_configuration_invalid"],
    ["health", "upgrade_spicedb_unhealthy"],
    ["/home/nextjs/packages/database/dist/scripts/apply-migrations.js", "upgrade_database_migration_failed"],
    ["upgrade prepare", "upgrade_graph_not_ready"],
    ["upgrade check", "upgrade_verification_failed"],
  ];

  test.each(steps)("stops after %s fails, without restarting workloads", (step, code) => {
    const result = execute(acknowledgements, { FAIL_STEP: step });
    expect(result.status).toBe(2);
    expect(result.output).toEqual({ status: "blocked", code });
    expect(result.trace).toEqual(
      steps.slice(0, steps.findIndex(([command]) => command === step) + 1).map(([command]) => command)
    );
  });

  // ENG-4039: EU Cloud's graph step ran out its 30 minutes and reported only `upgrade_graph_not_ready`, which
  // read as drift in a graph a check a minute later found clean.
  test.each([
    { exit: "143", how: "BusyBox's SIGTERM exit" },
    { exit: "1", how: "a step's own SIGTERM handler" },
  ])("reports a step that ran out its time as a timeout, after $how", ({ exit }) => {
    const result = execute(acknowledgements, { TIMEOUT_STEP: "upgrade prepare", TIMEOUT_EXIT: exit });
    expect(result.status).toBe(2);
    expect(result.output).toEqual({
      status: "blocked",
      code: "upgrade_graph_not_ready",
      reason: "timeout",
      timeoutSeconds: 5400,
    });
    expect(result.trace).toEqual(steps.slice(0, 4).map(([step]) => step));
  });

  test("a timeout blocks subsequent steps", () => {
    const result = execute(acknowledgements, { TIMEOUT_STEP: "health" });
    expect(result.status).toBe(2);
    expect(result.trace).toEqual(steps.slice(0, 2).map(([step]) => step));
    expect(result.output).toMatchObject({ code: "upgrade_spicedb_unhealthy", reason: "timeout" });
  });

  test("reports an environment check that ran out its time as a timeout, not as invalid variables", () => {
    const result = execute(acknowledgements, { TIMEOUT_STEP: "/home/nextjs/validate-env.mjs" });
    expect(result.status).toBe(2);
    expect(result.trace).toEqual([steps[0][0]]);
    expect(result.output).toEqual({
      status: "blocked",
      code: "upgrade_configuration_invalid",
      reason: "timeout",
      timeoutSeconds: 5400,
    });
  });

  test("applies the configured limit to every step", () => {
    expect(execute().limits).toEqual(Array(steps.length).fill("5400"));
    const result = execute(acknowledgements, { FORMBRICKS_AUTHZED_PREPARE_STEP_TIMEOUT_SECONDS: "7200" });
    expect(result.status).toBe(0);
    expect(result.limits).toEqual(Array(steps.length).fill("7200"));
  });

  test.each(["0", "59", "86401", "3600s", "1e4", "-1"])(
    "rejects step limit %j before running any step",
    (limit) => {
      const result = execute(acknowledgements, { FORMBRICKS_AUTHZED_PREPARE_STEP_TIMEOUT_SECONDS: limit });
      expect(result.status).toBe(2);
      expect(result.trace).toEqual([]);
      expect(result.output).toEqual({
        status: "blocked",
        code: "upgrade_configuration_invalid",
        variables: ["FORMBRICKS_AUTHZED_PREPARE_STEP_TIMEOUT_SECONDS"],
      });
    }
  );

  test("carries the command's own error code and retryable flag, and nothing else of its output", () => {
    const result = execute(acknowledgements, {
      FAIL_STEP: "upgrade prepare",
      STUB_RESULT: '{"code":"authzed_unavailable","retryable":true,"status":"failed"}',
    });
    expect(result.status).toBe(2);
    expect(result.output).toEqual({
      status: "blocked",
      code: "upgrade_graph_not_ready",
      cause: "authzed_unavailable",
      retryable: true,
    });
  });

  test.each([
    '{"code":"token-database-password-relationship-id","retryable":"yes","status":"failed"}',
    '{"code":"authzed_unavailable\\",\\"injected\\":\\"x","status":"failed"}',
    "authzed_unavailable retryable true",
  ])("ignores a result line outside the closed patterns: %s", (line) => {
    const result = execute(acknowledgements, { FAIL_STEP: "upgrade prepare", STUB_RESULT: line });
    expect(result.status).toBe(2);
    expect(result.output).toEqual({ status: "blocked", code: "upgrade_graph_not_ready" });
  });

  test("reuses migrations and aggregate-only preparation in order; successful preparation does not start v6", () => {
    const result = execute();
    expect(result.status).toBe(0);
    expect(result.trace).toEqual(steps.map(([step]) => step));
    expect(result.output).toEqual({ status: "prepared", code: "upgrade_prepared", restartRequired: true });
  });

  test("passes only the reviewed digest to schema preparation", () => {
    const digest = `sha256:${"a".repeat(64)}`;
    const result = execute([...acknowledgements, "--expected-current-digest", digest]);
    expect(result.status).toBe(0);
    expect(result.trace[3]).toBe(`upgrade prepare --expected-current-digest ${digest}`);
    expect(result.stdout).not.toContain(digest);
  });
});
