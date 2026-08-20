import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const formbricksScriptPath = fileURLToPath(new URL("../formbricks.sh", import.meta.url));
const dockerComposeTemplatePath = fileURLToPath(new URL("../docker-compose.yml", import.meta.url));

const tempDirs: string[] = [];
const dockerComposeOverrideKeys = [
  "POSTGRES_PASSWORD",
  "POSTGRES_PASSWORD_URL_ENCODED",
  "HUB_DATABASE_URL",
  "CUBEJS_DB_PASS",
  "FORMBRICKS_UNSET_PASSWORD_SENTINEL",
];
const dockerComposeTestTimeout = 30_000;

const dockerComposeTest = (name: string, testFunction: () => void): void => {
  test(name, testFunction, dockerComposeTestTimeout);
};

type RenderedDockerComposeConfig = {
  services: Record<string, { environment?: Record<string, string> }>;
};

const createTempDir = (): string => {
  const tempDir = mkdtempSync(join(tmpdir(), "formbricks-script-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const addFormbricksTraefikLabels = (
  composePath: string,
  hstsEnabled: "y" | "n",
  httpsSetup: "y" | "n"
): void => {
  execFileSync(
    "bash",
    [
      "-lc",
      'source "$1"; add_formbricks_traefik_labels "$2" "example.com" "$3" "$4"',
      "bash",
      formbricksScriptPath,
      composePath,
      hstsEnabled,
      httpsSetup,
    ],
    { encoding: "utf8" }
  );
};

const writeDockerComposeTemplate = (): string => {
  const tempDir = createTempDir();
  const composePath = join(tempDir, "docker-compose.yml");

  writeFileSync(composePath, readFileSync(dockerComposeTemplatePath, "utf8"));

  return composePath;
};

const getDockerComposeProcessEnv = (overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => {
  const environment = { ...process.env };

  for (const key of dockerComposeOverrideKeys) {
    delete environment[key];
  }

  return { ...environment, ...overrides };
};

const runDockerCompose = (args: string[], environment: NodeJS.ProcessEnv = {}): string => {
  const result = spawnSync("docker", ["compose", ...args], {
    encoding: "utf8",
    env: getDockerComposeProcessEnv(environment),
    timeout: 20_000,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Docker Compose exited with status ${result.status}`);
  }

  return result.stdout;
};

const writeDockerComposeFixture = (envContents: string): { composePath: string; envPath: string } => {
  const composePath = writeDockerComposeTemplate();
  const envPath = join(dirname(composePath), ".env");

  writeFileSync(envPath, envContents);

  return { composePath, envPath };
};

const renderDockerCompose = (
  envContents: string,
  processEnvironment: NodeJS.ProcessEnv = {}
): RenderedDockerComposeConfig => {
  const { composePath, envPath } = writeDockerComposeFixture(envContents);

  return JSON.parse(
    runDockerCompose(
      [
        "--env-file",
        envPath,
        "-f",
        composePath,
        "--project-directory",
        dirname(composePath),
        "config",
        "--format",
        "json",
      ],
      processEnvironment
    )
  ) as RenderedDockerComposeConfig;
};

const getRenderedServiceEnvironment = (
  config: RenderedDockerComposeConfig,
  serviceName: string
): Record<string, string> => {
  const environment = config.services[serviceName]?.environment;

  expect(environment).toBeDefined();
  return environment ?? {};
};

const getRenderedDockerComposeEnvironment = (
  composePath: string,
  envPath: string,
  processEnvironment: NodeJS.ProcessEnv = {}
): string =>
  runDockerCompose(
    [
      "--env-file",
      envPath,
      "-f",
      composePath,
      "--project-directory",
      dirname(composePath),
      "config",
      "--environment",
    ],
    processEnvironment
  );

const writeGeneratedEnvFile = (envPath: string, postgresPassword = ""): void => {
  execFileSync(
    "bash",
    [
      "-lc",
      'source "$1"; write_generated_env_file "$2" "$3"',
      "bash",
      formbricksScriptPath,
      envPath,
      postgresPassword,
    ],
    { encoding: "utf8" }
  );
};

const readExistingPostgresPassword = (
  envPath: string,
  composePath: string,
  processEnvironment: NodeJS.ProcessEnv = {}
): string => {
  const result = spawnSync(
    "bash",
    [
      "-c",
      'source "$1"; read_existing_postgres_password "$2" "$3"',
      "bash",
      formbricksScriptPath,
      envPath,
      composePath,
    ],
    {
      encoding: "utf8",
      env: getDockerComposeProcessEnv(processEnvironment),
      timeout: 20_000,
    }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `Password discovery exited with status ${result.status}`);
  }

  return result.stdout;
};

const getDotenvValue = (envContents: string, key: string): string => {
  const value = envContents
    .split("\n")
    .find((line) => line.startsWith(`${key}=`))
    ?.slice(key.length + 1);

  expect(value).toBeDefined();
  return value ?? "";
};

const getServiceBlock = (composeContents: string, serviceName: string): string => {
  const lines = composeContents.split("\n");
  const startIndex = lines.findIndex((line) => line === `  ${serviceName}:`);

  expect(startIndex).toBeGreaterThanOrEqual(0);

  const endIndex = lines.findIndex((line, index) => index > startIndex && /^ {2}[A-Za-z0-9_-]+:/.test(line));

  return lines.slice(startIndex, endIndex === -1 ? undefined : endIndex).join("\n");
};

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("docker/docker-compose.yml Cube configuration", () => {
  test("disables external pre-aggregations by default while allowing an operator override", () => {
    const composeContents = readFileSync(dockerComposeTemplatePath, "utf8");
    const cubeBlock = getServiceBlock(composeContents, "cube");

    expect(cubeBlock).toContain("      CUBEJS_EXTERNAL_DEFAULT: ${CUBEJS_EXTERNAL_DEFAULT:-false}");
  });
});

describe("Docker self-hosting credentials", () => {
  dockerComposeTest("rejects a missing PostgreSQL password", () => {
    expect(() => renderDockerCompose("")).toThrow(/POSTGRES_PASSWORD.*missing a value/);
  });

  dockerComposeTest("renders a URL-safe PostgreSQL password into every bundled database client", () => {
    const password = "url-safe-password";
    const config = renderDockerCompose(`POSTGRES_PASSWORD=${password}\n`);
    const formbricksDatabaseUrl = `postgresql://postgres:${password}@postgres:5432/formbricks?schema=public`;
    const hubDatabaseUrl = `postgresql://postgres:${password}@postgres:5432/formbricks?sslmode=disable`;

    expect(getRenderedServiceEnvironment(config, "postgres").POSTGRES_PASSWORD).toBe(password);
    expect(getRenderedServiceEnvironment(config, "formbricks-migrate").DATABASE_URL).toBe(
      formbricksDatabaseUrl
    );
    expect(getRenderedServiceEnvironment(config, "formbricks").DATABASE_URL).toBe(formbricksDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "hub-migrate").DATABASE_URL).toBe(hubDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "hub").DATABASE_URL).toBe(hubDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "cube").CUBEJS_DB_PASS).toBe(password);
  });

  dockerComposeTest("renders encoded connection URLs while retaining the raw PostgreSQL password", () => {
    const rawPassword = "legacy:p@ss/word?#";
    const encodedPassword = "legacy%3Ap%40ss%2Fword%3F%23";
    const config = renderDockerCompose(
      `POSTGRES_PASSWORD=${rawPassword}\nPOSTGRES_PASSWORD_URL_ENCODED=${encodedPassword}\n`
    );
    const formbricksDatabaseUrl = `postgresql://postgres:${encodedPassword}@postgres:5432/formbricks?schema=public`;
    const hubDatabaseUrl = `postgresql://postgres:${encodedPassword}@postgres:5432/formbricks?sslmode=disable`;

    expect(getRenderedServiceEnvironment(config, "postgres").POSTGRES_PASSWORD).toBe(rawPassword);
    expect(getRenderedServiceEnvironment(config, "formbricks-migrate").DATABASE_URL).toBe(
      formbricksDatabaseUrl
    );
    expect(getRenderedServiceEnvironment(config, "formbricks").DATABASE_URL).toBe(formbricksDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "hub-migrate").DATABASE_URL).toBe(hubDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "hub").DATABASE_URL).toBe(hubDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "cube").CUBEJS_DB_PASS).toBe(rawPassword);
  });

  test("writes generated credentials to a private local environment file", () => {
    const tempDir = createTempDir();
    const envPath = join(tempDir, ".env");
    const secondEnvPath = join(tempDir, ".env.second");

    writeGeneratedEnvFile(envPath);
    writeGeneratedEnvFile(secondEnvPath);

    const envContents = readFileSync(envPath, "utf8");
    const secondEnvContents = readFileSync(secondEnvPath, "utf8");
    const serializedPostgresPassword = getDotenvValue(envContents, "POSTGRES_PASSWORD");
    const serializedSecondPostgresPassword = getDotenvValue(secondEnvContents, "POSTGRES_PASSWORD");
    const postgresPassword = serializedPostgresPassword.slice(1, -1);
    const secondPostgresPassword = serializedSecondPostgresPassword.slice(1, -1);

    expect(serializedPostgresPassword).toMatch(/^"[a-f0-9]{64}"$/);
    expect(serializedSecondPostgresPassword).toMatch(/^"[a-f0-9]{64}"$/);
    expect(envContents).toContain(`POSTGRES_PASSWORD_URL_ENCODED=${postgresPassword}`);
    expect(envContents).toMatch(/^HUB_API_KEY=[a-f0-9]{64}$/m);
    expect(envContents).toMatch(/^CUBEJS_API_SECRET=[a-f0-9]{64}$/m);
    expect(envContents).toContain(`
CUBEJS_JWT_ISSUER=formbricks-web
CUBEJS_JWT_AUDIENCE=formbricks-cube
`);
    expect(secondPostgresPassword).not.toBe(postgresPassword);
    expect(statSync(envPath).mode & 0o777).toBe(0o600);
    expect(statSync(secondEnvPath).mode & 0o777).toBe(0o600);
  });

  test("leaves the existing password empty when no deployment artifacts exist", () => {
    const tempDir = createTempDir();

    expect(readExistingPostgresPassword(join(tempDir, ".env"), join(tempDir, "docker-compose.yml"))).toBe("");
  });

  test("reuses sudo Docker Compose access selected by installer preflight", () => {
    const tempDir = createTempDir();
    const binPath = join(tempDir, "bin");
    const dockerPath = join(binPath, "docker");
    const sudoPath = join(binPath, "sudo");
    const callLogPath = join(tempDir, "docker-calls.log");
    const envPath = join(tempDir, ".env");
    const composePath = join(tempDir, "docker-compose.yml");

    mkdirSync(binPath);
    writeFileSync(envPath, "POSTGRES_PASSWORD=legacy-password\n");
    writeFileSync(composePath, "services:\n  postgres:\n    image: pgvector/pgvector:pg18\n");
    writeFileSync(
      dockerPath,
      `#!/bin/sh
printf 'docker %s\\n' "$*" >> "$FORMBRICKS_DOCKER_CALL_LOG"
exit 1
`
    );
    writeFileSync(
      sudoPath,
      `#!/bin/sh
printf 'sudo %s\\n' "$*" >> "$FORMBRICKS_DOCKER_CALL_LOG"
if [ "$1 $2" = "docker info" ]; then
  exit 0
fi
if [ "$1 $2 $3" = "docker compose version" ]; then
  exit 0
fi
if [ "$1 $2" = "docker compose" ]; then
  printf '%s' '{"services":{"postgres":{"environment":{"POSTGRES_PASSWORD":"legacy-password"}}}}'
  exit 0
fi
exit 1
`
    );
    chmodSync(dockerPath, 0o755);
    chmodSync(sudoPath, 0o755);

    const recoveredPassword = execFileSync(
      "bash",
      [
        "-c",
        'source "$1"; configure_formbricks_docker_command; run_formbricks_docker_compose version >/dev/null; read_existing_postgres_password "$2" "$3"',
        "bash",
        formbricksScriptPath,
        envPath,
        composePath,
      ],
      {
        encoding: "utf8",
        env: getDockerComposeProcessEnv({
          FORMBRICKS_DOCKER_CALL_LOG: callLogPath,
          PATH: `${binPath}:${process.env.PATH ?? ""}`,
        }),
      }
    );
    const callLog = readFileSync(callLogPath, "utf8");

    expect(recoveredPassword).toBe("legacy-password");
    expect(callLog).toContain("docker info");
    expect(callLog).toContain("sudo docker info");
    expect(callLog).toContain("sudo docker compose version");
    expect(callLog).toContain("sudo docker compose --env-file");
  });

  dockerComposeTest("preserves and URL-encodes the password from an existing one-click installation", () => {
    const tempDir = createTempDir();
    const envPath = join(tempDir, ".env");
    const composePath = join(tempDir, "docker-compose.yml");

    writeFileSync(
      composePath,
      `services:
  postgres:
    image: pgvector/pgvector:pg18
    environment:
      - POSTGRES_PASSWORD=legacy:p@ss/word?#
`
    );
    writeFileSync(envPath, "HUB_API_KEY=legacy-hub-key\nCUSTOM_SETTING=preserved\n");

    const existingPassword = readExistingPostgresPassword(envPath, composePath);
    writeGeneratedEnvFile(envPath, existingPassword);

    const envContents = readFileSync(envPath, "utf8");

    expect(existingPassword).toBe("legacy:p@ss/word?#");
    expect(envContents).toContain('POSTGRES_PASSWORD="legacy:p@ss/word?#"');
    expect(envContents).toContain("POSTGRES_PASSWORD_URL_ENCODED=legacy%3Ap%40ss%2Fword%3F%23");
    expect(envContents).toContain("CUSTOM_SETTING=preserved");
  });

  dockerComposeTest("uses Docker Compose semantics to resolve existing dotenv passwords", () => {
    const cases = [
      {
        envContents: "POSTGRES_PASSWORD: 'legacy$$value'\n",
        expectedPassword: "legacy$$value",
      },
      {
        envContents: 'POSTGRES_PASSWORD="legacy\\\\path"\n',
        expectedPassword: "legacy\\path",
      },
      {
        envContents: "POSTGRES_PASSWORD=legacy-password # operator note\n",
        expectedPassword: "legacy-password",
      },
      {
        envContents: "PASSWORD_SUFFIX=word\nPOSTGRES_PASSWORD=prefix-${PASSWORD_SUFFIX}\n",
        expectedPassword: "prefix-word",
      },
    ];

    for (const { envContents, expectedPassword } of cases) {
      const composePath = writeDockerComposeTemplate();
      const envPath = join(dirname(composePath), ".env");

      writeFileSync(envPath, envContents);

      expect(readExistingPostgresPassword(envPath, composePath)).toBe(expectedPassword);
    }
  });

  dockerComposeTest("reads legacy Compose passwords through the rendered configuration", () => {
    const tempDir = createTempDir();
    const envPath = join(tempDir, ".env");
    const composePath = join(tempDir, "docker-compose.yml");
    const missingComposePath = join(tempDir, "missing-compose.yml");
    const writeLegacyComposePassword = (passwordLine: string): void => {
      writeFileSync(
        composePath,
        `services:
  postgres:
    image: pgvector/pgvector:pg18
    environment:
      ${passwordLine}
`
      );
    };

    writeFileSync(envPath, "POSTGRES_PASSWORD='legacy-password'\n");
    expect(() => readExistingPostgresPassword(envPath, missingComposePath)).toThrow(
      /Could not safely resolve/
    );
    rmSync(envPath);

    writeLegacyComposePassword("- POSTGRES_PASSWORD=legacy:p@ss/word?#!&'()*;[]");
    expect(readExistingPostgresPassword(envPath, composePath)).toBe("legacy:p@ss/word?#!&'()*;[]");

    const quotedPassword = `legacy:p@ss/word?#!&'()*;[]\\path"quoted" `;
    writeLegacyComposePassword(`POSTGRES_PASSWORD: ${JSON.stringify(quotedPassword)}`);
    expect(readExistingPostgresPassword(envPath, composePath)).toBe(quotedPassword);

    writeLegacyComposePassword("- POSTGRES_PASSWORD=legacy$$PASSWORD_SENTINEL");
    expect(readExistingPostgresPassword(envPath, composePath)).toBe("legacy$PASSWORD_SENTINEL");

    writeLegacyComposePassword("- POSTGRES_PASSWORD=$FORMBRICKS_UNSET_PASSWORD_SENTINEL");
    const unresolvedConfig = JSON.parse(
      runDockerCompose([
        "-f",
        composePath,
        "--project-directory",
        dirname(composePath),
        "config",
        "--format",
        "json",
      ])
    ) as RenderedDockerComposeConfig;

    expect(getRenderedServiceEnvironment(unresolvedConfig, "postgres").POSTGRES_PASSWORD).toBe("");
    expect(() => readExistingPostgresPassword(envPath, composePath)).toThrow(/Could not safely resolve/);

    writeLegacyComposePassword("- POSTGRES_PASSWORD=legacy-password # operator note");
    expect(readExistingPostgresPassword(envPath, composePath)).toBe("legacy-password");

    writeLegacyComposePassword(`POSTGRES_PASSWORD: ${JSON.stringify("legacy\npassword")}`);
    expect(() => readExistingPostgresPassword(envPath, composePath)).toThrow(/Could not safely resolve/);
  });

  dockerComposeTest("preserves unrelated environment entries and literal dollar signs across reruns", () => {
    const composePath = writeDockerComposeTemplate();
    const envPath = join(dirname(composePath), ".env");
    const password = "legacy$PASSWORD_SENTINEL";

    writeFileSync(
      envPath,
      `# Operator-managed settings
PUBLIC_URL=https://surveys.example.com
CUSTOM_SECRET=keep-me
POSTGRES_PASSWORD='legacy$PASSWORD_SENTINEL'
export HUB_API_KEY=replace-me
`
    );

    const quotedExistingPassword = readExistingPostgresPassword(envPath, composePath, {
      PASSWORD_SENTINEL: "rewritten",
    });
    writeGeneratedEnvFile(envPath, quotedExistingPassword);

    const firstEnvContents = readFileSync(envPath, "utf8");
    const renderedEnvironment = getRenderedDockerComposeEnvironment(composePath, envPath, {
      PASSWORD_SENTINEL: "rewritten",
    });
    const renderedConfig = renderDockerCompose(firstEnvContents, {
      PASSWORD_SENTINEL: "rewritten",
    });
    const renderedPostgresPassword = getRenderedServiceEnvironment(
      renderedConfig,
      "postgres"
    ).POSTGRES_PASSWORD.replaceAll("$$", "$");
    const renderedCubePassword = getRenderedServiceEnvironment(
      renderedConfig,
      "cube"
    ).CUBEJS_DB_PASS.replaceAll("$$", "$");
    const encodedPassword = "legacy%24PASSWORD_SENTINEL";

    expect(quotedExistingPassword).toBe(password);
    expect(firstEnvContents).toContain("# Operator-managed settings");
    expect(firstEnvContents).toContain("PUBLIC_URL=https://surveys.example.com");
    expect(firstEnvContents).toContain("CUSTOM_SECRET=keep-me");
    expect(firstEnvContents).not.toContain("HUB_API_KEY=replace-me");
    expect(firstEnvContents).toContain('POSTGRES_PASSWORD="legacy$$PASSWORD_SENTINEL"');
    expect(firstEnvContents).toContain(`POSTGRES_PASSWORD_URL_ENCODED=${encodedPassword}`);
    expect(getDotenvValue(renderedEnvironment, "POSTGRES_PASSWORD")).toBe(password);
    expect(renderedPostgresPassword).toBe(password);
    expect(renderedCubePassword).toBe(password);
    expect(getRenderedServiceEnvironment(renderedConfig, "formbricks").DATABASE_URL).toBe(
      `postgresql://postgres:${encodedPassword}@postgres:5432/formbricks?schema=public`
    );
    expect(getRenderedServiceEnvironment(renderedConfig, "hub").DATABASE_URL).toBe(
      `postgresql://postgres:${encodedPassword}@postgres:5432/formbricks?sslmode=disable`
    );

    const existingPassword = readExistingPostgresPassword(envPath, composePath, {
      PASSWORD_SENTINEL: "rewritten",
    });
    writeGeneratedEnvFile(envPath, existingPassword);

    const rerunEnvContents = readFileSync(envPath, "utf8");

    expect(existingPassword).toBe(password);
    expect(rerunEnvContents).toContain("# Operator-managed settings");
    expect(rerunEnvContents).toContain("PUBLIC_URL=https://surveys.example.com");
    expect(rerunEnvContents).toContain("CUSTOM_SECRET=keep-me");
    expect(rerunEnvContents.match(/^POSTGRES_PASSWORD=/gm)).toHaveLength(1);
    expect(rerunEnvContents.match(/^HUB_API_KEY=/gm)).toHaveLength(1);
    expect(statSync(envPath).mode & 0o777).toBe(0o600);
  });

  dockerComposeTest("serializes preserved passwords without dotenv reinterpretation", () => {
    const composePath = writeDockerComposeTemplate();
    const envPath = join(dirname(composePath), ".env");
    const password = 'my secret #1 a\\\'b "quoted" $PASSWORD_SENTINEL ';
    const encodedPassword = "my%20secret%20%231%20a%5C%27b%20%22quoted%22%20%24PASSWORD_SENTINEL%20";

    writeGeneratedEnvFile(envPath, password);

    const firstEnvContents = readFileSync(envPath, "utf8");
    const firstReadPassword = readExistingPostgresPassword(envPath, composePath, {
      PASSWORD_SENTINEL: "rewritten",
    });

    expect(firstReadPassword).toBe(password);
    expect(getDotenvValue(firstEnvContents, "POSTGRES_PASSWORD")).toMatch(/^".*"$/);
    expect(getDotenvValue(firstEnvContents, "POSTGRES_PASSWORD_URL_ENCODED")).toBe(encodedPassword);

    writeGeneratedEnvFile(envPath, firstReadPassword);

    expect(
      readExistingPostgresPassword(envPath, composePath, {
        PASSWORD_SENTINEL: "rewritten",
      })
    ).toBe(password);
  });
});

