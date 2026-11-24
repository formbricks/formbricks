import yaml from "js-yaml";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, expect, test } from "vitest";

const repository = fileURLToPath(new URL("../", import.meta.url));
const directories: string[] = [];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "formbricks-ci-network-"));
  directories.push(directory);
  mkdirSync(join(directory, "bin"));
  // Only expose tools this harness needs, even when a developer has native zed installed.
  for (const tool of ["bash", "dirname", "touch", "cat", "tee", "python3", "cp", "mkdir"]) {
    const path = execFileSync("/bin/sh", ["-c", `command -v ${tool}`], { encoding: "utf8" }).trim();
    symlinkSync(path, join(directory, "bin", tool));
  }
  const env = {
    ...process.env,
    CI: "true",
    PATH: `${directory}/bin`,
    FIXTURE: directory,
    RUNNER_TEMP: directory,
  };
  const command = (name: string, body: string) =>
    writeFileSync(join(directory, "bin", name), `#!/usr/bin/env bash\nset -eu\n${body}\n`, { mode: 0o755 });
  command("sleep", ":");
  command("sudo", ": # Never change the host apt configuration in a test");
  // pnpm supplies the simulated timeout status; the harness also runs on stock macOS.
  command("timeout", 'while [[ "$1" == --* ]]; do shift; done; shift; exec "$@"');
  return { directory, env, command };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

test("E2E setup recovers from an apt timeout before installing the requested browsers", () => {
  const { directory, env, command } = fixture();
  command(
    "pnpm",
    `
printf '%s\\n' "$*" >> "$FIXTURE/commands"
if [[ "$*" == *install-deps* || "$*" == *--with-deps* ]]; then
  if [[ ! -e "$FIXTURE/apt-failed" ]]; then
    touch "$FIXTURE/apt-failed"
    echo 'apt mirror stalled' >&2
    exit 124
  fi
fi`
  );
  const workflow = yaml.load(readFileSync(join(repository, ".github/workflows/e2e.yml"), "utf8")) as {
    jobs: { build: { steps: { name?: string; run?: string; uses?: string }[] } };
  };
  const build = workflow.jobs.build.steps.find((step) => step.name?.startsWith("Build App"));
  if (!build?.run) throw new Error("Missing E2E build step");
  if (workflow.jobs.build.steps.some((step) => step.uses === "./.github/actions/stage-ci-network")) {
    const stage = yaml.load(
      readFileSync(join(repository, ".github/actions/stage-ci-network/action.yml"), "utf8")
    ) as { runs: { steps: { run: string }[] } };
    const staged = spawnSync("bash", ["-c", stage.runs.steps[0].run], {
      env: { ...env, GITHUB_ACTION_PATH: join(repository, ".github/actions/stage-ci-network") },
      encoding: "utf8",
    });
    expect(staged.status, staged.stderr).toBe(0);
  }
  // An older PR head need not contain either helper: the workflow uses its own staged revision.
  const result = spawnSync("bash", ["-c", build.run], { cwd: directory, env, encoding: "utf8" });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  const commands = readFileSync(join(directory, "commands"), "utf8");
  expect(commands).toContain("playwright install chromium firefox ffmpeg");
});

