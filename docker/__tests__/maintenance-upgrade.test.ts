import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
if [ "$*" = "$FAIL_STEP" ]; then exit 1; fi
`,
      { mode: 0o700 }
    );
  }
  writeFileSync(
    join(directory, "timeout"),
    '#!/bin/sh\nif [ "$TIMEOUT_STEP" = "$3" ]; then exit 124; fi\nshift\nexec "$@"\n',
    { mode: 0o700 }
  );
  const result = spawnSync("sh", [script, ...args], {
    cwd: directory,
    env: {
      ...process.env,
      AUTHZED_ENABLED: "true",
      AUTHZED_CONSISTENCY: "fully_consistent",
      FAIL_STEP: "",
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
    { AUTHZED_ENABLED: "false" },
    { AUTHZED_ENABLED: "" },
    { AUTHZED_CONSISTENCY: "minimize_latency" },
  ])("rejects incompatible authorization before migrations: %j", (env) => {
    const result = execute(acknowledgements, env);
    expect(result.status).toBe(2);
    expect(result.trace).toEqual([]);
    expect(result.output.code).toBe("upgrade_configuration_invalid");
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

  test("timeout blocks subsequent steps", () => {
    const result = execute(acknowledgements, { TIMEOUT_STEP: "health" });
    expect(result.status).toBe(2);
    expect(result.trace).toEqual([steps[0][0]]);
    expect(result.output.code).toBe("upgrade_spicedb_unhealthy");
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
