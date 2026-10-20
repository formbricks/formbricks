import { load } from "js-yaml";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

  test("runtime checks retain the test key when secrets are absent", () => {
    const consumers = job.steps.filter((step) => step.run?.includes("$DUMMY_ENCRYPTION_KEY"));
    expect(consumers.length).toBeGreaterThan(0);
    for (const step of consumers) {
      const overrides = Object.fromEntries(
        Object.entries(step.env ?? {}).map(([key, value]) => [key, withoutSecrets(value, job.env ?? {})])
      );
      expectTestKey({ ...job.env, ...overrides }.DUMMY_ENCRYPTION_KEY);
    }
  });

  test("operator CLI receives authentication config before testing disabled or unreachable AuthZed", () => {
    const step = job.steps.find((step) => step.name === "Verify Release-Matched AuthZed Operator CLI")!;
    // Execute the actual argument construction; no Docker daemon or image is needed here.
    const script = `docker() { :; }\n${step.run!.split("set +e")[0]}\nprintf '%s\\n' "\${AUTHZED_CLI_ENV[@]}"`;
    const args = execFileSync("bash", ["-c", script], {
      env: { PATH: process.env.PATH, GITHUB_SHA: "test", ...job.env },
      encoding: "utf8",
    }).split("\n");
    expect(args).toContain(`BETTER_AUTH_SECRET=${job.env?.DUMMY_ENCRYPTION_KEY}`);
    expect(args).toContain("AUTHZED_ENABLED=false");
  });
});
