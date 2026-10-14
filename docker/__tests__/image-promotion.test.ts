import { load } from "js-yaml";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { buildIdentity } from "../../.github/actions/build-and-push-docker/build-identity.mjs";

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

type Job = {
  needs?: string | string[];
  if?: string;
  "runs-on"?: string;
  strategy?: { matrix: { include: { platform: string; runner: string }[] } };
  steps: Step[];
};
const workflow = (name: string) =>
  load(
    readFileSync(fileURLToPath(new URL(`../../.github/workflows/${name}.yml`, import.meta.url)), "utf8")
  ) as {
    jobs: Record<string, Job>;
  };
const composite = (name: string) =>
  load(
    readFileSync(fileURLToPath(new URL(`../../.github/actions/${name}/action.yml`, import.meta.url)), "utf8")
  ) as {
    runs: { steps: Step[] };
  };

describe("release promotion boundary", () => {
  test("saves candidates privately without writing release registry tags", () => {
    const build = steps.find((step) => step.id === "build");
    expect(build?.with?.tags).toBeUndefined();
    expect(build?.with?.push).toBe(false);
    expect(build?.with?.save).toBe(true);
    expect(build?.with?.outputs).toBeUndefined();
    expect(steps.some((step) => step.run?.includes("depot push"))).toBe(false);
  });

  test.each(["build-and-push-ecr", "release-docker-github", "release-docker-github-experimental"])(
    "%s gates promotion on both native architectures testing the same digest",
    (name) => {
      const { jobs } = workflow(name);
      const validation = jobs.validate;
      const promotion = jobs.promote;
      expect(validation.strategy?.matrix.include).toEqual([
        { platform: "linux/amd64", runner: "ubuntu-24.04" },
        { platform: "linux/arm64", runner: "ubuntu-24.04-arm" },
      ]);
      expect(validation["runs-on"]).toBe("${{ matrix.runner }}");
      expect(promotion.needs).toContain("validate");
      expect(promotion.needs).toContain(validation.needs);
      expect(promotion.if).toBeUndefined();
      const smoke = validation.steps.find((step) => step.uses?.endsWith("/test-release-image"));
      const promote = promotion.steps.find((step) => step.uses?.endsWith("/promote-verified-image"));
      expect(smoke?.with?.image_ref).toBe(promote?.with?.image_ref);
      expect(smoke?.with?.image_ref).toContain("outputs.IMAGE_REF");
      expect(smoke?.with?.depot_build_id).toBe(promote?.with?.depot_build_id);
      expect(smoke?.with?.platform).toBe("${{ matrix.platform }}");
      expect(smoke?.["continue-on-error"]).not.toBe(true);
    }
  );

  test.each(["success", "source changed", "destination changed"])(
    "binds publication to the validated digest (%s)",
    (scenario) => {
      const directory = mkdtempSync(join(tmpdir(), "image-promotion-"));
      const trace = join(directory, "copies");
      try {
        const script = composite("promote-verified-image").runs.steps.find((step) =>
          step.run?.includes("depot push")
        )?.run;
        const boundaries = String.raw`
          docker() {
            for arg in "$@"; do last_arg="$arg"; done
            if [[ "$last_arg" == registry.depot.dev/* ]]; then
              printf '{"digest":"%s"}\n' "$SOURCE_DIGEST"
            else
              printf '{"digest":"%s"}\n' "$DESTINATION_DIGEST"
            fi
          }
          depot() { printf '%s\n' "$*" >> "$TRACE"; }
        `;
        const result = spawnSync("/bin/bash", ["-c", boundaries + script], {
          encoding: "utf8",
          env: {
            PATH: process.env.PATH,
            TRACE: trace,
            IMAGE: "registry.depot.dev/tw0fqmsx3c@sha256:verified",
            BUILD_ID: "saved-build",
            RELEASE_TAGS: "registry.example/app:6.1.0",
            SOURCE_DIGEST: scenario === "source changed" ? "sha256:wrong" : "sha256:verified",
            DESTINATION_DIGEST: scenario === "destination changed" ? "sha256:wrong" : "sha256:verified",
          },
        });
        expect(result.status).toBe(scenario === "success" ? 0 : 1);
        if (scenario === "source changed") {
          expect(existsSync(trace)).toBe(false);
        } else {
          expect(readFileSync(trace, "utf8").trim()).toBe(
            "push --project tw0fqmsx3c --tag registry.example/app:6.1.0 saved-build"
          );
        }
        if (scenario !== "success") expect(result.stderr).toContain("resume with the verified digest");
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  );

  test("checks promoted tags against the tested digest and keeps explicit repair cache bypass", () => {
    const promotion = composite("promote-verified-image").runs.steps;
    const publish = promotion.find((step) => step.run?.includes("depot push"));
    expect(publish?.run).toContain('test "$saved" = "${IMAGE##*@}"');
    expect(publish?.run).toContain('test "${#args[@]}" -gt 0');
    expect(publish?.run).toContain('depot push --project tw0fqmsx3c "${args[@]}" "$BUILD_ID"');
    expect(publish?.run).toContain('test "$actual" = "${IMAGE##*@}"');
    expect(steps.find((step) => step.id === "build")?.with?.["no-cache-filters"]).toBe(
      "${{ inputs.rebuild_application == 'true' && 'installer,runner' || '' }}"
    );
  });
});

const buildEnv = {
  GITHUB_SHA: "revision-one",
  REGISTRY_TYPE: "ecr",
  BUILD_VERSION: "6.1.0",
  SENTRY_AUTH_TOKEN: "token-one",
  POSTHOG_KEY: "public-ingestion-key",
  GITHUB_RUN_ID: "1",
  GITHUB_RUN_ATTEMPT: "1",
};

describe("cacheable deployment identity", () => {
  test("reruns and credential rotations reuse the same build profile", () => {
    expect(
      buildIdentity({
        ...buildEnv,
        GITHUB_RUN_ID: "2",
        GITHUB_RUN_ATTEMPT: "3",
        SENTRY_AUTH_TOKEN: "token-two",
      })
    ).toBe(buildIdentity(buildEnv));
  });
  test.each([
    { GITHUB_SHA: "revision-two" },
    { REGISTRY_TYPE: "ghcr" },
    { BUILD_VERSION: "6.1.1" },
    { SENTRY_AUTH_TOKEN: "" },
    { POSTHOG_KEY: "different-key" },
  ])("changed build inputs invalidate the cache (%j)", (change) => {
    expect(buildIdentity({ ...buildEnv, ...change })).not.toBe(buildIdentity(buildEnv));
  });
  test("explicit repairs get a distinct identity on each attempt", () => {
    const repair = { ...buildEnv, REBUILD_APPLICATION: "true" };
    expect(buildIdentity(repair)).not.toBe(buildIdentity(buildEnv));
    expect(buildIdentity({ ...repair, GITHUB_RUN_ATTEMPT: "2" })).not.toBe(buildIdentity(repair));
  });
});
