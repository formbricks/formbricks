import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

// Runs the real script with stand-in `yq` and `docker` executables first on the PATH: yq answers the
// pinned image reference, docker answers whether the manifest can be pulled. The docker stand-in also
// records the DOCKER_CONFIG directory it was given and what that directory held.

const script = fileURLToPath(new URL("./check-cube-image.sh", import.meta.url));
const image = "ghcr.io/formbricks/cube:9.9.9-1";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "check-cube-image-"));
  mkdirSync(join(workDir, "bin"));
  mkdirSync(join(workDir, "charts", "formbricks"), { recursive: true });
  writeFileSync(join(workDir, "charts", "formbricks", "values.yaml"), "cube: {}\n");
  writeFileSync(join(workDir, "bin", "yq"), `#!/bin/sh\necho '${image}'\n`);
  chmodSync(join(workDir, "bin", "yq"), 0o755);
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

const run = (dockerExitCode: number) => {
  writeFileSync(
    join(workDir, "bin", "docker"),
    [
      "#!/bin/sh",
      `echo "$@" > "${workDir}/docker-args"`,
      `echo "$DOCKER_CONFIG" > "${workDir}/docker-config-dir"`,
      `ls -A "$DOCKER_CONFIG" > "${workDir}/docker-config-listing"`,
      `exit ${dockerExitCode}`,
      "",
    ].join("\n")
  );
  chmodSync(join(workDir, "bin", "docker"), 0o755);

  return spawnSync("bash", [script], {
    cwd: workDir,
    encoding: "utf8",
    env: { PATH: `${join(workDir, "bin")}:${process.env.PATH}` },
  });
};

describe("check-cube-image.sh", () => {
  test("passes when the pinned image can be pulled, and inspects exactly that image", () => {
    const result = run(0);

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`${image} is publicly pullable.`);
    expect(readFileSync(join(workDir, "docker-args"), "utf8").trim()).toBe(`manifest inspect ${image}`);
  });

  test("fails with an error annotation naming the image when it cannot be pulled", () => {
    const result = run(1);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`::error::${image} cannot be pulled without credentials`);
    expect(result.stdout).not.toContain("publicly pullable");
  });

  test("inspects with an empty Docker config, so a stored login cannot hide a private package", () => {
    run(0);

    const configDir = readFileSync(join(workDir, "docker-config-dir"), "utf8").trim();
    expect(configDir).not.toBe("");
    expect(configDir).not.toContain(".docker");
    expect(readdirSync(workDir)).not.toContain("config.json");
    expect(readFileSync(join(workDir, "docker-config-listing"), "utf8").trim()).toBe("");
  });
});