describe("docker/formbricks.sh Traefik label injection", () => {
  test("adds HTTPS Traefik labels to the formbricks service only", () => {
    const composePath = writeDockerComposeTemplate();

    addFormbricksTraefikLabels(composePath, "y", "y");

    const composeContents = readFileSync(composePath, "utf8");
    const formbricksMigrateBlock = getServiceBlock(composeContents, "formbricks-migrate");
    const formbricksBlock = getServiceBlock(composeContents, "formbricks");

    expect(formbricksMigrateBlock).not.toContain("    labels:");
    expect(formbricksMigrateBlock).not.toContain("traefik.enable=true");
    expect(formbricksBlock).toContain("    labels:");
    expect(formbricksBlock.indexOf("    labels:")).toBeLessThan(formbricksBlock.indexOf("    environment:"));
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks.rule=Host(`example.com`)");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks.entrypoints=websecure");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks.tls.certresolver=default");
    expect(formbricksBlock).toContain("traefik.http.services.formbricks.loadbalancer.server.port=3000");
    expect(formbricksBlock).toContain(
      "traefik.http.routers.feedback-records-token.rule=Host(`example.com`) && Path(`/api/v3/feedbackRecords/token`)"
    );
    expect(formbricksBlock).toContain("traefik.http.routers.feedback-records-token.tls.certresolver=default");
    expect(formbricksBlock).toContain("traefik.http.middlewares.hstsHeader.headers.stsSeconds=31536000");
    expect(formbricksBlock).not.toContain("traefik.http.routers.formbricks_http.entrypoints=web");
  });

  test("omits ACME certresolver labels when HTTPS setup is disabled", () => {
    const composePath = writeDockerComposeTemplate();

    addFormbricksTraefikLabels(composePath, "y", "n");

    const composeContents = readFileSync(composePath, "utf8");
    const formbricksBlock = getServiceBlock(composeContents, "formbricks");

    expect(formbricksBlock).toContain("traefik.http.routers.formbricks.entrypoints=websecure");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks.tls=true");
    expect(formbricksBlock).toContain("traefik.http.routers.feedback-records-token.tls=true");
    expect(formbricksBlock).toContain("traefik.http.middlewares.hstsHeader.headers.stsSeconds=31536000");
    expect(formbricksBlock).not.toContain("tls.certresolver=default");
  });

  test("adds HTTP fallback labels when HSTS is disabled", () => {
    const composePath = writeDockerComposeTemplate();

    addFormbricksTraefikLabels(composePath, "n", "n");

    const composeContents = readFileSync(composePath, "utf8");
    const formbricksMigrateBlock = getServiceBlock(composeContents, "formbricks-migrate");
    const formbricksBlock = getServiceBlock(composeContents, "formbricks");

    expect(formbricksMigrateBlock).not.toContain("    labels:");
    expect(formbricksBlock).toContain("    labels:");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks_http.entrypoints=web");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks_http.rule=Host(`example.com`)");
    expect(formbricksBlock).toContain(
      "traefik.http.routers.feedback-records-token-http.rule=Host(`example.com`) && Path(`/api/v3/feedbackRecords/token`)"
    );
    expect(formbricksBlock).not.toContain("tls.certresolver=default");
    expect(formbricksBlock).not.toContain("traefik.http.middlewares.hstsHeader.headers.stsSeconds=31536000");
  });

  test("fails when the formbricks service insertion point is missing", () => {
    const tempDir = createTempDir();
    const composePath = join(tempDir, "docker-compose.yml");

    writeFileSync(
      composePath,
      `services:
  formbricks:
    image: ghcr.io/formbricks/formbricks:latest
`
    );

    expect(() => {
      addFormbricksTraefikLabels(composePath, "y", "y");
    }).toThrow();
    expect(existsSync(`${composePath}.tmp`)).toBe(false);
  });
});
