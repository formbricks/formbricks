import { load } from "js-yaml";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

type Step = { name: string; env?: Record<string, string>; run?: string; with?: { secrets?: string } };
type Workflow = { jobs: Record<string, { env?: Record<string, string>; steps: Step[] }> };
const workflow = load(
  readFileSync(new URL("../../.github/workflows/docker-build-validation.yml", import.meta.url), "utf8")
) as Workflow;
const job = workflow.jobs["validate-docker-build"];

// Resolve the inputs as GitHub would when no repository secrets are available.
const withoutSecrets = (value: string, env: Record<string, string>): string =>
  value.replace(/\$\{\{\s*(env|secrets)\.(\w+)\s*\}\}/g, (_, context, name) =>
    context === "env" ? (env[name] ?? "") : ""
  );

const expectTestKey = (value: string | undefined) => {
  expect(value).toMatch(/^[a-f0-9]{64}$/);
};

describe("Docker validation without repository secrets", () => {
  test.each(["Build Docker Image", "Build Docker Image on isolated GitHub runner"])(
    "%s receives isolated build fixtures",
    (name) => {
      const step = job.steps.find((step) => step.name === name)!;
      const inputs = Object.fromEntries(
        withoutSecrets(step.with!.secrets!, job.env ?? {})
          .trim()
          .split("\n")
          .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)])
      );
      expect(new URL(inputs.database_url).hostname).toBe("127.0.0.1");
      expectTestKey(inputs.encryption_key);
    }
  );

  test.each([
    "Verify Release-Matched AuthZed Operator CLI",
    "Reject Invalid Environment Before Database Setup",
    "Validate Docker Compose Migration Environment",
    "Preserve Startup Migration Skip Behavior",
    "Test Docker Image with Health Check",
  ])("%s retains the test key when secrets are absent", (name) => {
    const step = job.steps.find((step) => step.name === name)!;
    expect(step).toBeDefined();
    expect(step.run).toContain("$DUMMY_ENCRYPTION_KEY");
    const overrides = Object.fromEntries(
      Object.entries(step.env ?? {}).map(([key, value]) => [key, withoutSecrets(value, job.env ?? {})])
    );
    expectTestKey({ ...job.env, ...overrides }.DUMMY_ENCRYPTION_KEY);
  });

  test("operator CLI receives authentication config before testing disabled or unreachable AuthZed", () => {
    const step = job.steps.find((step) => step.name === "Verify Release-Matched AuthZed Operator CLI")!;
    const directory = mkdtempSync(join(tmpdir(), "authzed-cli-test-"));
    const output = join(directory, "docker-calls.jsonl");
    // Run the complete workflow step against deterministic Docker responses, without a daemon or timeout.
    const script = [
      'docker() { "$TEST_NODE_PATH" "$MOCK_DOCKER_PATH" "$@"; }',
      'timeout() { shift; "$@"; }',
      step.run!,
    ].join("\n");
    try {
      execFileSync("bash", ["-c", script], {
        env: {
          PATH: process.env.PATH,
          GITHUB_SHA: "test",
          ...job.env,
          TEST_NODE_PATH: process.execPath,
          MOCK_DOCKER_PATH: fileURLToPath(new URL("./__mocks__/authzed-cli-docker.mjs", import.meta.url)),
          DOCKER_CALLS: output,
        },
      });
      const calls: string[][] = readFileSync(output, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      const cliCalls = calls.filter(
        (args) => args[args.indexOf("--entrypoint") + 1] === "formbricks-authzed"
      );
      expect(cliCalls).toHaveLength(3);
      for (const args of cliCalls) {
        expect(args).toContain(`BETTER_AUTH_SECRET=${job.env?.DUMMY_ENCRYPTION_KEY}`);
        expect(args).toContain(`ENCRYPTION_KEY=${job.env?.DUMMY_ENCRYPTION_KEY}`);
      }
      expect(cliCalls.map((args) => args.findLast((arg) => arg.startsWith("AUTHZED_ENABLED=")))).toEqual([
        "AUTHZED_ENABLED=false",
        "AUTHZED_ENABLED=true",
        "AUTHZED_ENABLED=false",
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
