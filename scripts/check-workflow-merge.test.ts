import yaml from "js-yaml";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const repository = fileURLToPath(new URL("../", import.meta.url));
const workflow = yaml.load(readFileSync(join(repository, ".github/workflows/lint.yml"), "utf8")) as {
  jobs: { build: { steps: { env?: Record<string, string>; run?: string }[] } };
};
const mergeCheck = workflow.jobs.build.steps.find((step) => step.env?.WORKFLOW_REF === "${{ github.sha }}");
const directories: string[] = [];
const validWorkflow = `permissions: {}
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: step-security/harden-runner@pinned-sha
`;
const gitIdentity = {
  ...process.env,
  GIT_AUTHOR_NAME: "Workflow test",
  GIT_AUTHOR_EMAIL: "workflow-test@example.com",
  GIT_COMMITTER_NAME: "Workflow test",
  GIT_COMMITTER_EMAIL: "workflow-test@example.com",
};

function git(directory: string, ...args: string[]) {
  return execFileSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", ...args], {
    cwd: directory,
    env: gitIdentity,
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
}

function createRepository() {
  const directory = mkdtempSync(join(tmpdir(), "formbricks-workflow-merge-"));
  directories.push(directory);
  mkdirSync(join(directory, "scripts"));
  mkdirSync(join(directory, ".github/workflows"), { recursive: true });
  writeFileSync(
    join(directory, "scripts/check-workflows.mjs"),
    readFileSync(join(repository, "scripts/check-workflows.mjs"))
  );
  writeFileSync(join(directory, ".github/workflows/check.yml"), validWorkflow);
  writeFileSync(join(directory, ".gitignore"), "node_modules/\n");
  symlinkSync(join(repository, "node_modules"), join(directory, "node_modules"), "dir");
  git(directory, "init", "--quiet");
  git(directory, "add", ".");
  git(directory, "commit", "--quiet", "-m", "Valid branch head");
  return directory;
}

function runMergeCheck(directory: string, ref: string) {
  if (!mergeCheck?.run) throw new Error("Lint workflow must check the event commit");
  return spawnSync("bash", ["-c", mergeCheck.run], {
    cwd: directory,
    env: { ...process.env, GITHUB_WORKSPACE: directory, WORKFLOW_REF: ref },
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("lint workflow merge validation", () => {
  test("rejects invalid workflows in the event commit even when the checked-out head passes", () => {
    const directory = createRepository();
    const head = git(directory, "rev-parse", "HEAD");
    writeFileSync(
      join(directory, ".github/workflows/check.yml"),
      validWorkflow.replace("permissions: {}\n", "")
    );
    git(directory, "commit", "--quiet", "-am", "Invalid merged workflow");
    const merge = git(directory, "rev-parse", "HEAD");
    git(directory, "checkout", "--quiet", "--detach", head);

    expect(runMergeCheck(directory, head).status).toBe(0);
    const result = runMergeCheck(directory, merge);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("declare an explicit permissions map");
    expect(git(directory, "rev-parse", "HEAD")).toBe(head);
    expect(git(directory, "status", "--porcelain")).toBe("");
  });

  test("fails and removes its snapshot when the event commit is unavailable", () => {
    const directory = createRepository();
    const result = runMergeCheck(directory, "missing-event-commit");
    expect(result.status).not.toBe(0);
    expect(readdirSync(directory).filter((name) => name.startsWith(".workflow-check."))).toEqual([]);
  });
});
