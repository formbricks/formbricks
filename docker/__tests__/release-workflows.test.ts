import { load } from "js-yaml";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const workflowsDirectory = ".github/workflows";
const linearSyncWorkflow = `${workflowsDirectory}/linear-release.yml`;
const formbricksReleaseWorkflow = `${workflowsDirectory}/formbricks-release.yml`;
const helmReleaseWorkflow = `${workflowsDirectory}/release-helm-chart.yml`;
const linearSmokeWorkflow = `${workflowsDirectory}/linear-release-smoke.yml`;
const linearCutWorkflow = `${workflowsDirectory}/linear-release-cut.yml`;
const releaseWorkflows = [
  linearSyncWorkflow,
  formbricksReleaseWorkflow,
  linearSmokeWorkflow,
  linearCutWorkflow,
];

const linearAction = "linear/linear-release-action";
const linearActionSha = "17b8c24f8ceb2b98cabaf1965ff83c55dd596fac";
const linearActionVersion = "v0.15.1";
const releasedVersion = "${{ needs.docker-build-community.outputs.VERSION }}";

type WorkflowStep = {
  env?: Record<string, string>;
  id?: string;
  if?: string;
  name?: string;
  run?: string;
  uses?: string;
  with?: {
    "fetch-depth"?: number;
    access_key?: string;
    base_ref?: string;
    command?: string;
    dry_run?: string;
    stage?: string;
    version?: string;
  };
};

type WorkflowInput = {
  description?: string;
  required?: boolean;
  type?: string;
};

type WorkflowTriggers = {
  push?: { branches?: string[]; paths?: string[] };
  workflow_call?: { inputs?: Record<string, WorkflowInput> };
  workflow_dispatch?: { inputs?: Record<string, WorkflowInput> };
  pull_request?: unknown;
  pull_request_target?: unknown;
};

type WorkflowJob = {
  if?: string;
  needs?: string[];
  steps?: WorkflowStep[];
  uses?: string;
  with?: Record<string, string>;
};

