import yaml from "js-yaml";
import { type ChildProcess, execFile, execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, expect, test } from "vitest";

const repository = fileURLToPath(new URL("../", import.meta.url));
const directories: string[] = [];
const holders: ChildProcess[] = [];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "formbricks-ci-network-"));
  directories.push(directory);
  mkdirSync(join(directory, "bin"));
  // Only expose tools this harness needs, even when a developer has native zed installed.
  for (const tool of [
    "bash",
    "dirname",
    "touch",
    "cat",
    "tee",
    "python3",
    "cp",
    "mkdir",
    "mktemp",
    "rm",
    "uname",
  ]) {
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
  for (const holder of holders.splice(0)) holder.kill();
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
  expect(commands.find((line) => line.startsWith("run "))).toContain("--pull never");
});

test("a cached AuthZed image runs validation without a registry pull", () => {
  const { directory, env, command } = fixture();
  command("docker", 'echo "$1" >> "$FIXTURE/commands"; [[ "$1" != pull ]]');
  const result = spawnSync("bash", ["authzed/validate.sh"], { cwd: repository, env, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(join(directory, "commands"), "utf8").trim().split("\n")).toEqual(["image", "run"]);
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

test("the apt fallback stops a stray apt-get and waits for the dpkg locks before touching dpkg", () => {
  // Playwright's apt-get runs under sudo, outside the process group `timeout` stops (ENG-7557).
  const { directory, env, command } = fixture();
  // Record what each sudo call does; the dpkg lock wait is recorded by its target, not its source.
  command(
    "sudo",
    `if [[ "$1 \${2-}" == "python3 -c" ]]; then echo "wait for the dpkg locks in \${!#}"; else echo "sudo $*"; fi >> "$FIXTURE/commands"`
  );
  command(
    "pnpm",
    `
echo "$*" >> "$FIXTURE/commands"
if [[ "$*" == *install-deps* && ! -e "$FIXTURE/apt-failed" ]]; then touch "$FIXTURE/apt-failed"; exit 124; fi`
  );
  const result = spawnSync("bash", ["scripts/install-playwright-ci.sh", "chromium"], {
    cwd: repository,
    env,
    encoding: "utf8",
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  const commands = readFileSync(join(directory, "commands"), "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("sudo tee") && !line.startsWith("sudo python3 - "));
  expect(commands).toEqual([
    "exec playwright install-deps chromium",
    "sudo pkill -TERM -f -- (^|[ /])apt-get( |$)",
    "wait for the dpkg locks in /var/lib/dpkg",
    "sudo dpkg --configure -a",
    "exec playwright install-deps chromium",
    "exec playwright install chromium",
  ]);
});

test.each([
  ["apt-get update", true],
  ["/usr/bin/apt-get install -y --no-install-recommends libnss3", true],
  ["sh -c apt-get update&& apt-get install -y --no-install-recommends libnss3", true],
  ["sudo -- sh -c apt-get update&& apt-get install -y libnss3", true],
  ["/usr/bin/dpkg --status-fd 35 --configure --pending", false],
  ["sudo pkill -TERM -f -- (^|[ /])apt-get( |$)", false],
  ["node playwright install-deps chromium", false],
])("the stray-apt pattern matches %j: %s", (commandLine, matches) => {
  // pkill -f matches the joined command line with POSIX extended regular expressions, as [[ =~ ]] does.
  const result = spawnSync(
    "bash",
    ["-c", 'source scripts/ci-network.sh; [[ "$1" =~ $CI_APT_PROCESS_PATTERN ]]', "bash", commandLine],
    { cwd: repository }
  );
  expect(result.status).toBe(matches ? 0 : 1);
});

// A fixture for ci_wait_for_dpkg_lock: sudo runs the command as the test user, against lock files in a
// temporary dpkg directory.
const lockWaitFixture = () => {
  const { directory, env, command } = fixture();
  command("sudo", 'exec "$@"');
  // A bounded run like GNU timeout's, for runners (and macOS) without one. The watchdog takes its
  // sleep down with it, so nothing outlives the test.
  command(
    "timeout",
    `while [[ "$1" == --* ]]; do shift; done; limit="\${1%s}"; shift
"$@" & pid=$!
( trap 'kill "$nap" 2>/dev/null; exit 0' TERM; /bin/sleep "$limit" & nap=$!; wait "$nap"; kill "$pid" 2>/dev/null ) &
watchdog=$!
status=0; wait "$pid" || status=$?
kill "$watchdog" 2>/dev/null || true
exit "$status"`
  );
  const dpkg = join(directory, "dpkg");
  mkdirSync(dpkg);
  for (const name of ["lock-frontend", "lock"]) writeFileSync(join(dpkg, name), "");
  return { env, dpkg };
};

// Hold one lock as apt or dpkg does (fcntl) for the given seconds, or until release() when none are
// given, and resolve once it is held.
const holdLock = async (path: string, seconds?: number) => {
  const holder = spawn(
    "python3",
    [
      "-c",
      "import fcntl, sys, time; f = open(sys.argv[1], 'a'); fcntl.lockf(f, fcntl.LOCK_EX); print('held', flush=True); time.sleep(float(sys.argv[2])) if sys.argv[2] else sys.stdin.read()",
      path,
      seconds === undefined ? "" : String(seconds),
    ],
    { stdio: ["pipe", "pipe", "inherit"] }
  );
  holders.push(holder);
  await new Promise<void>((resolve) => holder.stdout.once("data", () => resolve()));
  return { release: () => holder.stdin.end() };
};

// Whether another process could take this lock now, as a new apt-get would try first.
const lockIsFree = (path: string) =>
  spawnSync("python3", [
    "-c",
    "import fcntl, sys; fcntl.lockf(open(sys.argv[1], 'a'), fcntl.LOCK_EX | fcntl.LOCK_NB)",
    path,
  ]).status === 0;

const waitForLocks = (dpkg: string) => [
  "-c",
  'source scripts/ci-network.sh; ci_wait_for_dpkg_lock 3 "$1"',
  "test",
  dpkg,
];

test.each([
  ["waits for apt's lock-frontend to be released", "lock-frontend", 1, 0],
  ["waits for the lock a dpkg left running by a stopped apt-get still holds", "lock", 1, 0],
  ["fails when a dpkg lock is still held at the deadline", "lock", 30, 1],
])(
  "ci_wait_for_dpkg_lock %s",
  async (_name, lockName, holdSeconds, expectedStatus) => {
    const { env, dpkg } = lockWaitFixture();
    await holdLock(join(dpkg, lockName), holdSeconds);
    const started = Date.now();
    const result = spawnSync("bash", waitForLocks(dpkg), { cwd: repository, env, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(expectedStatus);
    if (expectedStatus === 0) expect(Date.now() - started).toBeGreaterThanOrEqual(500);
    else expect(result.stderr).toContain("were still held after 3s");
  },
  15_000
);

test("ci_wait_for_dpkg_lock keeps lock-frontend while it waits for lock, so no apt-get slips in between", async () => {
  const { env, dpkg } = lockWaitFixture();
  const lock = await holdLock(join(dpkg, "lock"));
  const waiting = spawn("bash", waitForLocks(dpkg), { cwd: repository, env, stdio: "ignore" });
  holders.push(waiting);
  const exited = new Promise<number | null>((resolve) => waiting.once("exit", resolve));
  // lock stays held until released below, so the wait is still running whenever lock-frontend is taken.
  const deadline = Date.now() + 2_500;
  while (lockIsFree(join(dpkg, "lock-frontend")) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  expect(lockIsFree(join(dpkg, "lock-frontend"))).toBe(false);
  lock.release();
  expect(await exited).toBe(0);
}, 15_000);

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

test.each(["direct", "mirror-file"])(
  "apt fallback handles %s Ubuntu sources and preserves third-party sources",
  (format) => {
    const { directory, env, command } = fixture();
    command("sudo", 'exec "$@"');
    const apt = join(directory, "apt");
    mkdirSync(join(apt, "apt.conf.d"), { recursive: true });
    mkdirSync(join(apt, "sources.list.d"));
    const mirrorUri = "mirror+file:/etc/apt/apt-mirrors.txt";
    const legacyUri = format === "direct" ? "http://us-east-2.ec2.archive.ubuntu.com/ubuntu" : mirrorUri;
    const uris =
      format === "direct"
        ? "http://archive.ubuntu.com/ubuntu http://security.ubuntu.com/ubuntu"
        : `${mirrorUri} ${mirrorUri}`;
    writeFileSync(join(apt, "sources.list"), `deb ${legacyUri} noble main\n`);
    const sources = join(apt, "sources.list.d/ubuntu.sources");
    writeFileSync(
      sources,
      `URIs: ${uris}\nSuites: noble noble-security\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n`
    );
    const thirdParty = join(apt, "sources.list.d/docker.list");
    const thirdPartyContents =
      "deb https://download.docker.com/linux/ubuntu noble stable\ndeb mirror+file:/etc/apt/vendor-mirrors.txt noble stable\n";
    writeFileSync(thirdParty, thirdPartyContents);
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
    expect(readFileSync(thirdParty, "utf8")).toBe(thirdPartyContents);
    expect(readFileSync(join(apt, "apt.conf.d/99formbricks-ci"), "utf8")).toContain(
      'APT::Update::Error-Mode "any";'
    );
    expect(readFileSync(join(apt, "apt.conf.d/99formbricks-ci"), "utf8")).toContain(
      'DPkg::Lock::Timeout "30";'
    );
  }
);

test("a kind download failure skips cluster diagnostics without an isolated kubeconfig", () => {
  const { directory, env, command } = fixture();
  writeFileSync(join(directory, "commands"), "");
  command("curl", "exit 22");
  command("helm", 'echo helm >> "$FIXTURE/commands"; exit 1');
  command("kubectl", 'echo kubectl >> "$FIXTURE/commands"; exit 1');
  const result = spawnSync("bash", ["charts/formbricks/tests/envoy-kind-integration.sh"], {
    cwd: repository,
    env,
    encoding: "utf8",
  });
  expect(result.status).toBe(22);
  expect(result.stderr).toContain("No isolated kind kubeconfig is available");
  expect(readFileSync(join(directory, "commands"), "utf8")).toBe("");
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
