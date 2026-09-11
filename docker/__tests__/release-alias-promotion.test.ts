import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const script = join(repositoryRoot, "scripts/promote-release-image-aliases.sh");
const digest = `sha256:${"a".repeat(64)}`;
const temporaryDirectories: string[] = [];

const stableRelease = (tag: string) => ({ draft: false, prerelease: false, tag_name: tag });

type TAliasRunOptions = Readonly<{
  version: string;
  latestTag: string;
  releaseTags: ReadonlyArray<string>;
  apiHttpCode?: string;
  curlFails?: boolean;
  expectedDigest?: string;
  failInspectOnceTag?: string;
  latestPayload?: string;
  releaseTag?: string;
  releasesPayload?: string;
  wrongInspectTag?: string;
}>;

const createRunner = (options: TAliasRunOptions) => {
  const directory = mkdtempSync(join(tmpdir(), "formbricks-release-alias-"));
  temporaryDirectories.push(directory);
  const bin = join(directory, "bin");
  const output = join(directory, "output");
  const dockerLog = join(directory, "docker.log");
  const failInspectState = join(directory, "inspect-failed-once");
  mkdirSync(bin);

  const curl = join(bin, "curl");
  writeFileSync(
    curl,
    `#!/usr/bin/env bash
set -euo pipefail
[[ "$CURL_FAILS" != "true" ]] || exit 7
output=""
url=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    -H|-w) shift 2 ;;
    -sS) shift ;;
    *) url="$1"; shift ;;
  esac
done
if [[ "$url" == */releases/latest ]]; then
  printf '%s' "$LATEST_PAYLOAD" >"$output"
else
  printf '%s' "$RELEASES_PAYLOAD" >"$output"
fi
printf '%s' "$API_HTTP_CODE"
`
  );
  chmodSync(curl, 0o755);

  const docker = join(bin, "docker");
  writeFileSync(
    docker,
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$DOCKER_LOG"
if [[ "$*" == *"imagetools inspect"* ]]; then
  tag="$4"
  if [[ -n "$FAIL_INSPECT_ONCE_TAG" && "$tag" == "$FAIL_INSPECT_ONCE_TAG" && ! -e "$FAIL_INSPECT_STATE" ]]; then
    touch "$FAIL_INSPECT_STATE"
    printf '%s\n' '"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"'
  elif [[ -n "$WRONG_INSPECT_TAG" && "$tag" == "$WRONG_INSPECT_TAG" ]]; then
    printf '%s\n' '"sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"'
  else
    printf '"%s"\n' "$EXPECTED_DIGEST"
  fi
fi
`
  );
  chmodSync(docker, 0o755);

  return () => {
    writeFileSync(output, "");
    writeFileSync(dockerLog, "");
    const latestPayload = options.latestPayload ?? JSON.stringify({ tag_name: options.latestTag });
    const releasesPayload = options.releasesPayload ?? JSON.stringify(options.releaseTags.map(stableRelease));
    const result = spawnSync(script, [], {
      encoding: "utf8",
      env: {
        ...process.env,
        API_HTTP_CODE: options.apiHttpCode ?? "200",
        CURL_FAILS: String(options.curlFails ?? false),
        DOCKER_LOG: dockerLog,
        EXPECTED_DIGEST: options.expectedDigest ?? digest,
        FAIL_INSPECT_ONCE_TAG: options.failInspectOnceTag ?? "",
        FAIL_INSPECT_STATE: failInspectState,
        GH_TOKEN: "test-token",
        GITHUB_OUTPUT: output,
        IMAGE_NAME: "ghcr.io/formbricks/formbricks",
        KEEP_LATEST_ON_V5: "true",
        LATEST_PAYLOAD: latestPayload,
        PATH: `${bin}:${process.env.PATH}`,
        RELEASES_PAYLOAD: releasesPayload,
        RELEASE_TAG: options.releaseTag ?? options.version,
        REPO: "formbricks/formbricks",
        VERSION: options.version,
        WRONG_INSPECT_TAG: options.wrongInspectTag ?? "",
      },
    });

    const outputText = readFileSync(output, "utf8").trim();
    const outputs = Object.fromEntries(
      outputText === "" ? [] : outputText.split("\n").map((line) => line.split("=", 2))
    );
    return { commands: readFileSync(dockerLog, "utf8"), outputs, result };
  };
};

const run = (options: TAliasRunOptions) => createRunner(options)();

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("release image alias promotion", () => {
  test("promotes globally latest v6 stable and release-line aliases without moving latest", () => {
    const { commands, outputs, result } = run({
      latestTag: "6.0.0",
      releaseTags: ["6.0.0", "5.4.2"],
      version: "6.0.0",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(commands).toContain("--tag ghcr.io/formbricks/formbricks:stable");
    expect(commands).toContain("--tag ghcr.io/formbricks/formbricks:6");
    expect(commands).toContain("--tag ghcr.io/formbricks/formbricks:6.0");
    expect(commands).not.toContain("--tag ghcr.io/formbricks/formbricks:latest");
    expect(outputs).toMatchObject({ aliases_complete: "true", promoted: "true", source_stable: "true" });
  });

  test("advances newest v6 major and minor aliases when GitHub latest remains on v5", () => {
    const { commands, outputs, result } = run({
      latestTag: "5.4.2",
      releaseTags: ["6.0.1", "6.0.0", "5.4.2"],
      version: "6.0.1",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(commands).toContain("--tag ghcr.io/formbricks/formbricks:6");
    expect(commands).toContain("--tag ghcr.io/formbricks/formbricks:6.0");
    expect(commands).not.toContain("--tag ghcr.io/formbricks/formbricks:stable");
    expect(commands).not.toContain("--tag ghcr.io/formbricks/formbricks:latest");
    expect(outputs).toMatchObject({ aliases_complete: "true", promoted: "true", source_stable: "false" });
  });

  test("treats a superseded v6 run as a completed no-op", () => {
    const { commands, outputs, result } = run({
      latestTag: "6.0.1",
      releaseTags: ["6.0.1", "6.0.0"],
      version: "6.0.0",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(commands).toBe("");
    expect(outputs).toMatchObject({ aliases_complete: "true", promoted: "false", source_stable: "false" });
  });

  test("advances the supported v5 line after v6 becomes globally latest", () => {
    const { commands, outputs, result } = run({
      latestTag: "6.0.0",
      releaseTags: ["6.0.0", "5.4.3", "5.4.2"],
      version: "5.4.3",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(commands).toContain("--tag ghcr.io/formbricks/formbricks:5");
    expect(commands).toContain("--tag ghcr.io/formbricks/formbricks:5.4");
    expect(commands).toContain("--tag ghcr.io/formbricks/formbricks:latest");
    expect(commands).not.toContain("--tag ghcr.io/formbricks/formbricks:stable");
    expect(outputs).toMatchObject({ aliases_complete: "true", promoted: "true", source_stable: "false" });
  });

  test("does not regress aliases for a stale v5 patch", () => {
    const { commands, outputs, result } = run({
      latestTag: "6.0.0",
      releaseTags: ["6.0.0", "5.4.3", "5.4.2"],
      version: "5.4.2",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(commands).toBe("");
    expect(outputs).toMatchObject({ aliases_complete: "true", promoted: "false", source_stable: "false" });
  });

  test("updates only an older minor line without regressing major or latest", () => {
    const { commands, result } = run({
      latestTag: "6.0.0",
      releaseTags: ["6.0.0", "5.4.2", "5.3.3"],
      version: "5.3.3",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(commands).toContain("--tag ghcr.io/formbricks/formbricks:5.3");
    expect(commands).not.toContain("--tag ghcr.io/formbricks/formbricks:5 ");
    expect(commands).not.toContain("--tag ghcr.io/formbricks/formbricks:latest");
  });

  test("accepts a v-prefixed source release while using the normalized image version", () => {
    const { commands, outputs, result } = run({
      latestTag: "v6.0.0",
      releaseTag: "v6.0.0",
      releaseTags: ["v6.0.0", "v5.4.2"],
      version: "6.0.0",
    });

    expect(result.status, result.stderr).toBe(0);
    expect(commands).toContain("--tag ghcr.io/formbricks/formbricks:stable");
    expect(commands).toContain("--tag ghcr.io/formbricks/formbricks:6.0");
    expect(outputs).toMatchObject({ aliases_complete: "true", promoted: "true", source_stable: "true" });
  });

  test.each([
    ["GitHub transport failure", { curlFails: true }],
    ["GitHub API failure", { apiHttpCode: "500" }],
    ["invalid latest-release payload", { latestPayload: "{}" }],
    ["invalid release inventory", { releasesPayload: "{}" }],
    ["missing source release", { releaseTags: ["5.4.2"] }],
  ])("fails closed for %s", (_label, override) => {
    const { commands, outputs, result } = run({
      latestTag: "6.0.0",
      releaseTags: ["6.0.0"],
      version: "6.0.0",
      ...override,
    });

    expect(result.status).toBe(1);
    expect(commands).toBe("");
    expect(outputs).toMatchObject({ aliases_complete: "false", promoted: "false" });
  });

  test("rejects an invalid immutable source digest before querying release state", () => {
    const { commands, outputs, result } = run({
      expectedDigest: "sha256:not-a-digest",
      latestTag: "6.0.0",
      releaseTags: ["6.0.0"],
      version: "6.0.0",
    });

    expect(result.status).toBe(1);
    expect(commands).toBe("");
    expect(outputs).toMatchObject({ aliases_complete: "false", promoted: "false" });
  });

  test("fails closed when the release tag does not match the built image version", () => {
    const { commands, outputs, result } = run({
      latestTag: "v6.0.0",
      releaseTag: "v6.0.1",
      releaseTags: ["v6.0.0", "v6.0.1"],
      version: "6.0.0",
    });

    expect(result.status).toBe(1);
    expect(commands).toBe("");
    expect(outputs).toMatchObject({ aliases_complete: "false", promoted: "false" });
  });

  test("fails closed when any promoted alias does not resolve to the release digest", () => {
    const { outputs, result } = run({
      latestTag: "6.0.0",
      releaseTags: ["6.0.0"],
      version: "6.0.0",
      wrongInspectTag: "ghcr.io/formbricks/formbricks:6.0",
    });

    expect(result.status).toBe(1);
    expect(outputs).toMatchObject({ aliases_complete: "false", promoted: "false" });
  });

  test("idempotently completes a retry after the aliases were promoted but verification failed", () => {
    const invoke = createRunner({
      failInspectOnceTag: "ghcr.io/formbricks/formbricks:6.0",
      latestTag: "6.0.0",
      releaseTags: ["6.0.0"],
      version: "6.0.0",
    });

    const first = invoke();
    expect(first.result.status).toBe(1);
    expect(first.commands).toContain("imagetools create");
    expect(first.outputs).toMatchObject({ aliases_complete: "false", promoted: "false" });

    const retry = invoke();
    expect(retry.result.status, retry.result.stderr).toBe(0);
    expect(retry.commands).toContain("imagetools create");
    expect(retry.outputs).toMatchObject({ aliases_complete: "true", promoted: "true" });
  });
});
