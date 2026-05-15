import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const formbricksScriptPath = fileURLToPath(new URL("../../../docker/formbricks.sh", import.meta.url));
const rustfsInitTemplatePath = fileURLToPath(new URL("../../../docker/rustfs-init.sh", import.meta.url));

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const tempDir = mkdtempSync(join(tmpdir(), "formbricks-rustfs-init-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const writeMockMc = (tempDir: string): void => {
  const binDir = join(tempDir, "bin");
  mkdirSync(binDir, { recursive: true });

  const mockMcPath = join(binDir, "mc");
  writeFileSync(
    mockMcPath,
    `#!/bin/sh
set -eu

log_file="\${MC_LOG_FILE:?}"
capture_dir="\${MC_CAPTURE_DIR:?}"

printf '%s\\n' "$*" >> "$log_file"

if [ "$1" = "alias" ] && [ "$2" = "set" ] && [ "$3" = "rustfs" ]; then
  if [ "\${MC_ALIAS_SET_ALWAYS_FAIL:-0}" = "1" ]; then
    exit 1
  fi
  exit 0
fi

if [ "$1" = "ls" ] && [ "$2" = "rustfs" ]; then
  exit 0
fi

if [ "$1" = "mb" ] && [ "$2" = "rustfs/formbricks" ] && [ "$3" = "--ignore-existing" ]; then
  exit 0
fi

if [ "$1" = "cors" ] && [ "$2" = "set" ] && [ "$3" = "rustfs/formbricks" ]; then
  cp "$4" "$capture_dir/cors.xml"
  exit 0
fi

if [ "$1" = "admin" ] && [ "$2" = "policy" ] && [ "$3" = "info" ]; then
  exit 1
fi

if [ "$1" = "admin" ] && [ "$2" = "policy" ] && [ "$3" = "create" ]; then
  if [ "\${MC_POLICY_CREATE_FAIL:-0}" = "1" ]; then
    exit 1
  fi
  cp "$6" "$capture_dir/policy.json"
  exit 0
fi

if [ "$1" = "admin" ] && [ "$2" = "policy" ] && [ "$3" = "add" ]; then
  cp "$6" "$capture_dir/policy.json"
  exit 0
fi

if [ "$1" = "admin" ] && [ "$2" = "user" ] && [ "$3" = "info" ]; then
  exit 1
fi

if [ "$1" = "admin" ] && [ "$2" = "user" ] && [ "$3" = "add" ]; then
  exit 0
fi

if [ "$1" = "admin" ] && [ "$2" = "policy" ] && [ "$3" = "attach" ]; then
  exit 0
fi

printf 'unexpected mc invocation: %s\\n' "$*" >&2
exit 1
`
  );
  chmodSync(mockMcPath, 0o755);

  const mockSleepPath = join(binDir, "sleep");
  writeFileSync(
    mockSleepPath,
    `#!/bin/sh
exit 0
`
  );
  chmodSync(mockSleepPath, 0o755);
};

const writeRustfsInitScript = (targetPath: string): void => {
  execFileSync(
    "bash",
    ["-lc", 'source "$1"; write_rustfs_init_script "$2"', "bash", formbricksScriptPath, targetPath],
    { encoding: "utf8" }
  );
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
  rmSync("/tmp/formbricks-cors.xml", { force: true });
  rmSync("/tmp/formbricks-policy.json", { force: true });
});

