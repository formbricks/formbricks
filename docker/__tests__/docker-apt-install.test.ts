import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const scriptPath = fileURLToPath(new URL("../formbricks.sh", import.meta.url));
const tempDirs: string[] = [];

const createTempDir = (): string => {
  const tempDir = mkdtempSync(join(tmpdir(), "formbricks-docker-apt-"));
  tempDirs.push(tempDir);
  return tempDir;
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) rmSync(tempDir, { recursive: true, force: true });
});

const detectRepository = (osRelease: string | null) => {
  const osReleasePath = join(createTempDir(), "os-release");
  if (osRelease !== null) writeFileSync(osReleasePath, osRelease);

  return spawnSync(
    "bash",
    ["-c", 'source "$1"; detect_docker_apt_repository "$2"', "bash", scriptPath, osReleasePath],
    { encoding: "utf8" }
  );
};

const createAptFixture = () => {
  const tempDir = createTempDir();
  const binDir = join(tempDir, "bin");
  const sourcePath = join(tempDir, "docker.list");
  const keyPath = join(tempDir, "docker.gpg");
  const aptLogPath = join(tempDir, "apt.log");
  mkdirSync(binDir);
  writeFileSync(
    join(binDir, "curl"),
    `#!/bin/sh
if [ "\${CURL_FAIL:-0}" = 1 ]; then echo 'simulated key download failure' >&2; exit 22; fi
previous=''
for argument in "$@"; do
  if [ "$previous" = -o ]; then output="$argument"; fi
  previous="$argument"
done
printf 'test Docker key' > "$output"
`
  );
  writeFileSync(
    join(binDir, "gpg"),
    `#!/bin/sh
previous=''
for argument in "$@"; do
  if [ "$previous" = -o ]; then output="$argument"; fi
  input="$argument"
  previous="$argument"
done
cp "$input" "$output"
`
  );
  writeFileSync(
    join(binDir, "apt-get"),
    `#!/bin/sh
printf '%s\\n' "$*" >> "$APT_CALL_LOG"
if [ "\${APT_FAIL:-0}" = 1 ]; then echo 'simulated repository failure' >&2; exit 100; fi
if [ "\${APT_FAIL_PACKAGE:-0}" = 1 ]; then
  case "$*" in *docker-ce*) echo 'simulated Docker package failure' >&2; exit 100;; esac
fi
`
  );
  writeFileSync(join(binDir, "dpkg"), "#!/bin/sh\nprintf 'amd64\\n'\n");
  for (const name of ["curl", "gpg", "apt-get", "dpkg"]) chmodSync(join(binDir, name), 0o755);

  const run = (script: string, args: string[], overrides: NodeJS.ProcessEnv = {}) =>
    spawnSync(
      "bash",
      [
        "-c",
        `source "$1"
command() {
  if [[ "$1" == -v && "$2" == docker ]]; then
    if [[ -x "$DOCKER_TEST_BIN_DIR/docker" ]]; then
      printf '%s\\n' "$DOCKER_TEST_BIN_DIR/docker"
      return 0
    fi
    return 1
  fi
  builtin command "$@"
}
sudo() {
  if [[ "\${SUDO_FAIL_SOURCE:-0}" == 1 && "$1" == install && "$5" == *.list.formbricks.* ]]; then
    echo 'simulated source publication failure' >&2
    return 1
  fi
  "$@"
}
${script}`,
        "bash",
        scriptPath,
        ...args,
      ],
      {
        encoding: "utf8",
        input: "n\n",
        env: {
          ...process.env,
          PATH: `${binDir}:/usr/bin:/bin:/usr/sbin:/sbin`,
          DOCKER_TEST_BIN_DIR: binDir,
          APT_CALL_LOG: aptLogPath,
          ...overrides,
        },
      }
    );

  return { tempDir, binDir, sourcePath, keyPath, aptLogPath, run };
};

