import { load } from "js-yaml";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const workflowsDirectory = ".github/workflows";
const linearSyncWorkflow = `${workflowsDirectory}/linear-release.yml`;
const formbricksReleaseWorkflow = `${workflowsDirectory}/formbricks-release.yml`;

const linearAction = "linear/linear-release-action";
const linearActionSha = "17b8c24f8ceb2b98cabaf1965ff83c55dd596fac";
const linearActionVersion = "v0.15.1";
const releasedVersion = "${{ needs.docker-build-community.outputs.VERSION }}";

type WorkflowStep = {
  uses?: string;
  with?: {
    "fetch-depth"?: number;
    access_key?: string;
    command?: string;
    dry_run?: string;
    version?: string;
  };
};

type WorkflowTriggers = { push?: { branches?: string[] } };

type Workflow = {
  jobs?: Record<string, { if?: string; needs?: string[]; steps?: WorkflowStep[] } | undefined>;
  on?: WorkflowTriggers;
  // js-yaml 3 resolved the YAML 1.1 truthy key `on:` to boolean `true`; 4.x keeps it a string.
  true?: WorkflowTriggers;
};

const readText = (relativePath: string): string => readFileSync(join(repositoryRoot, relativePath), "utf8");

const readWorkflow = (relativePath: string): Workflow => load(readText(relativePath)) as Workflow;

const linearSteps = (workflow: Workflow, jobId: string): WorkflowStep[] =>
  (workflow.jobs?.[jobId]?.steps ?? []).filter((step) => step.uses?.startsWith(`${linearAction}@`));

describe("release workflows", () => {
  test.each([linearSyncWorkflow, formbricksReleaseWorkflow])(
    "%s parses as YAML and declares jobs",
    (path) => {
      expect(Object.keys(readWorkflow(path).jobs ?? {})).not.toHaveLength(0);
    }
  );

  test.each([linearSyncWorkflow, formbricksReleaseWorkflow])(
    "pins the Linear release action by commit SHA in %s",
    (path) => {
      expect(readText(path)).toContain(`${linearAction}@${linearActionSha} # ${linearActionVersion}`);
    }
  );

  test("uses no other ref of the Linear release action across the workflows", () => {
    const directory = join(repositoryRoot, workflowsDirectory);
    const pattern = new RegExp(`${linearAction}@(\\S+)`, "g");
    const refs = readdirSync(directory)
      .filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
      .flatMap((entry) => [...readFileSync(join(directory, entry), "utf8").matchAll(pattern)])
      .map((match) => match[1]);

    expect([...new Set(refs)]).toEqual([linearActionSha]);
  });

  test("completes the Linear release once the shipped artifacts are published", () => {
    const needs = readWorkflow(formbricksReleaseWorkflow).jobs?.["linear-release-complete"]?.needs;

    expect(needs).toEqual(
      expect.arrayContaining([
        "docker-build-community",
        "docker-build-cloud",
        "helm-chart-release",
        "move-stable-tag",
      ])
    );
    // The Helm appVersion PR targets main, not the released tag, so it must not gate Linear completion.
    expect(needs).not.toContain("update-helm-app-version");
  });

  test("stamps the released version on Linear before completing the release", () => {
    const steps = linearSteps(readWorkflow(formbricksReleaseWorkflow), "linear-release-complete");

    expect(steps.map((step) => step.with?.version)).toEqual([releasedVersion, releasedVersion]);
    expect(steps.map((step) => step.with?.command)).toEqual([undefined, "complete"]);
  });

  test("skips the Linear completion for prereleases", () => {
    expect(readWorkflow(formbricksReleaseWorkflow).jobs?.["linear-release-complete"]?.if).toBe(
      "${{ !github.event.release.prerelease }}"
    );
  });

  test("keeps the unversioned Linear sync on pushes to main", () => {
    const workflow = readWorkflow(linearSyncWorkflow);
    const checkout = workflow.jobs?.["linear-release"]?.steps?.find((step) =>
      step.uses?.startsWith("actions/checkout@")
    );

    expect((workflow.on ?? workflow.true)?.push?.branches).toContain("main");
    expect(checkout?.with?.["fetch-depth"]).toBe(0);
    // No version input: this train is the started release that `command: complete` later looks up.
    expect(linearSteps(workflow, "linear-release").map((step) => step.with?.version)).toEqual([undefined]);
  });
});