describe("docker/formbricks.sh RustFS bootstrap", () => {
  test("generated init script stays in sync with the checked-in dev bootstrap script", () => {
    const tempDir = createTempDir();
    const generatedScriptPath = join(tempDir, "rustfs-init.sh");

    writeRustfsInitScript(generatedScriptPath);

    expect(readFileSync(generatedScriptPath, "utf8")).toBe(readFileSync(rustfsInitTemplatePath, "utf8"));
  });

  test("generated init script provisions a bucket-scoped policy for the service user", () => {
    const tempDir = createTempDir();
    const generatedScriptPath = join(tempDir, "rustfs-init.sh");
    const logFile = join(tempDir, "mc.log");
    const captureDir = join(tempDir, "capture");

    mkdirSync(captureDir, { recursive: true });
    writeMockMc(tempDir);
    writeRustfsInitScript(generatedScriptPath);

    execFileSync(generatedScriptPath, {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${join(tempDir, "bin")}:${process.env.PATH ?? ""}`,
        MC_LOG_FILE: logFile,
        MC_CAPTURE_DIR: captureDir,
        RUSTFS_ADMIN_USER: "admin-user",
        RUSTFS_ADMIN_PASSWORD: "admin-password",
        RUSTFS_SERVICE_USER: "service-user",
        RUSTFS_SERVICE_PASSWORD: "service-password",
        RUSTFS_BUCKET_NAME: "formbricks",
        RUSTFS_POLICY_NAME: "formbricks-app-policy",
        RUSTFS_CORS_ALLOWED_ORIGINS: "http://localhost:3000,http://127.0.0.1:3000",
      },
    });

    const mcCalls = readFileSync(logFile, "utf8").trim().split("\n");

    expect(mcCalls).toEqual([
      "alias set rustfs http://rustfs:9000 admin-user admin-password",
      "ls rustfs",
      "mb rustfs/formbricks --ignore-existing",
      "cors set rustfs/formbricks /tmp/formbricks-cors.xml",
      "admin policy info rustfs formbricks-app-policy",
      "admin policy create rustfs formbricks-app-policy /tmp/formbricks-policy.json",
      "admin user info rustfs service-user",
      "admin user add rustfs service-user service-password",
      "admin policy attach rustfs formbricks-app-policy --user service-user",
    ]);

    const policy = JSON.parse(readFileSync(join(captureDir, "policy.json"), "utf8")) as {
      Version: string;
      Statement: { Action: string[]; Effect: string; Resource: string[] }[];
    };

    expect(policy).toEqual({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["s3:DeleteObject", "s3:GetObject", "s3:PutObject"],
          Resource: ["arn:aws:s3:::formbricks/*"],
        },
        {
          Effect: "Allow",
          Action: ["s3:ListBucket"],
          Resource: ["arn:aws:s3:::formbricks"],
        },
      ],
    });

    expect(readFileSync(join(captureDir, "cors.xml"), "utf8")).toBe(`<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>http://localhost:3000</AllowedOrigin>
    <AllowedOrigin>http://127.0.0.1:3000</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedMethod>POST</AllowedMethod>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>DELETE</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
`);
  });

  test("generated init script falls back to policy add when policy create is unavailable", () => {
    const tempDir = createTempDir();
    const generatedScriptPath = join(tempDir, "rustfs-init.sh");
    const logFile = join(tempDir, "mc.log");
    const captureDir = join(tempDir, "capture");

    mkdirSync(captureDir, { recursive: true });
    writeMockMc(tempDir);
    writeRustfsInitScript(generatedScriptPath);

    execFileSync(generatedScriptPath, {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${join(tempDir, "bin")}:${process.env.PATH ?? ""}`,
        MC_LOG_FILE: logFile,
        MC_CAPTURE_DIR: captureDir,
        MC_POLICY_CREATE_FAIL: "1",
        RUSTFS_ADMIN_USER: "admin-user",
        RUSTFS_ADMIN_PASSWORD: "admin-password",
        RUSTFS_SERVICE_USER: "service-user",
        RUSTFS_SERVICE_PASSWORD: "service-password",
        RUSTFS_BUCKET_NAME: "formbricks",
        RUSTFS_POLICY_NAME: "formbricks-app-policy",
      },
    });

    const mcCalls = readFileSync(logFile, "utf8").trim().split("\n");

    expect(mcCalls).toContain("admin policy create rustfs formbricks-app-policy /tmp/formbricks-policy.json");
    expect(mcCalls).toContain("admin policy add rustfs formbricks-app-policy /tmp/formbricks-policy.json");
  });

  test("generated init script exits non-zero when RustFS never becomes ready", () => {
    const tempDir = createTempDir();
    const generatedScriptPath = join(tempDir, "rustfs-init.sh");
    const logFile = join(tempDir, "mc.log");
    const captureDir = join(tempDir, "capture");

    mkdirSync(captureDir, { recursive: true });
    writeMockMc(tempDir);
    writeRustfsInitScript(generatedScriptPath);

    expect(() =>
      execFileSync(generatedScriptPath, {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${join(tempDir, "bin")}:${process.env.PATH ?? ""}`,
          MC_LOG_FILE: logFile,
          MC_CAPTURE_DIR: captureDir,
          MC_ALIAS_SET_ALWAYS_FAIL: "1",
          RUSTFS_ADMIN_USER: "admin-user",
          RUSTFS_ADMIN_PASSWORD: "admin-password",
          RUSTFS_SERVICE_USER: "service-user",
          RUSTFS_SERVICE_PASSWORD: "service-password",
          RUSTFS_BUCKET_NAME: "formbricks",
          RUSTFS_POLICY_NAME: "formbricks-app-policy",
        },
      })
    ).toThrow();
  });
});
