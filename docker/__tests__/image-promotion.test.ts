import { load } from "js-yaml";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { buildIdentity } from "../../.github/actions/prepare-docker-image/build-identity.mjs";

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
    fileURLToPath(new URL("../../.github/actions/prepare-docker-image/action.yml", import.meta.url)),
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
  env?: Record<string, string>;
  outputs?: Record<string, string>;
  strategy?: { matrix: { include: { platform: string; runner: string }[] } };
  steps: Step[];
};
const workflow = (name: string) =>
  load(
    readFileSync(fileURLToPath(new URL(`../../.github/workflows/${name}.yml`, import.meta.url)), "utf8")
  ) as {
    jobs: Record<string, Job>;
    permissions?: Record<string, string>;
    env?: Record<string, string>;
    on?: { workflow_dispatch?: { inputs?: Record<string, { default?: boolean }> } };
  };
const composite = (name: string) =>
  load(
    readFileSync(fileURLToPath(new URL(`../../.github/actions/${name}/action.yml`, import.meta.url)), "utf8")
  ) as {
    runs: { steps: Step[] };
  };

describe("release promotion boundary", () => {
  test("keeps the Blacksmith trial opt-in and outside the publishing path", () => {
    const experimental = workflow("release-docker-github-experimental");
    expect(experimental.on?.workflow_dispatch?.inputs?.blacksmith_trial.default).toBe(false);
    expect(experimental.jobs["blacksmith-trial"].if).toBe("inputs.blacksmith_trial");
    expect(experimental.on?.workflow_dispatch?.inputs?.blacksmith_registry_trial.default).toBe(false);
    expect(experimental.jobs["blacksmith-registry-trial"].if).toBe("inputs.blacksmith_registry_trial");
    expect(experimental.jobs["build-community-testing"].if).toBe(
      "${{ !inputs.blacksmith_trial && !inputs.blacksmith_registry_trial }}"
    );
    expect(experimental.jobs.validate.needs).toBe("build-community-testing");
    expect(experimental.jobs.promote.needs).toContain("build-community-testing");

    const trial = workflow("blacksmith-docker-trial");
    expect(trial.permissions).toEqual({ contents: "read" });
    const build = trial.jobs.build.steps.find((step) => step.id === "build");
    expect(build?.with?.push).toBe(false);
    expect(build?.with?.load).toBe(true);
  });

  test("saves candidates privately without writing release registry tags", () => {
    const candidate = workflow("build-docker-candidate");
    const build = candidate.jobs.build.steps.find((step) => step.name === "Build private native candidate");
    expect(candidate.env?.CANDIDATE_REPOSITORY).toBe(
      "${{ vars.ECR_REGISTRY }}/${{ vars.ECR_CANDIDATE_REPOSITORY }}"
    );
    expect(build?.with?.tags).toBe(
      "${{ env.CANDIDATE_REPOSITORY }}:${{ env.CANDIDATE_TAG }}-${{ matrix.arch }}"
    );
    expect(build?.with?.push).toBe(true);
    expect(candidate.jobs.merge.needs).toContain("build");
    expect(steps.some((step) => step.uses?.includes("build-push-action"))).toBe(false);
  });

  test("rerunning a failed architecture retains the original preparation's candidate tags", () => {
    const { jobs } = workflow("build-docker-candidate");
    expect(jobs.build.env?.CANDIDATE_TAG).toBe("${{ needs.prepare.outputs.candidate_tag }}");
    expect(jobs.merge.env?.CANDIDATE_TAG).toBe(jobs.build.env?.CANDIDATE_TAG);
    expect(jobs.prepare.outputs?.candidate_tag).toBe("${{ steps.candidate.outputs.tag }}");
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
      expect(smoke?.with?.aws_role_arn).toBe(promote?.with?.aws_role_arn);
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
          step.run?.includes("skopeo copy")
        )?.run;
        const boundaries = String.raw`
          docker() {
            for arg in "$@"; do last_arg="$arg"; done
            if [[ "$last_arg" == registry.example/candidates@* ]]; then
              printf '{"digest":"%s"}\n' "$SOURCE_DIGEST"
            else
              printf '{"digest":"%s"}\n' "$DESTINATION_DIGEST"
            fi
          }
          skopeo() { printf '%s\n' "$*" >> "$TRACE"; }
        `;
        const digest = `sha256:${"ab".repeat(32)}`;
        const result = spawnSync("/bin/bash", ["-c", boundaries + script], {
          encoding: "utf8",
          env: {
            PATH: process.env.PATH,
            HOME: directory,
            TRACE: trace,
            IMAGE: `registry.example/candidates@${digest}`,
            RELEASE_TAGS: "registry.example/app:6.1.0",
            SOURCE_DIGEST: scenario === "source changed" ? "sha256:wrong" : digest,
            DESTINATION_DIGEST: scenario === "destination changed" ? "sha256:wrong" : digest,
          },
        });
        expect(result.status).toBe(scenario === "success" ? 0 : 1);
        if (scenario === "source changed") {
          expect(existsSync(trace)).toBe(false);
        } else {
          expect(readFileSync(trace, "utf8").trim()).toBe(
            `copy --all --preserve-digests --authfile ${directory}/.docker/config.json docker://registry.example/candidates@${digest} docker://registry.example/app:6.1.0`
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
    const publish = promotion.find((step) => step.run?.includes("skopeo copy"));
    expect(publish?.run).toContain('test "$saved" = "${IMAGE##*@}"');
    expect(publish?.run).toContain('test "${#tags[@]}" -gt 0');
    expect(publish?.run).toContain("skopeo copy --all --preserve-digests");
    expect(publish?.run).toContain('test "$actual" = "${IMAGE##*@}"');
    const build = workflow("build-docker-candidate").jobs.build.steps.find(
      (step) => step.name === "Build private native candidate"
    );
    expect(build?.with?.["no-cache-filters"]).toBe(
      "${{ inputs.rebuild_application == true && 'installer,runner' || '' }}"
    );
  });

  test.each([
    "valid",
    "release repository",
    "wrong URI",
    "long retention",
    "tagged only",
    "multiple rules",
    "missing policy",
  ])("requires bounded retention on a separate candidate repository (%s)", (scenario) => {
    const script = readFileSync(
      fileURLToPath(new URL("../verify-candidate-repository.sh", import.meta.url)),
      "utf8"
    );
    const policy = JSON.parse(
      readFileSync(fileURLToPath(new URL("../blacksmith-candidate-lifecycle.json", import.meta.url)), "utf8")
    );
    if (scenario === "long retention") policy.rules[0].selection.countNumber = 30;
    if (scenario === "tagged only") policy.rules[0].selection.tagStatus = "tagged";
    if (scenario === "multiple rules") policy.rules.push(policy.rules[0]);
    const boundaries = String.raw`
        aws() {
          case "$2" in
            describe-repositories) printf '%s\n' "$ACTUAL_URI" ;;
            get-lifecycle-policy) test "$HAS_POLICY" = true || return 1; printf '%s\n' "$POLICY" ;;
            *) return 1 ;;
          esac
        }
      `;
    const result = spawnSync("/bin/bash", ["-c", boundaries + script], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        STAGING_REPOSITORY: scenario === "release repository" ? "release" : "candidates",
        RELEASE_REPOSITORY: "release",
        CANDIDATE_REPOSITORY: "registry.example/candidates",
        ACTUAL_URI: scenario === "wrong URI" ? "registry.example/wrong" : "registry.example/candidates",
        HAS_POLICY: String(scenario !== "missing policy"),
        POLICY: JSON.stringify({ lifecyclePolicyText: JSON.stringify(policy) }),
      },
    });
    if (scenario === "valid") expect(result.status).toBe(0);
    else expect(result.status).not.toBe(0);
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
