import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { INVALID_CONFIGURATION_RESULT, INVALID_REQUEST_RESULT } from "./authzed-schema-results";

const webRoot = fileURLToPath(new URL("../", import.meta.url));
const tsxExecutable = fileURLToPath(new URL("../../../node_modules/.bin/tsx", import.meta.url));

const runEntrypoint = (
  script: string,
  args: ReadonlyArray<string>,
  environment: Readonly<Record<string, string>> = {}
) =>
  spawnSync(tsxExecutable, ["--tsconfig", "tsconfig.json", script, ...args], {
    cwd: webRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      AUTHZED_ENABLED: "true",
      AUTHZED_ENDPOINT: "invalid-endpoint",
      AUTHZED_SYSTEM_KEY: "formbricks",
      AUTHZED_TOKEN: "test-token",
      LOG_LEVEL: "fatal",
      NODE_OPTIONS: "--conditions=react-server",
      ...environment,
    },
  });

const expectSingleJsonFailure = (
  result: ReturnType<typeof runEntrypoint>,
  expected: Readonly<Record<string, boolean | number | string>>
): void => {
  expect(result.status).toBe(1);
  expect(result.stderr).toBe("");

  const outputLines = result.stdout.trimEnd().split("\n");
  expect(outputLines).toHaveLength(1);
  expect(JSON.parse(outputLines[0])).toEqual(expected);
};

describe("AuthZed script entrypoints", () => {
  test.each([
    {
      args: ["invalid"],
      expected: INVALID_REQUEST_RESULT,
      name: "schema",
      script: "scripts/authzed-schema.ts",
    },
    {
      args: ["--unknown"],
      expected: INVALID_REQUEST_RESULT,
      name: "backfill",
      script: "scripts/authzed-backfill.ts",
    },
    {
      args: ["health", "--unknown"],
      expected: {
        code: "authzed_invalid_request",
        latencyMs: 0,
        retryable: false,
        status: "unhealthy",
      },
      name: "packaged health",
      script: "scripts/docker/authzed-cli.ts",
    },
    {
      args: ["upgrade", "--unknown"],
      expected: INVALID_REQUEST_RESULT,
      name: "packaged upgrade",
      script: "scripts/docker/authzed-cli.ts",
    },
  ])("$name rejects invalid arguments with one sanitized JSON result", ({ args, expected, script }) => {
    expectSingleJsonFailure(runEntrypoint(script, args), expected);
  });

  test.each([
    {
      args: ["check"],
      expected: INVALID_CONFIGURATION_RESULT,
      name: "schema",
      script: "scripts/authzed-schema.ts",
    },
    {
      args: [],
      expected: INVALID_CONFIGURATION_RESULT,
      name: "backfill",
      script: "scripts/authzed-backfill.ts",
    },
    {
      args: ["health"],
      expected: {
        code: "authzed_internal",
        latencyMs: 0,
        retryable: false,
        status: "unhealthy",
      },
      name: "packaged health",
      script: "scripts/docker/authzed-cli.ts",
    },
    {
      args: ["upgrade", "check"],
      expected: INVALID_CONFIGURATION_RESULT,
      name: "packaged upgrade",
      script: "scripts/docker/authzed-cli.ts",
    },
  ])("$name sanitizes runtime-loading failures", ({ args, expected, script }) => {
    expectSingleJsonFailure(runEntrypoint(script, args), expected);
  });
});
