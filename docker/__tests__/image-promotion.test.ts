import { load } from "js-yaml";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

type Step = {
  name?: string;
  id?: string;
  if?: string;
  run?: string;
  uses?: string;
  "continue-on-error"?: boolean;
  with?: Record<string, string>;
  env?: Record<string, string>;
};
const action = load(
  readFileSync(
    fileURLToPath(new URL("../../.github/actions/build-and-push-docker/action.yml", import.meta.url)),
    "utf8"
  )
) as { runs: { steps: Step[] } };
const steps = action.runs.steps;
const validation = load(
  readFileSync(
    fileURLToPath(new URL("../../.github/workflows/docker-build-validation.yml", import.meta.url)),
    "utf8"
  )
) as { jobs: { "validate-docker-build": { steps: Step[] } } };

describe("image startup validation", () => {
  test.each([true, false])(
    "cleans up and only starts the browser after health succeeds (healthy=%s)",
    (healthy) => {
      const directory = mkdtempSync(join(tmpdir(), "image-workflow-"));
      const trace = join(directory, "calls");
      try {
        const script = validation.jobs["validate-docker-build"].steps.find(
          (step) => step.name === "Test Docker Image with Health Check"
        )?.run;
        expect(script).toBeTruthy();
        // Execute the actual workflow shell with disposable boundaries; timeout polling never sleeps.
        const boundaries = String.raw`
        docker() {
          printf '%s\n' "$1" >> "$TRACE"
          case "$1" in
            inspect) echo true ;;
            logs) printf '%s\n' 'Environment variables validated successfully' 'Running database migrations' 'Running SAML database setup' ;;
          esac
        }
        curl() { test "$SMOKE_HEALTHY" = true; }
        sleep() { :; }
        psql() { printf 'fixture\n' >> "$TRACE"; }
        node() { printf 'browser\n' >> "$TRACE"; }
      `;
        const result = spawnSync("/bin/bash", ["-c", boundaries + script], {
          encoding: "utf8",
          env: {
            PATH: process.env.PATH,
            GITHUB_SHA: "fixture",
            DUMMY_ENCRYPTION_KEY: "fixture",
            TRACE: trace,
            SMOKE_HEALTHY: String(healthy),
          },
        });
        const calls = readFileSync(trace, "utf8").trim().split("\n");
        expect(result.status).toBe(healthy ? 0 : 1);
        expect(calls.filter((call) => call === "rm")).toHaveLength(1);
        expect(calls.at(-1)).toBe("rm");
        if (healthy) {
          expect(calls.slice(-3)).toEqual(["fixture", "browser", "rm"]);
        } else {
          expect(result.stdout).toContain("Health check failed");
          expect(calls).not.toContain("fixture");
          expect(calls).not.toContain("browser");
        }
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  );
});

describe("release promotion boundary", () => {
  test("publishes only a candidate until both architectures pass the image browser check", () => {
    const build = steps.findIndex((step) => step.id === "build");
    const smoke = steps.findIndex((step) => step.run?.includes("bash docker/smoke-release-image.sh"));
    const promote = steps.findIndex((step) => step.run?.includes("docker buildx imagetools create"));
    expect(build).toBeGreaterThan(-1);
    expect(smoke).toBeGreaterThan(build);
    expect(promote).toBeGreaterThan(smoke);
    expect(steps[build].with?.tags).toBe("${{ steps.candidate.outputs.tag }}");
    expect(steps[smoke].run).toContain("set -euo pipefail");
    expect(steps[smoke].run).toContain("linux/amd64");
    expect(steps[smoke].run).toContain("linux/arm64");
    expect(steps[smoke]["continue-on-error"]).not.toBe(true);
    expect(steps[smoke].if).toBe(steps[promote].if);
    expect(steps[promote].if).not.toMatch(/always\(|failure\(/);
    expect(steps[smoke].env?.IMAGE).toBe(steps[promote].env?.IMAGE);
    expect(steps[promote].env?.IMAGE).toContain("@${{ steps.build.outputs.digest }}");
    expect(steps[promote].run).toContain('test "$actual" = "${IMAGE##*@}"');
  });

  test("makes build identity and variant explicit inputs to the Docker cache", () => {
    const build = steps.find((step) => step.id === "build");
    expect(build?.with?.["build-args"]).toContain(
      "FORMBRICKS_DEPLOYMENT_ID=${{ steps.candidate.outputs.identity }}"
    );
    expect(build?.with?.["build-args"]).toContain("FORMBRICKS_BUILD_VARIANT=${{ inputs.registry_type }}");
    const identity = steps.find((step) => step.id === "candidate");
    expect(identity?.run).toContain("${GITHUB_SHA}-${REGISTRY_TYPE}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}");
  });
});