test("AuthZed schema validation retries image pulls before running validation once", () => {
  const { directory, env, command } = fixture();
  command(
    "docker",
    `
printf '%s\\n' "$*" >> "$FIXTURE/commands"
case "$1" in
  image) exit 1 ;;
  pull)
    if [[ ! -e "$FIXTURE/pull-failed" ]]; then
      touch "$FIXTURE/pull-failed"
      echo 'lookup auth.docker.io: temporary failure' >&2
      exit 1
    fi
    touch "$FIXTURE/pulled" ;;
  run) [[ -e "$FIXTURE/pulled" ]] ;;
esac`
  );
  const result = spawnSync("bash", [join(repository, "authzed/validate.sh")], {
    cwd: repository,
    env,
    encoding: "utf8",
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  const commands = readFileSync(join(directory, "commands"), "utf8").trim().split("\n");
  expect(commands.filter((line) => line.startsWith("pull "))).toHaveLength(2);
  expect(commands.filter((line) => line.startsWith("run "))).toHaveLength(1);
});

test("a persistent apt failure stops setup before any browser install", () => {
  const { directory, env, command } = fixture();
  command("pnpm", 'echo "$*" >> "$FIXTURE/commands"; exit 42');
  const result = spawnSync("bash", ["scripts/install-playwright-ci.sh", "chromium"], {
    cwd: repository,
    env,
    encoding: "utf8",
  });
  expect(result.status).toBe(42);
  expect(readFileSync(join(directory, "commands"), "utf8").trim().split("\n")).toEqual([
    "exec playwright install-deps chromium",
    "exec playwright install-deps chromium",
  ]);
});

test.each(["pull", "validation"])("a permanent %s failure remains red", (failure) => {
  const { directory, env, command } = fixture();
  command(
    "docker",
    `
echo "$1" >> "$FIXTURE/commands"
case "$1" in
  image) exit 1 ;;
  pull) ${failure === "pull" ? "exit 42" : ":"} ;;
  run) exit 43 ;;
esac`
  );
  const result = spawnSync("bash", ["authzed/validate.sh"], { cwd: repository, env, encoding: "utf8" });
  expect(result.status).toBe(failure === "pull" ? 42 : 43);
  const commands = readFileSync(join(directory, "commands"), "utf8").trim().split("\n");
  expect(commands.filter((line) => line === "pull")).toHaveLength(failure === "pull" ? 3 : 1);
  expect(commands.filter((line) => line === "run")).toHaveLength(failure === "pull" ? 0 : 1);
});

test("apt fallback rewrites Ubuntu mirrors in both source formats and preserves third-party sources", () => {
  const { directory, env, command } = fixture();
  command("sudo", 'exec "$@"');
  const apt = join(directory, "apt");
  mkdirSync(join(apt, "apt.conf.d"), { recursive: true });
  mkdirSync(join(apt, "sources.list.d"));
  writeFileSync(join(apt, "sources.list"), "deb http://us-east-2.ec2.archive.ubuntu.com/ubuntu noble main\n");
  const sources = join(apt, "sources.list.d/ubuntu.sources");
  writeFileSync(
    sources,
    "URIs: http://archive.ubuntu.com/ubuntu http://security.ubuntu.com/ubuntu\nSuites: noble noble-security\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n"
  );
  const thirdParty = join(apt, "sources.list.d/docker.list");
  writeFileSync(thirdParty, "deb https://download.docker.com/linux/ubuntu noble stable\n");
  const result = spawnSync(
    "bash",
    [
      "-c",
      'source scripts/ci-network.sh; ci_configure_apt "$1"; ci_use_fallback_apt_mirror "$1"',
      "test",
      apt,
    ],
    { cwd: repository, env, encoding: "utf8" }
  );
  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(join(apt, "sources.list"), "utf8")).toContain(
    "https://azure.archive.ubuntu.com/ubuntu noble main"
  );
  expect(readFileSync(sources, "utf8")).toBe(
    "URIs: https://azure.archive.ubuntu.com/ubuntu https://azure.archive.ubuntu.com/ubuntu\nSuites: noble noble-security\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n"
  );
  expect(readFileSync(thirdParty, "utf8")).toBe(
    "deb https://download.docker.com/linux/ubuntu noble stable\n"
  );
  expect(readFileSync(join(apt, "apt.conf.d/99formbricks-ci"), "utf8")).toContain(
    'APT::Update::Error-Mode "any";'
  );
});

test("artifact downloads recover from an HTTP 500", async () => {
  let requests = 0;
  const server = createServer((_request, response) => {
    response.writeHead(++requests === 1 ? 500 : 200);
    response.end(requests === 1 ? "unavailable" : "artifact");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server port");
    const result = await promisify(execFile)(
      "bash",
      ["-c", 'source scripts/ci-network.sh; ci_download "$1"', "test", `http://127.0.0.1:${address.port}`],
      { cwd: repository }
    );
    expect(result.stdout).toBe("artifact");
    expect(requests).toBe(2);
  } finally {
    server.close();
  }
}, 15_000);