type Workflow = {
  jobs?: Record<string, WorkflowJob | undefined>;
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
    // Exactly three, so a future non-publishing dependency cannot slip in and reintroduce the
    // bug from a direction the named exclusions below do not anticipate.
    expect(needs).toHaveLength(3);
    // Neither of these publishes anything for the released tag, and a skipped or failed
    // dependency skips this job, so either one gates Linear completion on unrelated work:
    // update-helm-app-version opens a follow-up PR against main and fails without its
    // credentials, and move-stable-tag is skipped by design for any stable release that is
    // not the latest - i.e. every patch on an older line.
    expect(needs).not.toContain("update-helm-app-version");
    expect(needs).not.toContain("move-stable-tag");
  });

  // The smoke job holds a pipeline-mutating Linear key, so it must only ever run main's copy of
  // itself. Any path that executes a branch's copy - a pull request, or a dispatch aimed at that
  // ref - would let whoever pushed it drop dry_run or add an exfiltration step.
  test("only ever runs the credentialed smoke dry-run from main", () => {
    const workflow = readWorkflow(linearSmokeWorkflow);
    const triggers = workflow.on ?? workflow.true;

    expect(triggers).not.toHaveProperty("pull_request");
    expect(triggers).not.toHaveProperty("pull_request_target");
    expect(triggers?.push?.branches).toEqual(["main"]);
    // Required, not incidental: dispatch is the only way to check the pipeline between release
    // flow changes, and dropping it would quietly remove that without failing anything else.
    expect(triggers).toHaveProperty("workflow_dispatch");
    // workflow_dispatch runs the file as it exists on the caller's chosen ref, so the trigger
    // list alone is not enough - the job itself has to refuse any ref but main.
    expect(workflow.jobs?.["linear-release-smoke"]?.if).toBe("github.ref == 'refs/heads/main'");
  });

  test("stamps the released version on Linear before completing the release", () => {
    const steps = linearSteps(readWorkflow(formbricksReleaseWorkflow), "linear-release-complete");

    expect(steps.map((step) => step.with?.version)).toEqual([releasedVersion, releasedVersion]);
    expect(steps.map((step) => step.with?.command)).toEqual([undefined, "complete"]);
  });

  test("can publish a chart patch without inventing a new application image", () => {
    const workflow = readWorkflow(helmReleaseWorkflow);
    const triggers = workflow.on ?? workflow.true;
    const reusableInputs = triggers?.workflow_call?.inputs;
    const manualInputs = triggers?.workflow_dispatch?.inputs;
    const updateStep = workflow.jobs?.publish?.steps?.find(
      (step) => step.name === "Update Chart.yaml with new version"
    );
    const imageStep = workflow.jobs?.publish?.steps?.find(
      (step) => step.name === "Validate default Formbricks image tag"
    );

    expect(reusableInputs?.VERSION?.required).toBe(true);
    expect(reusableInputs?.APP_VERSION?.required).toBe(true);
    expect(manualInputs?.VERSION?.required).toBe(true);
    expect(manualInputs?.APP_VERSION?.required).toBe(true);
    expect(updateStep?.run).toContain('yq -i ".version = \\"${VERSION}\\""');
    expect(updateStep?.run).toContain('yq -i ".appVersion = \\"${APP_VERSION}\\""');
    expect(imageStep?.run).toContain("formbricks/formbricks:${APP_VERSION}");

    expect(readWorkflow(formbricksReleaseWorkflow).jobs?.["helm-chart-release"]?.with).toMatchObject({
      APP_VERSION: releasedVersion,
      VERSION: releasedVersion,
    });
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

  // The cut workflow holds the same pipeline-mutating key as the smoke job, and unlike the smoke
  // job it runs on branches anyone with push access can create.
  test("only runs the release-cut sync on release branches and dispatches from main", () => {
    const workflow = readWorkflow(linearCutWorkflow);
    const triggers = workflow.on ?? workflow.true;

    expect(triggers).not.toHaveProperty("pull_request");
    expect(triggers).not.toHaveProperty("pull_request_target");
    expect(triggers?.push?.branches).toEqual(["release/**"]);
    expect(triggers).toHaveProperty("workflow_dispatch");
    expect(workflow.jobs?.["linear-release-cut"]?.if).toBe("github.event_name == 'push'");
    expect(workflow.jobs?.["linear-release-dispatch"]?.if).toBe(
      "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'"
    );
  });

  // release/6.0 ships as 6.0.0, 6.0.1, ...; a release called "6.0" is the minor-only record
  // ENG-2475 had to cancel. The branch name is also untrusted input to a credentialed job.
  test("derives the train from a strictly validated release branch name", () => {
    const derive = readWorkflow(linearCutWorkflow).jobs?.["linear-release-cut"]?.steps?.find(
      (step) => step.id === "train"
    );

    expect(derive?.run).toContain("^[0-9]+\\.[0-9]+$");
    expect(derive?.run).toContain("exit 1");
    // Stable tags only, so RC tags on the branch do not stop the stabilisation sync early.
    expect(derive?.run).toContain('\\.[0-9]+$"');
  });

  // Order matters: the outgoing train must be frozen before the next one is started, or the
  // unversioned main sync has two started releases to pick from. base_ref on the creating
  // sync is what keeps the frozen train's commits out of the new one.
  test("freezes the cut train, then creates and starts the next one, then syncs stabilisation", () => {
    const steps = linearSteps(readWorkflow(linearCutWorkflow), "linear-release-cut");
    const current = "${{ steps.train.outputs.current }}";
    const next = "${{ steps.train.outputs.next }}";

    expect(steps.map((step) => step.with?.command)).toEqual(["update", undefined, "update", undefined]);
    expect(steps.map((step) => step.with?.stage)).toEqual([
      "Code Freeze",
      undefined,
      "In Progress",
      undefined,
    ]);
    expect(steps.map((step) => step.with?.version)).toEqual([current, next, next, current]);
    expect(steps[1]?.with?.base_ref).toBe("${{ github.sha }}");
    expect(steps.slice(0, 3).map((step) => step.if)).toEqual(Array(3).fill("github.event.created"));
    expect(steps[3]?.if).toBe("${{ !github.event.created && steps.train.outputs.shipped == 'false' }}");
  });

  test("dry-runs the cut steps in the smoke canary and re-runs it when the cut workflow changes", () => {
    const workflow = readWorkflow(linearSmokeWorkflow);
    const steps = linearSteps(workflow, "linear-release-smoke");

    expect((workflow.on ?? workflow.true)?.push?.paths).toContain(linearCutWorkflow);
    expect(steps.map((step) => step.with?.dry_run)).toEqual(Array(steps.length).fill("true"));
    expect(steps.map((step) => step.with?.stage)).toContain("Code Freeze");
    expect(steps.map((step) => step.with?.base_ref)).toContain("${{ github.sha }}");
  });
});