describe("docker/formbricks.sh Docker apt setup", () => {
  test.each([
    ["Debian 12", "ID=debian\nVERSION_CODENAME=bookworm\n", "debian bookworm"],
    ["Debian 13", "ID=debian\nVERSION_CODENAME=trixie\n", "debian trixie"],
    ["Ubuntu", "ID=ubuntu\nVERSION_CODENAME=noble\nUBUNTU_CODENAME=noble\n", "ubuntu noble"],
    ["Ubuntu fallback", "ID=ubuntu\nVERSION_CODENAME=jammy\n", "ubuntu jammy"],
  ])("selects the %s repository", (_name, osRelease, expected) => {
    const result = detectRepository(osRelease);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(expected);
  });

  test.each([
    ["Fedora", "ID=fedora\nVERSION_CODENAME=forty\n"],
    ["Ubuntu derivative", "ID=linuxmint\nID_LIKE=ubuntu\nUBUNTU_CODENAME=noble\n"],
    ["missing codename", "ID=debian\n"],
    ["invalid codename", "ID=debian\nVERSION_CODENAME='bookworm other'\n"],
    ["missing os-release", null],
  ])("rejects %s before repository setup", (_name, osRelease) => {
    const result = detectRepository(osRelease);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
  });

  test("publishes the selected repository and requires a strict apt update", () => {
    const { sourcePath, keyPath, aptLogPath, run } = createAptFixture();
    const result = run('setup_docker_apt_repository "$2" "$3" amd64 "$4" "$5"', [
      "debian",
      "trixie",
      sourcePath,
      keyPath,
    ]);

    expect(result.status).toBe(0);
    expect(readFileSync(sourcePath, "utf8")).toBe(
      `deb [arch=amd64 signed-by=${keyPath}] https://download.docker.com/linux/debian trixie stable\n`
    );
    expect(readFileSync(keyPath, "utf8")).toBe("test Docker key");
    expect(readFileSync(aptLogPath, "utf8")).toBe("-o APT::Update::Error-Mode=any update\n");
  });

  test("removes a new source and restores an existing key when apt update fails", () => {
    const { sourcePath, keyPath, run } = createAptFixture();
    writeFileSync(keyPath, "previous Docker key");
    const result = run('setup_docker_apt_repository debian bookworm amd64 "$2" "$3"', [sourcePath, keyPath], {
      APT_FAIL: "1",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("simulated repository failure");
    expect(existsSync(sourcePath)).toBe(false);
    expect(readFileSync(keyPath, "utf8")).toBe("previous Docker key");
  });

  test("restores an existing key when source publication fails", () => {
    const { sourcePath, keyPath, run } = createAptFixture();
    writeFileSync(keyPath, "previous Docker key");
    const result = run('setup_docker_apt_repository debian bookworm amd64 "$2" "$3"', [sourcePath, keyPath], {
      SUDO_FAIL_SOURCE: "1",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("simulated source publication failure");
    expect(existsSync(sourcePath)).toBe(false);
    expect(readFileSync(keyPath, "utf8")).toBe("previous Docker key");
  });

  test("does not overwrite a source created after the preflight check", () => {
    const { sourcePath, keyPath, run } = createAptFixture();
    writeFileSync(sourcePath, "deb https://example.com/docker bookworm stable\n");
    writeFileSync(keyPath, "previous Docker key");
    const result = run('setup_docker_apt_repository debian bookworm amd64 "$2" "$3"', [sourcePath, keyPath]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Could not publish the Docker apt source");
    expect(readFileSync(sourcePath, "utf8")).toBe("deb https://example.com/docker bookworm stable\n");
    expect(readFileSync(keyPath, "utf8")).toBe("previous Docker key");
  });

  test("leaves apt sources untouched when the Docker key download fails", () => {
    const { sourcePath, keyPath, run } = createAptFixture();
    const result = run('setup_docker_apt_repository ubuntu noble amd64 "$2" "$3"', [sourcePath, keyPath], {
      CURL_FAIL: "1",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("simulated key download failure");
    expect(existsSync(sourcePath)).toBe(false);
    expect(existsSync(keyPath)).toBe(false);
  });

  test("backs up the old Debian entry before apt and never restores that invalid source", () => {
    const { tempDir, sourcePath, keyPath, run } = createAptFixture();
    const legacySource = `deb [arch=amd64 signed-by=${keyPath}] https://download.docker.com/linux/ubuntu    bookworm stable\n`;
    writeFileSync(sourcePath, legacySource);
    const result = run(
      'quarantine_legacy_docker_apt_source debian bookworm amd64 "$2" "$3" "$4"; setup_docker_apt_repository debian bookworm amd64 "$2" "$3"',
      [sourcePath, keyPath, tempDir],
      { APT_FAIL: "1" }
    );

    expect(result.status).not.toBe(0);
    expect(existsSync(sourcePath)).toBe(false);
    expect(result.stderr).toContain("Disabled the old invalid Docker apt source");
    expect(readFileSync(result.stdout.trim().split("\n")[0], "utf8")).toBe(legacySource);
  });

  test("reuses a matching existing source and rejects an unfamiliar one", () => {
    const { sourcePath, keyPath, run } = createAptFixture();
    writeFileSync(
      sourcePath,
      `deb [arch=amd64 signed-by=${keyPath}] https://download.docker.com/linux/debian bookworm stable\n`
    );
    const matching = run('existing_docker_apt_source debian bookworm amd64 "$2" "$3"', [sourcePath, keyPath]);
    expect(matching.status).toBe(0);
    expect(matching.stdout.trim()).toBe("reuse");

    const unfamiliarSource = "deb https://example.com/docker bookworm stable\n";
    writeFileSync(sourcePath, unfamiliarSource);
    const unfamiliar = run('existing_docker_apt_source debian bookworm amd64 "$2" "$3"', [
      sourcePath,
      keyPath,
    ]);
    expect(unfamiliar.status).not.toBe(0);
    expect(readFileSync(sourcePath, "utf8")).toBe(unfamiliarSource);
  });

  test("reuses an enabled Docker deb822 source but rejects a disabled one", () => {
    const { sourcePath, keyPath, run } = createAptFixture();
    const modernSourcePath = sourcePath.replace(/\.list$/, ".sources");
    const source = `Types: deb\nURIs: https://download.docker.com/linux/debian\nSuites: bookworm\nComponents: stable\nSigned-By: ${keyPath}\n`;
    writeFileSync(modernSourcePath, source);

    const matching = run('existing_docker_apt_source debian bookworm amd64 "$2" "$3"', [sourcePath, keyPath]);
    expect(matching.status).toBe(0);
    expect(matching.stdout.trim()).toBe("reuse");

    writeFileSync(modernSourcePath, `${source}Enabled: no\n`);
    const disabled = run('existing_docker_apt_source debian bookworm amd64 "$2" "$3"', [sourcePath, keyPath]);
    expect(disabled.status).not.toBe(0);
    expect(readFileSync(modernSourcePath, "utf8")).toBe(`${source}Enabled: no\n`);
  });

  test("keeps an existing Docker binary and skips Docker repository and package setup", () => {
    const { tempDir, binDir, sourcePath, keyPath, aptLogPath, run } = createAptFixture();
    const osReleasePath = join(tempDir, "os-release");
    const legacySource = `deb [arch=amd64 signed-by=${keyPath}] https://download.docker.com/linux/ubuntu bookworm stable\n`;
    writeFileSync(osReleasePath, 'ID=debian\nVERSION_CODENAME=bookworm\nPRETTY_NAME="Debian GNU/Linux 12"\n');
    writeFileSync(sourcePath, legacySource);
    writeFileSync(join(binDir, "docker"), "#!/bin/sh\nexit 0\n");
    chmodSync(join(binDir, "docker"), 0o755);

    const result = run(
      `
existing_docker_apt_source() { echo 'unexpected repository inspection' >&2; return 1; }
configure_formbricks_docker_command() { return 1; }
install_formbricks "$2" "$3" "$4" "$5"
`,
      [osReleasePath, sourcePath, keyPath, tempDir]
    );

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("Docker is already installed");
    expect(result.stdout).toContain("Debian GNU/Linux 12");
    expect(result.stderr).not.toContain("unexpected repository inspection");
    expect(existsSync(sourcePath)).toBe(false);
    const backupPath = result.stderr.match(/backup: (.+)$/m)?.[1];
    expect(backupPath).toBeDefined();
    if (backupPath) expect(readFileSync(backupPath, "utf8")).toBe(legacySource);
    const aptLog = readFileSync(aptLogPath, "utf8");
    expect(aptLog).toContain("-o APT::Update::Error-Mode=any update");
    expect(aptLog).not.toContain("docker-ce");
    expect(aptLog).not.toContain("remove");
  });

  test("stops on the first strict apt update failure before installing packages", () => {
    const { tempDir, sourcePath, keyPath, aptLogPath, run } = createAptFixture();
    const osReleasePath = join(tempDir, "os-release");
    writeFileSync(osReleasePath, "ID=debian\nVERSION_CODENAME=bookworm\n");
    const result = run(
      'install_formbricks "$2" "$3" "$4" "$5"',
      [osReleasePath, sourcePath, keyPath, tempDir],
      {
        APT_FAIL: "1",
      }
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("simulated repository failure");
    expect(result.stderr).toContain("Could not update the host package list");
    expect(readFileSync(aptLogPath, "utf8")).toBe("-o APT::Update::Error-Mode=any update\n");
    expect(existsSync(sourcePath)).toBe(false);
    expect(existsSync(keyPath)).toBe(false);
  });

  test("keeps a validated Docker repository when package installation fails", () => {
    const { tempDir, sourcePath, keyPath, aptLogPath, run } = createAptFixture();
    const osReleasePath = join(tempDir, "os-release");
    writeFileSync(osReleasePath, "ID=debian\nVERSION_CODENAME=bookworm\n");
    const result = run(
      'install_formbricks "$2" "$3" "$4" "$5"',
      [osReleasePath, sourcePath, keyPath, tempDir],
      {
        APT_FAIL_PACKAGE: "1",
      }
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("simulated Docker package failure");
    expect(readFileSync(sourcePath, "utf8")).toContain("https://download.docker.com/linux/debian bookworm");
    expect(readFileSync(keyPath, "utf8")).toBe("test Docker key");
    const aptLog = readFileSync(aptLogPath, "utf8");
    expect(aptLog.match(/-o APT::Update::Error-Mode=any update/g)).toHaveLength(2);
    expect(aptLog).toContain("install -y docker-ce docker-ce-cli containerd.io");
  });
});
