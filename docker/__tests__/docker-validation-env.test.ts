import { load } from "js-yaml";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  test.each([
    { token: "", forceLocal: "", expected: "false" },
    { token: "test-depot-token", forceLocal: "false", expected: "true" },
    { token: "test-depot-token", forceLocal: "true", expected: "false" },
  ])("selects depot=$expected with forced local builder=$forceLocal", ({ token, forceLocal, expected }) => {
    const step = job.steps.find((step) => step.name === "Select Docker builder")!;
    const directory = mkdtempSync(join(tmpdir(), "docker-builder-test-"));
    const output = join(directory, "output");
    try {
      execFileSync("bash", ["-e", "-c", step.run!], {
        env: {
          PATH: process.env.PATH,
          DEPOT_PROJECT_TOKEN: token,
          FORCE_LOCAL_BUILDER: forceLocal,
          GITHUB_OUTPUT: output,
        },
      });
      expect(readFileSync(output, "utf8").trim()).toBe(`depot=${expected}`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test.each(["Build Docker Image", "Build Docker Image without Depot credentials"])(
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
    // Execute through the first CLI invocation and capture its Docker arguments in `output`.
    // Silence the earlier image-inspection call; no Docker daemon or image is needed here.
    const script = [
      'docker() { printf "%s\\n" "$@"; }',
      "{",
      step.run!.split("status=$?")[0],
      "} >/dev/null",
      'printf "%s\\n" "$output"',
    ].join("\n");
    const args = execFileSync("bash", ["-c", script], {
      env: { PATH: process.env.PATH, GITHUB_SHA: "test", ...job.env },
      encoding: "utf8",
    }).split("\n");
    expect(args.slice(0, 4)).toEqual(["run", "--rm", "--entrypoint", "formbricks-authzed"]);
    expect(args).toContain(`BETTER_AUTH_SECRET=${job.env?.DUMMY_ENCRYPTION_KEY}`);
    expect(args).toContain("AUTHZED_ENABLED=false");
  });
});
