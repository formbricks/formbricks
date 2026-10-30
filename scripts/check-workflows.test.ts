import { describe, expect, test } from "vitest";
import { checkWorkflow } from "./check-workflows.mjs";

const hardenedJob = `
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: step-security/harden-runner@pinned-sha
      - run: pnpm lint
`;

describe("workflow conventions", () => {
  test("accepts explicit workflow or job permissions and a hardened runner", () => {
    expect(checkWorkflow(hardenedJob)).toEqual([]);
    expect(checkWorkflow(hardenedJob.replace("    runs-on:", "    permissions: {}\n    runs-on:"))).toEqual(
      []
    );
  });

  test("rejects missing permissions and broad permission shorthand", () => {
    expect(checkWorkflow(hardenedJob.replace("permissions:\n  contents: read\n", ""))).toEqual([
      expect.stringContaining("declare an explicit permissions map"),
    ]);
    expect(
      checkWorkflow(hardenedJob.replace("permissions:\n  contents: read", "permissions: write-all"))
    ).toContain("Workflow permissions must be an explicit map; enumerate required scopes.");
  });

  test.each(["workflow_call", "[workflow_call]", "\n  workflow_call:"])(
    "allows caller permissions for a workflow with only the workflow_call trigger: %s",
    (trigger) => {
      const workflow = `on: ${trigger}\n${hardenedJob.replace("permissions:\n  contents: read\n", "")}`;
      expect(checkWorkflow(workflow)).toEqual([]);
    }
  );

  test.each(["[workflow_call, push]", "\n  workflow_call:\n  workflow_dispatch:"])(
    "requires explicit permissions when a reusable workflow has another trigger: %s",
    (trigger) => {
      const workflow = `on: ${trigger}\n${hardenedJob.replace("permissions:\n  contents: read\n", "")}`;
      expect(checkWorkflow(workflow)).toEqual([
        expect.stringContaining("declare an explicit permissions map"),
      ]);
    }
  );

  test("still requires runner hardening in workflows that inherit caller permissions", () => {
    const workflow = `on: workflow_call\n${hardenedJob
      .replace("permissions:\n  contents: read\n", "")
      .replace("      - uses: step-security/harden-runner@pinned-sha\n", "")}`;
    expect(checkWorkflow(workflow)).toEqual([expect.stringContaining("first step")]);
  });

  test.each(["permissions: write-all\n", "jobs:\n  check:\n    permissions: write-all\n"])(
    "rejects explicit broad permissions in reusable workflows: %s",
    (permissions) => {
      const workflow = hardenedJob.replace("permissions:\n  contents: read\n", "");
      const source = permissions.startsWith("jobs:")
        ? workflow.replace("jobs:\n  check:\n", permissions)
        : permissions + workflow;
      expect(checkWorkflow(`on: workflow_call\n${source}`)).toContainEqual(
        expect.stringContaining("explicit permissions map")
      );
    }
  );

  test("rejects hardening after code execution", () => {
    const workflow = hardenedJob.replace(
      "      - uses: step-security/harden-runner@pinned-sha",
      "      - uses: actions/checkout@pinned-sha\n      - uses: step-security/harden-runner@pinned-sha"
    );
    expect(checkWorkflow(workflow)).toEqual([expect.stringContaining("first step")]);
  });

  test.each(["ubuntu-24.04", "ubuntu-24.04-arm"])("requires hardening on pinned runners: %s", (runner) => {
    const workflow = hardenedJob.replace("ubuntu-latest", runner);
    expect(checkWorkflow(workflow)).toEqual([]);
    expect(
      checkWorkflow(workflow.replace("      - uses: step-security/harden-runner@pinned-sha\n", ""))
    ).toEqual([expect.stringContaining("first step")]);
  });

  test.each(["if: false", "continue-on-error: true"])("rejects bypassed hardening: %s", (bypass) => {
    const workflow = hardenedJob.replace(
      "      - run: pnpm lint",
      `        ${bypass}\n      - run: pnpm lint`
    );
    expect(checkWorkflow(workflow)).toEqual([expect.stringContaining("unconditionally and fail on error")]);
  });

  test("checks runner label arrays", () => {
    expect(
      checkWorkflow(
        hardenedJob
          .replace("runs-on: ubuntu-latest", "runs-on: [ubuntu-latest]")
          .replace("      - uses: step-security/harden-runner@pinned-sha\n", "")
      )
    ).toEqual([expect.stringContaining("first step")]);
  });

  test.each(["ubuntu-latest", "[ubuntu-latest]"])("checks labels in runner group mappings: %s", (labels) => {
    const workflow = hardenedJob
      .replace("runs-on: ubuntu-latest", `runs-on:\n      group: hosted-runners\n      labels: ${labels}`)
      .replace("      - uses: step-security/harden-runner@pinned-sha\n", "");
    expect(checkWorkflow(workflow)).toEqual([expect.stringContaining("first step")]);
  });

  test("allows reusable jobs and other runners without imposing ubuntu hardening", () => {
    expect(
      checkWorkflow("permissions: {}\njobs:\n  test:\n    uses: ./.github/workflows/test.yml\n")
    ).toEqual([]);
    expect(
      checkWorkflow(
        hardenedJob
          .replace("ubuntu-latest", "macos-latest")
          .replace("      - uses: step-security/harden-runner@pinned-sha\n", "")
      )
    ).toEqual([]);
  });

  test("rejects documents without jobs", () => {
    expect(checkWorkflow("name: Broken")).toEqual(["Expected a workflow with a jobs map."]);
  });
});
