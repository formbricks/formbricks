import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const scriptRoot = fileURLToPath(new URL("./", import.meta.url));
const directories: string[] = [];

const run = (configuration = "", failStep = "", env: NodeJS.ProcessEnv = {}, envFilename = ".env") => {
  const root = mkdtempSync(join(tmpdir(), "dev-spicedb-up-"));
  directories.push(root);
  mkdirSync(join(root, "scripts"));
  mkdirSync(join(root, "bin"));
  for (const script of ["dev-authzed-up.sh", "setup-dev-env.sh", "dev-env.sh"]) {
    writeFileSync(join(root, "scripts", script), readFileSync(join(scriptRoot, script)));
  }
  writeFileSync(join(root, ".env.example"), configuration);
  if (envFilename !== ".env") {
    writeFileSync(join(root, ".env"), "AUTHZED_ENDPOINT=do-not-use.example.com:443\n");
  }
  const trace = join(root, "trace");
  writeFileSync(trace, "");
  for (const executable of ["docker", "pnpm"]) {
    writeFileSync(
      join(root, "bin", executable),
      `#!/bin/sh
printf '%s\\n' "$*" >> "$TRACE"
if [ "$*" = "$FAIL_STEP" ]; then exit 1; fi
`,
      { mode: 0o700 }
    );
  }
  const result = spawnSync("bash", [join(root, "scripts/dev-authzed-up.sh")], {
    env: {
      ...process.env,
      AUTHZED_ENDPOINT: "",
      SPICEDB_GRPC_PORT: "",
      FORMBRICKS_ENV_PATH: join(root, envFilename),
      FORMBRICKS_ENV_TEMPLATE_PATH: join(root, ".env.example"),
      PATH: `${join(root, "bin")}:${process.env.PATH}`,
      TRACE: trace,
      FAIL_STEP: failStep.replaceAll("<root>", root),
      ...env,
    },
    encoding: "utf8",
    timeout: 10_000,
  });
  return {
    ...result,
    trace: readFileSync(trace, "utf8").replaceAll(root, "<root>").trim().split("\n").filter(Boolean),
  };
};

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("bundled development initialization", () => {
  const steps = [
    "compose --env-file <root>/.env -f docker-compose.dev.yml up -d --wait --wait-timeout 180 spicedb",
    "exec dotenv -e <root>/.env -- pnpm db:migrate:dev",
    "exec dotenv -e <root>/.env -- pnpm authzed:upgrade prepare",
    "exec dotenv -e <root>/.env -- pnpm authzed:upgrade check",
  ];

  test("waits for SpiceDB, migrates PostgreSQL, then prepares and checks the graph", () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.trace).toEqual(steps);
  });

  test.each(steps)("stops when %s fails", (step) => {
    const result = run("", step);
    expect(result.status).toBe(1);
    expect(result.trace).toEqual(steps.slice(0, steps.indexOf(step) + 1));
  });

  test("uses the custom environment file for endpoint validation, Compose, and every CLI command", () => {
    const result = run("  AUTHZED_ENDPOINT = 'localhost:50051'\n", "", {}, "custom.env");
    expect(result.status).toBe(0);
    expect(result.trace).toEqual(steps.map((step) => step.replace("/.env", "/custom.env")));
  });

  test("does not initialize an external datastore automatically", () => {
    const result = run("AUTHZED_ENDPOINT=grpc.example.com:443\nAUTHZED_TOKEN=private-token\n");
    expect(result.status).toBe(1);
    expect(result.trace).toEqual([]);
    expect(result.stderr).toContain("external instance");
    expect(result.stdout + result.stderr).not.toContain("private-token");
  });

  test("rejects ambient endpoint overrides instead of preparing a different datastore", () => {
    const result = run("", "", { AUTHZED_ENDPOINT: "grpc.example.com:443" });
    expect(result.status).toBe(1);
    expect(result.trace).toEqual([]);
  });
});
