import { load } from "js-yaml";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const workflowsDirectory = ".github/workflows";
const linearSyncWorkflow = `${workflowsDirectory}/linear-release.yml`;
const formbricksReleaseWorkflow = `${workflowsDirectory}/formbricks-release.yml`;
const linearSmokeWorkflow = `${workflowsDirectory}/linear-release-smoke.yml`;
const releaseWorkflows = [linearSyncWorkflow, formbricksReleaseWorkflow, linearSmokeWorkflow];

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

type WorkflowTriggers = {
  push?: { branches?: string[] };
  pull_request?: unknown;
  pull_request_target?: unknown;
};

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

const linearUses = (workflow: Workflow): string[] =>
  Object.values(workflow.jobs ?? {})
    .flatMap((job) => job?.steps ?? [])
    .map((step) => step.uses)
    .filter((uses): uses is string => uses?.startsWith(`${linearAction}@`) ?? false);

describe("release workflows", () => {
  test.each(releaseWorkflows)("%s parses as YAML and declares jobs", (path) => {
    expect(Object.keys(readWorkflow(path).jobs ?? {})).not.toHaveLength(0);
  });

  // Every use is checked, not just the first: formbricks-release.yml calls the action twice, so a
  // `toContain` on the file text would let one correct use mask a second that had drifted.
  test.each(releaseWorkflows)("pins every Linear release action use by commit SHA in %s", (path) => {
    const uses = linearUses(readWorkflow(path));

    expect(uses).not.toHaveLength(0);
    expect(uses).toEqual(uses.map(() => `${linearAction}@${linearActionSha}`));
  });

  // Separate from the pin above so a drifted annotation and a drifted pin fail distinguishably, and
  // counted so one annotated line cannot vouch for an unannotated sibling. The annotation is worth
  // asserting at all because this repo ran a v0.7.0 pin under a comment describing v0.15.1
  // behaviour for months, which is the drift that hid the bug these tests guard.
  test.each(releaseWorkflows)("annotates every pin with its release tag in %s", (path) => {
    const annotated = readText(path).split(`${linearAction}@${linearActionSha} # ${linearActionVersion}`);

    expect(annotated).toHaveLength(linearUses(readWorkflow(path)).length + 1);
  });

  test("uses no other ref of the Linear release action across the workflows", () => {
    const directory = join(repositoryRoot, workflowsDirectory);
    const pattern = new RegExp(`${linearAction}@(\\S+)`, "g");
    const refs = readdirSync(directory)
      .filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
      .flatMap((entry) => [...readFileSync(join(directory, entry), "utf8").matchAll(pattern)])
      .map((match) => match[1]);

    expect([...new Set(refs)]).toEqual([linearActionSha]);
  });

  test("completes the Linear release once the published artifacts are out", () => {
    const needs = readWorkflow(formbricksReleaseWorkflow).jobs?.["linear-release-complete"]?.needs;

    expect(needs).toEqual(
      expect.arrayContaining(["docker-build-community", "docker-build-cloud", "helm-chart-release"])
    );
    // Neither of these publishes anything for the released tag, and a skipped or failed
    // dependency skips this job, so either one gates Linear completion on unrelated work:
    // update-helm-app-version opens a follow-up PR against main and fails without its
    // credentials, and move-stable-tag is skipped by design for any stable release that is
    // not the latest - i.e. every patch on an older line.
    expect(needs).not.toContain("update-helm-app-version");
    expect(needs).not.toContain("move-stable-tag");
  });

  // The smoke job holds a pipeline-mutating Linear key, so it must not run a pull request
  // branch's own copy of itself: that would let anyone who can push a branch drop dry_run or
  // add an exfiltration step. Only main and manual dispatch may carry the key.
  test("keeps the credentialed smoke dry-run off pull request branches", () => {
    const workflow = readWorkflow(linearSmokeWorkflow);
    const triggers = workflow.on ?? workflow.true;

    expect(triggers).not.toHaveProperty("pull_request");
    expect(triggers).not.toHaveProperty("pull_request_target");
    expect(triggers?.push?.branches).toEqual(["main"]);
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
