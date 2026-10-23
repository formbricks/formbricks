import { load } from "js-yaml";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
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
const legacyValkeyImage =
  "valkey/valkey@sha256:12ba4f45a7c3e1d0f076acd616cb230834e75a77e8516dde382720af32832d6d";
const multiArchValkeyImage =
  "valkey/valkey@sha256:e0eb7c480958d32bdc4357a74bdd70653ae15f2f9b4c93c4a5a9fad1dc471c84";

const tempDirs: string[] = [];
const dockerComposeOverrideKeys = [
  "POSTGRES_PASSWORD",
  "POSTGRES_PASSWORD_URL_ENCODED",
  "HUB_DATABASE_URL",
  "HUB_IMAGE_REF",
  "TAXONOMY_SERVICE_URL",
  "TAXONOMY_SERVICE_TOKEN",
  "HUB_INTERNAL_API_TOKEN",
  "CUBEJS_DB_PASS",
  "AUTHZED_TOKEN",
  "AUTHZED_DATABASE_PASSWORD",
  "FORMBRICKS_UNSET_PASSWORD_SENTINEL",
];
const dockerComposeTestTimeout = 30_000;
// Runs update_formbricks as on a host without IPv6, so its commands do not depend on the machine running the test.
// The IPv6 network step has its own tests (ENG-3897).
const updateFormbricksWithoutIpv6 = 'source "$1"; host_has_ipv6() { return 1; }; update_formbricks';

const dockerComposeTest = (name: string, testFunction: () => void): void => {
  test(name, testFunction, dockerComposeTestTimeout);
};

type RenderedDockerComposeConfig = {
  services: Record<
    string,
    {
      depends_on?: Record<string, { condition?: string }>;
      entrypoint?: string[];
      environment?: Record<string, string>;
      healthcheck?: { disable?: boolean };
      image?: string;
      ports?: unknown[];
      restart?: string;
    }
  >;
};

const createTempDir = (): string => {
  const tempDir = mkdtempSync(join(tmpdir(), "formbricks-script-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const parseEnvFile = (contents: string): Map<string, string> =>
  new Map(
    contents
      .trim()
      .split("\n")
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      })
  );

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

const withRequiredComposeEnv = (envContents: string): string => {
  const requiredValues = [
    ["AUTHZED_TOKEN", "test-authzed-token"],
    ["AUTHZED_DATABASE_PASSWORD", "test-authzed-database-password"],
  ];
  const missingValues = requiredValues
    .filter(([key]) => !new RegExp(`^${key}=`, "m").test(envContents))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  return [envContents.trimEnd(), missingValues].filter(Boolean).join("\n") + "\n";
};

const writeDockerComposeFixture = (envContents: string): { composePath: string; envPath: string } => {
  const composePath = writeDockerComposeTemplate();
  const envPath = join(dirname(composePath), ".env");

  writeFileSync(envPath, withRequiredComposeEnv(envContents));

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
        "--profile",
        "authzed-ops",
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

const migrateLegacyValkeyImage = (composePath: string, validationResult: "success" | "failure"): string => {
  const validationLogPath = join(createTempDir(), "validation.log");

  execFileSync(
    "bash",
    [
      "-lc",
      `source "$1"
sudo() {
  printf '[%s] %s\\n' "$PWD" "$*" >> "$VALIDATION_LOG_PATH"
  [[ "$VALIDATION_RESULT" == "success" ]]
}
migrate_legacy_valkey_image "$2"`,
      "bash",
      formbricksScriptPath,
      composePath,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        VALIDATION_LOG_PATH: validationLogPath,
        VALIDATION_RESULT: validationResult,
      },
    }
  );

  return validationLogPath;
};

// What `docker compose config --format json formbricks` prints for the formbricks service's port bindings.
const renderFormbricksPorts = (...ports: Record<string, unknown>[]): string =>
  `${JSON.stringify({ services: { formbricks: { ports } } }, null, 2)}\n`;
const loopbackPort = {
  mode: "ingress",
  host_ip: "127.0.0.1",
  target: 3000,
  published: "3000",
  protocol: "tcp",
};
const everyInterfacePort = { mode: "ingress", target: 3000, published: "3000", protocol: "tcp" };

const bindFormbricksPortToLoopback = (
  composePath: string,
  mode: "install" | "update",
  validationResult: "success" | "failure" = "success"
): string => {
  const validationLogPath = join(createTempDir(), "validation.log");

  execFileSync(
    "bash",
    [
      "-lc",
      `source "$1"
sudo() {
  printf '[%s] %s\\n' "$PWD" "$*" >> "$VALIDATION_LOG_PATH"
  [[ "$*" == *"--format json formbricks" ]] && printf '%s' "$RENDERED_JSON"
  [[ "$VALIDATION_RESULT" == "success" ]]
}
bind_formbricks_port_to_loopback "$2" "$3"`,
      "bash",
      formbricksScriptPath,
      composePath,
      mode === "update" ? "validate" : "",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        VALIDATION_LOG_PATH: validationLogPath,
        VALIDATION_RESULT: validationResult,
        RENDERED_JSON: renderFormbricksPorts(loopbackPort),
      },
    }
  );

  return validationLogPath;
};

const getPublishedPorts = (composeContents: string, serviceName: string): string[] =>
  (load(composeContents) as { services: Record<string, { ports?: string[] }> }).services[serviceName]
    ?.ports ?? [];

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

  test("every deployment runs the image docker/cube-image publishes, with no shell command", () => {
    const readRepoFile = (path: string) =>
      readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");
    const { dependencies } = JSON.parse(readRepoFile("docker/cube-image/package.json")) as {
      dependencies: Record<string, string>;
    };
    const cubeVersion = dependencies["@cubejs-backend/server"];
    const tag = `${cubeVersion}-${readRepoFile("docker/cube-image/REVISION").trim()}`;
    type TCubeService = { command?: unknown; image?: string };
    const compose = load(readFileSync(dockerComposeTemplatePath, "utf8")) as {
      services?: Record<string, TCubeService>;
    };
    const devCompose = load(readRepoFile("docker-compose.dev.yml")) as {
      services?: Record<string, TCubeService>;
    };
    const chartValues = load(readRepoFile("charts/formbricks/values.yaml")) as {
      cube?: { image?: { repository?: string; tag?: string } };
    };

    expect(compose.services?.cube?.image).toBe(`ghcr.io/formbricks/cube:${tag}`);
    expect(chartValues.cube?.image).toMatchObject({ repository: "ghcr.io/formbricks/cube", tag });
    // Dev mode needs the embedded Cube Store only upstream ships, so dev runs upstream at the same version.
    expect(devCompose.services?.cube?.image).toBe(`cubejs/cube:v${cubeVersion}`);
    // The image has no shell and its entrypoint is node, so a `sh -c` command fails with "Cannot find
    // module '/cube/conf/sh'". The image's own CMD starts Cube.
    expect(compose.services?.cube?.command).toBeUndefined();
  });
});

describe("docker/docker-compose.yml Hub worker configuration", () => {
  dockerComposeTest("runs the worker with the same image, database, and migration gate as Hub", () => {
    const config = renderDockerCompose("POSTGRES_PASSWORD=test-password\n");
    const hub = config.services.hub;
    const hubMigrate = config.services["hub-migrate"];
    const hubWorker = config.services["hub-worker"];

    expect(hubWorker, "the hub-worker service is missing from docker-compose.yml").toBeTypeOf("object");
    expect(hubWorker.image).toBe(hub.image);
    expect(hubWorker.image).toBe(hubMigrate.image);
    expect(hubWorker.entrypoint).toEqual(["/app/hub-worker"]);
    expect(hubWorker.restart).toBe("always");
    expect(hubWorker.ports ?? []).toEqual([]);
    expect(hubWorker.healthcheck).toEqual({ disable: true });
    expect(hubWorker.depends_on).toMatchObject({
      "hub-migrate": { condition: "service_completed_successfully" },
      postgres: { condition: "service_healthy" },
    });
    expect(hubWorker.depends_on).not.toHaveProperty("hub");
    expect(getRenderedServiceEnvironment(config, "hub-worker").DATABASE_URL).toBe(
      getRenderedServiceEnvironment(config, "hub").DATABASE_URL
    );
    expect(getRenderedServiceEnvironment(config, "hub-worker")).not.toHaveProperty("API_KEY");
  });

  dockerComposeTest("applies Hub image and database overrides to the API, migration, and worker", () => {
    const hubDatabaseUrl = "postgresql://hub:secret@database.example.com:5432/hub?sslmode=require";
    const config = renderDockerCompose(
      `POSTGRES_PASSWORD=test-password
HUB_DATABASE_URL=${hubDatabaseUrl}
HUB_IMAGE_REF=:0.8.5
TAXONOMY_SERVICE_URL=http://taxonomy:8000
TAXONOMY_SERVICE_TOKEN=test-taxonomy-token
HUB_INTERNAL_API_TOKEN=test-hub-internal-token
`
    );

    for (const serviceName of ["hub", "hub-migrate", "hub-worker"]) {
      expect(config.services[serviceName].image).toBe("ghcr.io/formbricks/hub:0.8.5");
      expect(getRenderedServiceEnvironment(config, serviceName).DATABASE_URL).toBe(hubDatabaseUrl);
    }

    const hubEnvironment = getRenderedServiceEnvironment(config, "hub");
    const workerEnvironment = getRenderedServiceEnvironment(config, "hub-worker");
    for (const variableName of ["TAXONOMY_SERVICE_URL", "TAXONOMY_SERVICE_TOKEN", "HUB_INTERNAL_API_TOKEN"]) {
      expect(workerEnvironment[variableName]).toBe(hubEnvironment[variableName]);
    }
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
    const postgresAdminUrl = `postgresql://postgres:${password}@postgres:5432/postgres?sslmode=disable`;

    expect(getRenderedServiceEnvironment(config, "postgres").POSTGRES_PASSWORD).toBe(password);
    expect(getRenderedServiceEnvironment(config, "authzed-db-bootstrap").POSTGRES_ADMIN_URL).toBe(
      postgresAdminUrl
    );
    expect(getRenderedServiceEnvironment(config, "formbricks-migrate").DATABASE_URL).toBe(
      formbricksDatabaseUrl
    );
    expect(getRenderedServiceEnvironment(config, "formbricks").DATABASE_URL).toBe(formbricksDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "authzed-ops").DATABASE_URL).toBe(formbricksDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "authzed-initialize").DATABASE_URL).toBe(
      formbricksDatabaseUrl
    );
    expect(getRenderedServiceEnvironment(config, "hub-migrate").DATABASE_URL).toBe(hubDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "hub").DATABASE_URL).toBe(hubDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "hub-worker").DATABASE_URL).toBe(hubDatabaseUrl);
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
    const postgresAdminUrl = `postgresql://postgres:${encodedPassword}@postgres:5432/postgres?sslmode=disable`;

    expect(getRenderedServiceEnvironment(config, "postgres").POSTGRES_PASSWORD).toBe(rawPassword);
    expect(getRenderedServiceEnvironment(config, "authzed-db-bootstrap").POSTGRES_ADMIN_URL).toBe(
      postgresAdminUrl
    );
    expect(getRenderedServiceEnvironment(config, "formbricks-migrate").DATABASE_URL).toBe(
      formbricksDatabaseUrl
    );
    expect(getRenderedServiceEnvironment(config, "formbricks").DATABASE_URL).toBe(formbricksDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "authzed-ops").DATABASE_URL).toBe(formbricksDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "authzed-initialize").DATABASE_URL).toBe(
      formbricksDatabaseUrl
    );
    expect(getRenderedServiceEnvironment(config, "hub-migrate").DATABASE_URL).toBe(hubDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "hub").DATABASE_URL).toBe(hubDatabaseUrl);
    expect(getRenderedServiceEnvironment(config, "hub-worker").DATABASE_URL).toBe(hubDatabaseUrl);
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
    expect(envContents).toMatch(/^AUTHZED_TOKEN=[a-f0-9]{64}$/m);
    expect(envContents).toMatch(/^AUTHZED_DATABASE_PASSWORD=[a-f0-9]{64}$/m);
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

      writeFileSync(envPath, withRequiredComposeEnv(envContents));

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
      withRequiredComposeEnv(`# Operator-managed settings
PUBLIC_URL=https://surveys.example.com
CUSTOM_SECRET=keep-me
POSTGRES_PASSWORD='legacy$PASSWORD_SENTINEL'
export HUB_API_KEY=replace-me
`)
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
    expect(firstEnvContents).toContain("AUTHZED_TOKEN=test-authzed-token");
    expect(firstEnvContents).toContain("AUTHZED_DATABASE_PASSWORD=test-authzed-database-password");
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
    expect(rerunEnvContents.match(/^AUTHZED_TOKEN=/gm)).toHaveLength(1);
    expect(rerunEnvContents.match(/^AUTHZED_DATABASE_PASSWORD=/gm)).toHaveLength(1);
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

describe("docker/formbricks.sh AuthZed setup", () => {
  test("writes AuthZed secrets without printing them", () => {
    const envPath = join(createTempDir(), ".env");
    const authzedToken = "authzed-token-value";
    const authzedDatabasePassword = "authzed-database-password";

    const output = execFileSync(
      "bash",
      [
        "-lc",
        'source "$1"; write_base_env_file "$2" hub-key cube-secret "$3" "$4"',
        "bash",
        formbricksScriptPath,
        envPath,
        authzedToken,
        authzedDatabasePassword,
      ],
      { encoding: "utf8" }
    );

    const env = parseEnvFile(readFileSync(envPath, "utf8"));

    expect(output).toBe("");
    expect(output).not.toContain(authzedToken);
    expect(output).not.toContain(authzedDatabasePassword);
    expect(env.get("AUTHZED_TOKEN")).toBe(authzedToken);
    expect(env.get("AUTHZED_DATABASE_PASSWORD")).toBe(authzedDatabasePassword);
    expect(env.get("AUTHZED_ENABLED")).toBe("true");
    expect(env.get("AUTHZED_CONSISTENCY")).toBe("fully_consistent");
    expect(env.get("FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED")).toBe("true");
    expect(statSync(envPath).mode & 0o777).toBe(0o600);
  });

  test("blocks customized updates until the AuthZed v6 contract is present and acknowledged", () => {
    const script = readFileSync(formbricksScriptPath, "utf8");
    const updateFunction = script.slice(
      script.indexOf("update_formbricks()"),
      script.indexOf("restart_formbricks()")
    );

    expect(updateFunction).toContain(
      "This installation does not yet contain the AuthZed v6 Compose services"
    );
    expect(updateFunction).toContain("FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED=true");
    expect(updateFunction).not.toContain("authzed-ops upgrade prepare");
    const migration = updateFunction.indexOf("run --rm --no-deps formbricks-migrate");
    expect(migration).toBeGreaterThan(updateFunction.indexOf("compose down"));
    expect(migration).toBeLessThan(updateFunction.lastIndexOf("compose up -d"));
    expect(updateFunction).toContain("authzed-ops upgrade check");
    expect(updateFunction.indexOf("upgrade check")).toBeLessThan(updateFunction.indexOf("compose down"));
  });

  test("warns and continues the update when the Hub worker is missing", () => {
    const tempDir = createTempDir();
    const installationDir = join(tempDir, "formbricks");
    const binDir = join(tempDir, "bin");
    const commandLog = join(tempDir, "commands.log");
    const composePath = join(installationDir, "docker-compose.yml");
    const composeContents = `services:
  authzed-ops:
  redis:
    image: ${legacyValkeyImage}
  spicedb:
`;
    mkdirSync(installationDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    writeFileSync(composePath, composeContents);
    writeFileSync(join(installationDir, ".env"), "FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED=true\n");
    writeFileSync(
      join(binDir, "sudo"),
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\ncase "$*" in *"config --services") printf "authzed-ops\\nspicedb\\n" ;; esac\n',
      { mode: 0o700 }
    );

    const result = spawnSync("bash", ["-c", updateFormbricksWithoutIpv6, "bash", formbricksScriptPath], {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        COMMAND_LOG: commandLog,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
    });

    // A minor release must not require the operator to change their Compose file first, so the update runs.
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("does not contain the Hub worker service");
    expect(result.stdout).toContain("/self-hosting/advanced/migration#hub-worker-for-docker");

    const commands = readFileSync(commandLog, "utf8");
    expect(commands).toContain("docker compose pull");
    expect(commands).toContain("run --rm --no-deps formbricks-migrate");
    // The file is rewritten only where documented — the Valkey pin — and the worker the warning is about is
    // not inserted: merging it stays the operator's decision.
    const rewritten = readFileSync(composePath, "utf8");
    expect(rewritten).toContain(multiArchValkeyImage);
    expect(readFileSync(`${composePath}.before-valkey-8.1.9`, "utf8")).toContain(legacyValkeyImage);
    expect(rewritten).not.toContain("hub-worker");
  });

  test("leaves the Compose file untouched when a later gate stops the update", () => {
    const tempDir = createTempDir();
    const installationDir = join(tempDir, "formbricks");
    const binDir = join(tempDir, "bin");
    const composePath = join(installationDir, "docker-compose.yml");
    // No hub-worker, so the warning path runs, and no AuthZed services, so the AuthZed gate stops the update.
    const composeContents = `services:
  redis:
    image: ${legacyValkeyImage}
`;
    mkdirSync(installationDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    writeFileSync(composePath, composeContents);
    writeFileSync(join(installationDir, ".env"), "FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED=true\n");
    writeFileSync(
      join(binDir, "sudo"),
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\ncase "$*" in *"config --services") printf "redis\\n" ;; esac\n',
      { mode: 0o700 }
    );

    const result = spawnSync("bash", ["-c", updateFormbricksWithoutIpv6, "bash", formbricksScriptPath], {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        COMMAND_LOG: join(tempDir, "commands.log"),
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("does not yet contain the AuthZed v6 Compose services");
    // That gate runs before the Valkey rewrite, so a stopped update leaves the file exactly as it was.
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
    expect(existsSync(`${composePath}.before-valkey-8.1.9`)).toBe(false);
  });

  test("blocks an update before pulling images when Compose cannot be rendered", () => {
    const tempDir = createTempDir();
    const installationDir = join(tempDir, "formbricks");
    const binDir = join(tempDir, "bin");
    const commandLog = join(tempDir, "commands.log");
    mkdirSync(installationDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(installationDir, "docker-compose.yml"), "services:\n  hub-worker:\n");
    writeFileSync(join(installationDir, ".env"), "FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED=true\n");
    writeFileSync(
      join(binDir, "sudo"),
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\ncase "$*" in *"config --services") exit 2 ;; esac\n',
      { mode: 0o700 }
    );

    const result = spawnSync("bash", ["-c", updateFormbricksWithoutIpv6, "bash", formbricksScriptPath], {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        COMMAND_LOG: commandLog,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not render docker-compose.yml");
    expect(readFileSync(commandLog, "utf8")).toBe("docker compose config --services\n");
  });

  test.each([
    { checkExitCode: 0, migrationExitCode: 0 },
    { checkExitCode: 2, migrationExitCode: 0 },
    { checkExitCode: 0, migrationExitCode: 1 },
  ])(
    "checks before stopping, migrates before starting, and stops on failure: %j",
    ({ checkExitCode, migrationExitCode }) => {
      const tempDir = createTempDir();
      const installationDir = join(tempDir, "formbricks");
      const binDir = join(tempDir, "bin");
      const commandLog = join(tempDir, "commands.log");
      mkdirSync(installationDir, { recursive: true });
      mkdirSync(binDir, { recursive: true });
      writeFileSync(
        join(installationDir, "docker-compose.yml"),
        "services:\n  authzed-ops:\n  hub-worker:\n  spicedb:\n"
      );
      writeFileSync(join(installationDir, ".env"), "FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED=true\n");
      writeFileSync(
        join(binDir, "sudo"),
        '#!/bin/sh\nprintf "%s\\n" "$*" >> "$COMMAND_LOG"\ncase "$*" in *"config --services") printf "authzed-ops\\nhub-worker\\nspicedb\\n" ;; *"upgrade check") exit "$CHECK_EXIT_CODE" ;; *"run --rm --no-deps formbricks-migrate") exit "$MIGRATION_EXIT_CODE" ;; esac\n',
        {
          mode: 0o700,
        }
      );

      const result = spawnSync("bash", ["-c", updateFormbricksWithoutIpv6, "bash", formbricksScriptPath], {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          CHECK_EXIT_CODE: String(checkExitCode),
          MIGRATION_EXIT_CODE: String(migrationExitCode),
          COMMAND_LOG: commandLog,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
        },
      });

      expect(result.status).toBe(checkExitCode || migrationExitCode);
      const commands = readFileSync(commandLog, "utf8").trim().split("\n");
      expect(commands).toEqual([
        "docker compose config --services",
        "docker compose pull",
        "docker compose --profile authzed-ops run --rm --no-deps authzed-ops upgrade check",
        ...(checkExitCode === 0
          ? [
              "docker version --format {{.Server.Version}}",
              "docker compose down",
              "docker compose up -d --wait postgres",
              "docker compose run --rm --no-deps formbricks-migrate",
              ...(migrationExitCode === 0 ? ["docker compose up -d"] : []),
            ]
          : []),
      ]);
    }
  );

  test("waits for the source migration before preparing a fresh AuthZed graph", () => {
    const script = readFileSync(formbricksScriptPath, "utf8");
    const setupStart = script.indexOf(
      "docker compose up -d postgres authzed-db-bootstrap spicedb-migrate spicedb formbricks-migrate"
    );
    const migrationWait = script.indexOf("docker compose wait formbricks-migrate", setupStart);
    const upgradePrepare = script.indexOf("authzed-ops upgrade prepare", setupStart);

    expect(setupStart).toBeGreaterThanOrEqual(0);
    expect(migrationWait).toBeGreaterThan(setupStart);
    expect(upgradePrepare).toBeGreaterThan(migrationWait);
  });

  test("pins and verifies the downloaded bootstrap helper before making it executable", () => {
    const script = readFileSync(formbricksScriptPath, "utf8");
    const downloadStart = script.indexOf(
      'authzed_bootstrap_commit="10d5ad908491a8a818aef3c6ada91fa4fdc30b03"'
    );
    const checksumStart = script.indexOf("sha256sum --check --status -", downloadStart);
    const chmodStart = script.indexOf("chmod 700 authzed-postgres-bootstrap.sh", checksumStart);

    expect(downloadStart).toBeGreaterThanOrEqual(0);
    expect(script.slice(downloadStart, checksumStart)).not.toContain(
      "formbricks/stable/docker/authzed-postgres-bootstrap.sh"
    );
    expect(script.slice(downloadStart, checksumStart)).toContain(
      "70975701cdf0dcffef5d3573a7514360e87428bb07cc4bfb4dbf47ae0c2e93a5"
    );
    expect(checksumStart).toBeGreaterThan(downloadStart);
    expect(chmodStart).toBeGreaterThan(checksumStart);
  });
});

describe("docker/docker-compose.yml Redis/Valkey exposure (ENG-2184)", () => {
  // The bundled Valkey is Better Auth's session/token store (secondaryStorage). Publishing it to
  // the host binds 0.0.0.0:6379 with no password, exposing every live session token — and Docker's
  // port rule bypasses host firewalls like ufw. The app reaches it over the internal compose
  // network (REDIS_URL=redis://redis:6379), so no host publish is needed. Assert on the *resolved*
  // compose model — js-yaml expands anchors and merge keys — so a port smuggled in via an alias or
  // a `<<` merge cannot slip past a raw-text check.
  test("the redis service publishes no host port", () => {
    const doc = load(readFileSync(dockerComposeTemplatePath, "utf8")) as {
      services?: Record<string, { ports?: unknown }>;
    };
    const redis = doc.services?.redis;

    expect(redis, "the redis service is missing from docker-compose.yml").toBeTypeOf("object");
    expect(
      redis?.ports ?? [],
      "the redis (Valkey) service must not publish any host port — it is reachable only on the internal compose network (ENG-2184)"
    ).toEqual([]);
  });
});

describe("docker/formbricks.sh Valkey image migration", () => {
  test("updates the known amd64-only pin and keeps a backup", () => {
    const composePath = writeDockerComposeTemplate();
    const originalCompose = readFileSync(composePath, "utf8");

    expect(originalCompose).toContain(multiArchValkeyImage);
    writeFileSync(composePath, originalCompose.replace(multiArchValkeyImage, legacyValkeyImage));
    chmodSync(composePath, 0o600);

    const validationLogPath = migrateLegacyValkeyImage(composePath, "success");

    expect(readFileSync(composePath, "utf8")).toBe(originalCompose);
    expect(readFileSync(`${composePath}.before-valkey-8.1.9`, "utf8")).toContain(legacyValkeyImage);
    expect(statSync(composePath).mode & 0o777).toBe(0o600);
    expect(statSync(`${composePath}.before-valkey-8.1.9`).mode & 0o777).toBe(0o600);
    expect(readFileSync(validationLogPath, "utf8")).toBe(`[${dirname(composePath)}] docker compose config\n`);
  });

  test("updates the live redis service when Compose uses four-space indentation", () => {
    const tempDir = createTempDir();
    const composePath = join(tempDir, "docker-compose.yml");
    writeFileSync(
      composePath,
      `services:
    redis:
        image: ${legacyValkeyImage}
        volumes:
            - redis:/data

volumes:
    redis:
`
    );

    const validationLogPath = migrateLegacyValkeyImage(composePath, "success");

    expect(readFileSync(composePath, "utf8")).toContain(multiArchValkeyImage);
    expect(readFileSync(`${composePath}.before-valkey-8.1.9`, "utf8")).toContain(legacyValkeyImage);
    expect(readFileSync(validationLogPath, "utf8")).toBe(`[${dirname(composePath)}] docker compose config\n`);
  });

  test.each([multiArchValkeyImage, "example.com/custom-valkey@sha256:custom"])(
    "leaves the %s reference untouched",
    (image) => {
      const composePath = writeDockerComposeTemplate();
      const originalCompose = readFileSync(composePath, "utf8").replace(multiArchValkeyImage, image);
      writeFileSync(composePath, originalCompose);

      migrateLegacyValkeyImage(composePath, "failure");

      expect(readFileSync(composePath, "utf8")).toBe(originalCompose);
      expect(existsSync(`${composePath}.before-valkey-8.1.9`)).toBe(false);
    }
  );

  test("restores the original Compose file when validation fails", () => {
    const composePath = writeDockerComposeTemplate();
    const legacyCompose = readFileSync(composePath, "utf8").replace(multiArchValkeyImage, legacyValkeyImage);
    writeFileSync(composePath, legacyCompose);

    expect(() => migrateLegacyValkeyImage(composePath, "failure")).toThrow();

    expect(readFileSync(composePath, "utf8")).toBe(legacyCompose);
    expect(readFileSync(`${composePath}.before-valkey-8.1.9`, "utf8")).toBe(legacyCompose);
    expect(existsSync(`${composePath}.tmp`)).toBe(false);
  });
});

describe("docker/formbricks.sh loopback-only app port (ENG-3983)", () => {
  test("binds the formbricks service's published port to loopback and leaves the rest of the file alone", () => {
    const composePath = writeDockerComposeTemplate();
    const originalCompose = readFileSync(composePath, "utf8");
    expect(getPublishedPorts(originalCompose, "formbricks")).toEqual(["3000:3000"]);

    bindFormbricksPortToLoopback(composePath, "install");

    const updatedCompose = readFileSync(composePath, "utf8");
    expect(getPublishedPorts(updatedCompose, "formbricks")).toEqual(["127.0.0.1:3000:3000"]);
    expect(updatedCompose).toContain('      - "127.0.0.1:3000:3000"\n');
    expect(updatedCompose.replace('"127.0.0.1:3000:3000"', "3000:3000")).toBe(originalCompose);
    expect(existsSync(`${composePath}.before-loopback-port`)).toBe(false);
  });

  test.each([
    ['"3000:3000"', '"127.0.0.1:3000:3000"'],
    ["'3000:3000'", "'127.0.0.1:3000:3000'"],
    ["3000:3000/tcp", '"127.0.0.1:3000:3000/tcp"'],
  ])("rewrites %s, quoted as Compose recommends", (mapping, expected) => {
    const composePath = writeDockerComposeTemplate();
    writeFileSync(composePath, readFileSync(composePath, "utf8").replace("- 3000:3000", `- ${mapping}`));

    bindFormbricksPortToLoopback(composePath, "install");

    expect(readFileSync(composePath, "utf8")).toContain(`      - ${expected}\n`);
  });

  test.each(["127.0.0.1:3000:3000", "0.0.0.0:3000:3000", "8080:3000", "10.0.0.5:3000:3000"])(
    "leaves an operator's %s mapping untouched",
    (mapping) => {
      const composePath = writeDockerComposeTemplate();
      const customCompose = readFileSync(composePath, "utf8").replace("- 3000:3000", `- ${mapping}`);
      writeFileSync(composePath, customCompose);

      const validationLogPath = bindFormbricksPortToLoopback(composePath, "update");

      expect(readFileSync(composePath, "utf8")).toBe(customCompose);
      expect(existsSync(`${composePath}.before-loopback-port`)).toBe(false);
      expect(existsSync(validationLogPath)).toBe(false);
    }
  );

  test("only touches the formbricks service, with any indentation", () => {
    const tempDir = createTempDir();
    const composePath = join(tempDir, "docker-compose.yml");
    writeFileSync(
      composePath,
      `services:
    other:
        image: example
        ports:
            - 3000:3000
    formbricks:
        image: ghcr.io/formbricks/formbricks:latest
        ports:
            - 3000:3000
        environment:
            WEBAPP_URL: http://localhost:3000
`
    );

    bindFormbricksPortToLoopback(composePath, "install");

    const updatedCompose = readFileSync(composePath, "utf8");
    expect(getPublishedPorts(updatedCompose, "formbricks")).toEqual(["127.0.0.1:3000:3000"]);
    expect(getPublishedPorts(updatedCompose, "other")).toEqual(["3000:3000"]);
  });

  test("on update, keeps a backup with the file's mode and validates the result", () => {
    const composePath = writeDockerComposeTemplate();
    const originalCompose = readFileSync(composePath, "utf8");
    chmodSync(composePath, 0o600);

    const validationLogPath = bindFormbricksPortToLoopback(composePath, "update");

    expect(getPublishedPorts(readFileSync(composePath, "utf8"), "formbricks")).toEqual([
      "127.0.0.1:3000:3000",
    ]);
    expect(readFileSync(`${composePath}.before-loopback-port`, "utf8")).toBe(originalCompose);
    expect(statSync(composePath).mode & 0o777).toBe(0o600);
    expect(statSync(`${composePath}.before-loopback-port`).mode & 0o777).toBe(0o600);
    expect(readFileSync(validationLogPath, "utf8")).toBe(
      `[${dirname(composePath)}] docker compose config\n[${dirname(composePath)}] docker compose config --format json formbricks\n`
    );
  });

  test("on update, restores the original when the result does not validate", () => {
    const composePath = writeDockerComposeTemplate();
    const originalCompose = readFileSync(composePath, "utf8");

    expect(() => bindFormbricksPortToLoopback(composePath, "update", "failure")).toThrow();

    expect(readFileSync(composePath, "utf8")).toBe(originalCompose);
    expect(existsSync(`${composePath}.tmp`)).toBe(false);
  });

  const duplicateRender = renderFormbricksPorts(loopbackPort, { ...loopbackPort, host_ip: "0.0.0.0" });

  const bareOverride = `services:
  formbricks:
    ports:
      - 3000:3000
`;

  const runUpdate = ({
    failPortValidation = false,
    failUpgradeCheck = false,
    withOverride = false,
    overrideContents = "services: {}\n",
    renderedFormbricks = renderFormbricksPorts(loopbackPort),
    engineVersion = "",
    extraFiles = {},
    envExtra = "",
    failRestore = false,
  }: {
    failPortValidation?: boolean;
    failUpgradeCheck?: boolean;
    withOverride?: boolean;
    overrideContents?: string;
    renderedFormbricks?: string;
    engineVersion?: string;
    extraFiles?: Record<string, string>;
    envExtra?: string;
    failRestore?: boolean;
  } = {}) => {
    const tempDir = createTempDir();
    const installationDir = join(tempDir, "formbricks");
    const binDir = join(tempDir, "bin");
    const commandLog = join(tempDir, "commands.log");
    const composePath = join(installationDir, "docker-compose.yml");
    const composeContents = `services:
  authzed-ops:
  spicedb:
  hub-worker:
  formbricks:
    image: ghcr.io/formbricks/formbricks:latest
    ports:
      - 3000:3000
`;
    mkdirSync(installationDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    writeFileSync(composePath, composeContents);
    if (withOverride) writeFileSync(join(installationDir, "docker-compose.override.yml"), overrideContents);
    writeFileSync(join(tempDir, "rendered.json"), renderedFormbricks);
    for (const [name, contents] of Object.entries(extraFiles))
      writeFileSync(join(installationDir, name), contents);
    writeFileSync(
      join(installationDir, ".env"),
      `FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED=true\n${envExtra}`
    );
    if (failRestore) {
      writeFileSync(
        join(binDir, "cp"),
        '#!/bin/sh\ncase "$2" in *.before-loopback-port) exit 1 ;; esac\nexec /bin/cp "$@"\n',
        { mode: 0o700 }
      );
    }
    writeFileSync(
      join(binDir, "sudo"),
      `#!/bin/sh
printf "%s\\n" "$*" >> "$COMMAND_LOG"
case "$*" in
  *"config --services") printf "authzed-ops\\nspicedb\\nhub-worker\\nformbricks\\n" ;;
  "docker compose config") [ "$FAIL_PORT_VALIDATION" = "1" ] && exit 1 ;;
  *"upgrade check") [ "$FAIL_UPGRADE_CHECK" = "1" ] && exit 1 ;;
  *"docker version"*) [ -n "$ENGINE_VERSION" ] && printf "%s\\n" "$ENGINE_VERSION" ;;
  *"--format json formbricks") cat "$RENDERED_JSON" ;;
esac
exit 0
`,
      { mode: 0o700 }
    );

    const result = spawnSync("bash", ["-c", updateFormbricksWithoutIpv6, "bash", formbricksScriptPath], {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        COMMAND_LOG: commandLog,
        FAIL_PORT_VALIDATION: failPortValidation ? "1" : "0",
        FAIL_UPGRADE_CHECK: failUpgradeCheck ? "1" : "0",
        ENGINE_VERSION: engineVersion,
        RENDERED_JSON: join(tempDir, "rendered.json"),
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
    });

    return { result, composePath, composeContents, commands: readFileSync(commandLog, "utf8") };
  };

  test("the updater narrows an existing install's port after its last gate, before stopping the stack", () => {
    const { result, composePath, composeContents, commands } = runUpdate();

    expect(result.status).toBe(0);
    expect(getPublishedPorts(readFileSync(composePath, "utf8"), "formbricks")).toEqual([
      "127.0.0.1:3000:3000",
    ]);
    expect(readFileSync(`${composePath}.before-loopback-port`, "utf8")).toBe(composeContents);
    const validation = commands.indexOf("docker compose config\n");
    expect(validation).toBeGreaterThan(commands.indexOf("upgrade check"));
    expect(validation).toBeLessThan(commands.indexOf("docker compose down"));
  });

  test("a gate that stops the update leaves the port and the file untouched", () => {
    const { result, composePath, composeContents, commands } = runUpdate({ failUpgradeCheck: true });

    expect(result.status).not.toBe(0);
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
    expect(existsSync(`${composePath}.before-loopback-port`)).toBe(false);
    expect(commands).not.toContain("docker compose config\n");
    expect(result.stdout).not.toContain("127.0.0.1 only");
  });

  test("the updater restores the file and still updates when the narrowed file does not validate", () => {
    const { result, composePath, composeContents, commands } = runUpdate({ failPortValidation: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Restored docker-compose.yml from docker-compose.yml.before-loopback-port"
    );
    expect(result.stdout).toContain("Continuing the update with port 3000 published as before");
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
    expect(commands).toContain("docker compose up -d");
  });

  test("the updater validates the project the way its own `up` loads it, with no -f", () => {
    const { commands } = runUpdate({ withOverride: true });

    expect(commands).toContain("docker compose config\n");
    expect(commands).not.toMatch(/docker compose -f .* config/);
  });

  test("the updater narrows the override's bare mapping in the same transaction", () => {
    const overrideContents = `services:
  formbricks:
    ports:
      - 3000:3000 # from an older guide
`;
    const { result, composePath } = runUpdate({ withOverride: true, overrideContents });
    const overridePath = composePath.replace("docker-compose.yml", "docker-compose.override.yml");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Changed: docker-compose.yml docker-compose.override.yml (");
    expect(readFileSync(overridePath, "utf8")).toContain(
      '      - "127.0.0.1:3000:3000" # from an older guide\n'
    );
    expect(readFileSync(`${overridePath}.before-loopback-port`, "utf8")).toBe(overrideContents);
    expect(getPublishedPorts(readFileSync(composePath, "utf8"), "formbricks")).toEqual([
      "127.0.0.1:3000:3000",
    ]);
  });

  test.each([
    ["the port would be published twice", { renderedFormbricks: duplicateRender }],
    ["the merged project does not render", { failPortValidation: true }],
  ])("the updater restores the override too when %s", (_case, options) => {
    const { result, composePath, composeContents, commands } = runUpdate({
      withOverride: true,
      overrideContents: bareOverride,
      ...options,
    });
    const overridePath = composePath.replace("docker-compose.yml", "docker-compose.override.yml");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "Restored docker-compose.yml from docker-compose.yml.before-loopback-port"
    );
    expect(result.stdout).toContain(
      "Restored docker-compose.override.yml from docker-compose.override.yml.before-loopback-port"
    );
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
    expect(readFileSync(overridePath, "utf8")).toBe(bareOverride);
    expect(commands).toContain("docker compose up -d");
  });

  const runBindWithRealCompose = (files: Record<string, string>) => {
    const installationDir = createTempDir();
    for (const [name, contents] of Object.entries(files))
      writeFileSync(join(installationDir, name), contents);
    const result = spawnSync(
      "bash",
      [
        "-c",
        'source "$1"; sudo() { "$@"; }; cd "$2"; bind_formbricks_port_to_loopback docker-compose.yml validate',
        "bash",
        formbricksScriptPath,
        installationDir,
      ],
      { encoding: "utf8", env: getDockerComposeProcessEnv() }
    );
    const rendered = runDockerCompose([
      "--project-directory",
      installationDir,
      "config",
      "--format",
      "json",
      "formbricks",
    ]);
    return { result, installationDir, rendered: JSON.parse(rendered) as RenderedDockerComposeConfig };
  };

  const realComposeFile = `services:
  formbricks:
    image: ghcr.io/formbricks/formbricks:latest
    ports:
      - 3000:3000
`;

  dockerComposeTest("with real Compose, the narrowed project publishes the port on loopback only", () => {
    const { result, installationDir, rendered } = runBindWithRealCompose({
      "docker-compose.yml": realComposeFile,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("publishes port 3000 on 127.0.0.1 only");
    expect(existsSync(join(installationDir, "docker-compose.yml.before-loopback-port"))).toBe(true);
    expect(rendered.services.formbricks.ports).toEqual([
      expect.objectContaining({ host_ip: "127.0.0.1", published: "3000", target: 3000 }),
    ]);
  });

  dockerComposeTest(
    "with real Compose, a compose.yaml it prefers keeps the update from claiming the port is narrowed",
    () => {
      const { result, installationDir } = runBindWithRealCompose({
        "docker-compose.yml": realComposeFile,
        "compose.yaml": realComposeFile,
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("would not publish port 3000 on 127.0.0.1 only");
      expect(result.stdout).not.toContain("127.0.0.1 only. Traefik");
      expect(readFileSync(join(installationDir, "docker-compose.yml"), "utf8")).toBe(realComposeFile);
    }
  );

  test("the updater stops before stopping the stack when a restore fails", () => {
    const { result, commands } = runUpdate({ failPortValidation: true, failRestore: true });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("Could not restore docker-compose.yml");
    expect(result.stdout).toContain("Stopped the update before touching the running stack");
    expect(result.stdout).not.toContain("Continuing the update");
    expect(commands).not.toContain("docker compose down");
  });

  test("the updater narrows the override Compose loads first, in Compose's order", () => {
    const { result, composePath } = runUpdate({
      extraFiles: { "compose.override.yml": bareOverride, "docker-compose.override.yml": bareOverride },
    });
    const installationDir = dirname(composePath);

    expect(result.status).toBe(0);
    expect(
      getPublishedPorts(readFileSync(join(installationDir, "compose.override.yml"), "utf8"), "formbricks")
    ).toEqual(["127.0.0.1:3000:3000"]);
    expect(readFileSync(join(installationDir, "docker-compose.override.yml"), "utf8")).toBe(bareOverride);
  });

  test("the updater narrows a docker-compose.override.yaml", () => {
    const { result, composePath } = runUpdate({
      extraFiles: { "docker-compose.override.yaml": bareOverride },
    });

    expect(result.status).toBe(0);
    expect(
      getPublishedPorts(
        readFileSync(join(dirname(composePath), "docker-compose.override.yaml"), "utf8"),
        "formbricks"
      )
    ).toEqual(["127.0.0.1:3000:3000"]);
  });

  test.each([
    "COMPOSE_FILE=docker-compose.yml:extra.yml",
    "COMPOSE_FILE: docker-compose.yml:extra.yml",
    "export COMPOSE_FILE=docker-compose.yml:extra.yml",
  ])("the updater leaves the port alone when .env has %s", (setting) => {
    const { result, composePath, composeContents, commands } = runUpdate({ envExtra: `${setting}\n` });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(".env sets COMPOSE_FILE");
    expect(result.stdout).toContain("Continuing the update with port 3000 published as before");
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
    expect(existsSync(`${composePath}.before-loopback-port`)).toBe(false);
    expect(commands).toContain("docker compose up -d");
  });

  test.each([
    [
      "a compose.yaml Compose prefers still publishes it on every interface",
      renderFormbricksPorts(everyInterfacePort),
    ],
    ["the project Compose loads publishes no port 3000", renderFormbricksPorts()],
    ["the binding is on another address", renderFormbricksPorts({ ...loopbackPort, host_ip: "::1" })],
  ])("the updater restores the file and keeps going when %s", (_case, renderedFormbricks) => {
    const { result, composePath, composeContents, commands } = runUpdate({
      extraFiles: { "compose.yaml": bareOverride },
      renderedFormbricks,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("would not publish port 3000 on 127.0.0.1 only");
    expect(result.stdout).toContain(
      "Restored docker-compose.yml from docker-compose.yml.before-loopback-port"
    );
    expect(result.stdout).not.toContain("127.0.0.1 only. Traefik");
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
    expect(readFileSync(join(dirname(composePath), "compose.yaml"), "utf8")).toBe(bareOverride);
    expect(commands).toContain("docker compose up -d");
  });

  test("the updater spots a double publication in compact JSON too", () => {
    const { result, composePath, composeContents } = runUpdate({
      renderedFormbricks: JSON.stringify(JSON.parse(duplicateRender)),
    });

    expect(result.stdout).toContain("would publish port 3000 more than once");
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
  });

  test("the updater restores every file and keeps going when the port would be published twice", () => {
    const renderedFormbricks = duplicateRender;
    const { result, composePath, composeContents, commands } = runUpdate({ renderedFormbricks });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("would publish port 3000 more than once");
    expect(result.stdout).toContain(
      "Restored docker-compose.yml from docker-compose.yml.before-loopback-port"
    );
    expect(result.stdout).not.toContain("127.0.0.1 only");
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
    expect(commands).toContain("docker compose up -d");
  });

  test.each([
    ["27.5.1", true],
    ["28.2.2", true],
    ["28.3.3", false],
    ["29.0.1", false],
  ])("the updater warns about Docker Engine %s: %s", (engineVersion, warns) => {
    const { result } = runUpdate({ engineVersion });

    expect(result.stdout.includes("Upgrade Docker Engine to 28.3.3 or later")).toBe(warns);
  });

  test("a commented service header still scopes the rewrite to the formbricks service", () => {
    const tempDir = createTempDir();
    const composePath = join(tempDir, "docker-compose.yml");
    writeFileSync(
      composePath,
      `services:
  formbricks: # the app
    ports:
      - 3000:3000
  hub: # the hub
    ports:
      - 3000:3000
`
    );

    bindFormbricksPortToLoopback(composePath, "install");

    const updatedCompose = readFileSync(composePath, "utf8");
    expect(getPublishedPorts(updatedCompose, "formbricks")).toEqual(["127.0.0.1:3000:3000"]);
    expect(getPublishedPorts(updatedCompose, "hub")).toEqual(["3000:3000"]);
  });

  test("leaves a formbricks key outside the services section alone", () => {
    const tempDir = createTempDir();
    const composePath = join(tempDir, "docker-compose.yml");
    const compose = `services:
  web:
    image: example
volumes:
  formbricks:
    ports:
      - 3000:3000
`;
    writeFileSync(composePath, compose);

    bindFormbricksPortToLoopback(composePath, "install");

    expect(readFileSync(composePath, "utf8")).toBe(compose);
  });

  test("recognises quoted, anchored and dotted service headers", () => {
    const tempDir = createTempDir();
    const composePath = join(tempDir, "docker-compose.yml");
    writeFileSync(
      composePath,
      `services:
  "formbricks": &app
    ports:
      - 3000:3000
  hub.v2:
    ports:
      - 3000:3000
`
    );

    bindFormbricksPortToLoopback(composePath, "install");

    const updated = readFileSync(composePath, "utf8");
    expect(updated).toContain('  "formbricks": &app\n    ports:\n      - "127.0.0.1:3000:3000"\n');
    expect(updated).toContain("  hub.v2:\n    ports:\n      - 3000:3000\n");
  });

  test.each([
    ["27.5.1", false],
    ["28.0.0", true],
    ["28.1.1", true],
    ["28.2.0", false],
    ["28.3.2", false],
    ["28.3.3", true],
    ["29.1.0-rc.1", true],
    ["", true],
    ["unknown", true],
  ])("docker_engine_isolates_loopback_ports(%s) is %s", (version, isolates) => {
    const result = spawnSync(
      "bash",
      [
        "-c",
        'source "$1"; set +e; docker_engine_isolates_loopback_ports "$2"',
        "bash",
        formbricksScriptPath,
        version,
      ],
      { encoding: "utf8" }
    );

    expect(result.status === 0).toBe(isolates);
  });

  test.each([
    ["- 3000:3000 # app port", '- "127.0.0.1:3000:3000" # app port'],
    ['- "3000:3000" # app port', '- "127.0.0.1:3000:3000" # app port'],
    ["- '3000:3000'   # app", "- '127.0.0.1:3000:3000'   # app"],
  ])("keeps the trailing comment on %s", (mapping, expected) => {
    const composePath = writeDockerComposeTemplate();
    writeFileSync(composePath, readFileSync(composePath, "utf8").replace("- 3000:3000", mapping));

    bindFormbricksPortToLoopback(composePath, "install");

    expect(readFileSync(composePath, "utf8")).toContain(`      ${expected}\n`);
  });

  test("recognises comments after services: and ports:", () => {
    const tempDir = createTempDir();
    const composePath = join(tempDir, "docker-compose.yml");
    writeFileSync(
      composePath,
      `services: # the stack
  formbricks:
    ports: # published for local checks
      - 3000:3000
`
    );

    bindFormbricksPortToLoopback(composePath, "install");

    expect(getPublishedPorts(readFileSync(composePath, "utf8"), "formbricks")).toEqual([
      "127.0.0.1:3000:3000",
    ]);
  });

  test.each(["- 3000:3000:3000 # odd", '- "3000:3000"x', "- '3000:3000' :tcp"])(
    "leaves %s alone",
    (mapping) => {
      const composePath = writeDockerComposeTemplate();
      const custom = readFileSync(composePath, "utf8").replace("- 3000:3000", mapping);
      writeFileSync(composePath, custom);

      bindFormbricksPortToLoopback(composePath, "install");

      expect(readFileSync(composePath, "utf8")).toBe(custom);
    }
  );

  test("stops before writing when the mode-preserving copy fails", () => {
    const composePath = writeDockerComposeTemplate();
    const originalCompose = readFileSync(composePath, "utf8");
    chmodSync(composePath, 0o600);
    const binDir = join(createTempDir(), "bin");
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, "cp"), '#!/bin/sh\ncase "$*" in *.tmp) exit 1 ;; esac\nexec /bin/cp "$@"\n', {
      mode: 0o700,
    });

    const result = spawnSync(
      "bash",
      [
        "-c",
        'source "$1"; set +e; bind_formbricks_port_to_loopback "$2"',
        "bash",
        formbricksScriptPath,
        composePath,
      ],
      { encoding: "utf8", env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` } }
    );

    expect(result.status).not.toBe(0);
    expect(readFileSync(composePath, "utf8")).toBe(originalCompose);
    expect(statSync(composePath).mode & 0o777).toBe(0o600);
    expect(existsSync(`${composePath}.tmp`)).toBe(false);
    expect(existsSync(`${composePath}.before-loopback-port`)).toBe(false);
  });

  test("on install, narrows an override kept from an earlier install and backs it up", () => {
    const composePath = writeDockerComposeTemplate();
    const overridePath = join(dirname(composePath), "docker-compose.override.yml");
    writeFileSync(overridePath, bareOverride);

    bindFormbricksPortToLoopback(composePath, "install");

    expect(getPublishedPorts(readFileSync(composePath, "utf8"), "formbricks")).toEqual([
      "127.0.0.1:3000:3000",
    ]);
    expect(getPublishedPorts(readFileSync(overridePath, "utf8"), "formbricks")).toEqual([
      "127.0.0.1:3000:3000",
    ]);
    expect(readFileSync(`${overridePath}.before-loopback-port`, "utf8")).toBe(bareOverride);
  });

  test.each([
    [
      "a later service header with a dotted anchor",
      `services:
  formbricks:
    ports:
      - 3000:3000
  hub: &hub.v2
    ports:
      - 3000:3000
`,
    ],
    [
      "a block scalar that mentions ports",
      `services:
  formbricks:
    image: example
    command: |
      ports:
      - 3000:3000
`,
    ],
    [
      "a nested ports: key",
      `services:
  formbricks:
    deploy:
      ports:
        - 3000:3000
`,
    ],
  ])("only rewrites the formbricks service's own ports, with %s", (_case, contents) => {
    const composePath = join(createTempDir(), "docker-compose.yml");
    writeFileSync(composePath, contents);

    bindFormbricksPortToLoopback(composePath, "install");

    const expectedFormbricksOnly = contents.replace("- 3000:3000\n  hub", '- "127.0.0.1:3000:3000"\n  hub');
    expect(readFileSync(composePath, "utf8")).toBe(expectedFormbricksOnly);
  });

  test("keeps CRLF line endings", () => {
    const composePath = writeDockerComposeTemplate();
    const crlf = readFileSync(composePath, "utf8").replace(/\n/g, "\r\n");
    writeFileSync(composePath, crlf);

    bindFormbricksPortToLoopback(composePath, "install");

    expect(readFileSync(composePath, "utf8")).toBe(
      crlf.replace("- 3000:3000\r\n", '- "127.0.0.1:3000:3000"\r\n')
    );
  });

  test.each([
    ["a tab", "\t"],
    ["spaces and a tab", "  \t "],
  ])("keeps reading the formbricks service past a blank line with %s", (_case, blank) => {
    const composePath = join(createTempDir(), "docker-compose.yml");
    writeFileSync(
      composePath,
      `services:\n  formbricks:\n    image: x\n${blank}\n    ports:\n${blank}\n      - 3000:3000\n`
    );

    bindFormbricksPortToLoopback(composePath, "install");

    expect(readFileSync(composePath, "utf8")).toContain('      - "127.0.0.1:3000:3000"\n');
  });

  test("keeps reading the formbricks service past a blank CRLF line", () => {
    const composePath = join(createTempDir(), "docker-compose.yml");
    writeFileSync(
      composePath,
      "services:\r\n  formbricks:\r\n    image: example\r\n\r\n    ports:\r\n      - 3000:3000\r\n"
    );

    bindFormbricksPortToLoopback(composePath, "install");

    expect(readFileSync(composePath, "utf8")).toContain('      - "127.0.0.1:3000:3000"\r\n');
  });

  test("reads past a comment line inside the ports list", () => {
    const composePath = join(createTempDir(), "docker-compose.yml");
    writeFileSync(
      composePath,
      `services:
  formbricks:
    ports:
# published for local checks
      - 3000:3000
`
    );

    bindFormbricksPortToLoopback(composePath, "install");

    expect(getPublishedPorts(readFileSync(composePath, "utf8"), "formbricks")).toEqual([
      "127.0.0.1:3000:3000",
    ]);
  });

  test("is idempotent", () => {
    const composePath = writeDockerComposeTemplate();
    bindFormbricksPortToLoopback(composePath, "install");
    const onceCompose = readFileSync(composePath, "utf8");

    bindFormbricksPortToLoopback(composePath, "update");

    expect(readFileSync(composePath, "utf8")).toBe(onceCompose);
    expect(existsSync(`${composePath}.before-loopback-port`)).toBe(false);
  });
});

describe("docker/formbricks.sh Cube model refresh (ENG-3951)", () => {
  const releaseUrl = "https://raw.githubusercontent.com/formbricks/formbricks/stable/docker";
  const previousModel = { config: "// previous cube.js\n", schema: "// previous model\n" };
  const releaseModel = { config: "// release cube.js\n", schema: "// release FeedbackRecords.js\n" };

  // An update that passes every gate, from an installation that may or may not run the bundled Cube.
  const runUpdate = ({
    withCubeFiles,
    downloadFails = "",
    replaceFails = "",
    restoreFails = "",
    backupBlocked = false,
    formbricksImage = "ghcr.io/formbricks/formbricks:latest",
  }: {
    withCubeFiles: boolean;
    // Fails every download whose URL contains this.
    downloadFails?: string;
    // Fails moving a file onto this path, relative to the installation.
    replaceFails?: string;
    // Fails copying a file onto this path, relative to the installation.
    restoreFails?: string;
    backupBlocked?: boolean;
    formbricksImage?: string;
  }) => {
    const tempDir = createTempDir();
    const installationDir = join(tempDir, "formbricks");
    const binDir = join(tempDir, "bin");
    const commandLog = join(tempDir, "commands.log");
    mkdirSync(installationDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    writeFileSync(
      join(installationDir, "docker-compose.yml"),
      "services:\n  authzed-ops:\n  hub-worker:\n  spicedb:\n"
    );
    writeFileSync(join(installationDir, ".env"), "FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED=true\n");
    if (withCubeFiles) {
      mkdirSync(join(installationDir, "cube", "schema"), { recursive: true });
      writeFileSync(join(installationDir, "cube", "cube.js"), previousModel.config);
      writeFileSync(join(installationDir, "cube", "schema", "FeedbackRecords.js"), previousModel.schema);
    }
    if (backupBlocked) {
      // A file where the backup directory belongs, so no backup can be written.
      writeFileSync(join(installationDir, "cube", "previous"), "not a directory\n");
    }
    // The operator keeps the updater next to the installation. This copy runs through /usr/bin/env, which every
    // test host has, unlike the /bin/env the released script names.
    writeFileSync(
      join(tempDir, "formbricks.sh"),
      readFileSync(formbricksScriptPath, "utf8").replace(/^#!.*\n/, "#!/usr/bin/env bash\n"),
      { mode: 0o700 }
    );
    writeFileSync(
      join(binDir, "sudo"),
      [
        "#!/bin/sh",
        'printf "%s\\n" "$*" >> "$COMMAND_LOG"',
        'case "$*" in',
        '  *"config --services") printf "authzed-ops\\nhub-worker\\nspicedb\\n" ;;',
        '  *"config --images") printf "pgvector/pgvector:pg18\\n%s\\n%s\\n" "$FORMBRICKS_IMAGE" "$FORMBRICKS_IMAGE" ;;',
        "esac",
        "",
      ].join("\n"),
      { mode: 0o700 }
    );
    // Serves the release's copy of whatever file is requested, or fails like an unreachable GitHub.
    writeFileSync(
      join(binDir, "curl"),
      [
        "#!/bin/sh",
        'for arg; do url="$arg"; done',
        'printf "curl %s\\n" "$url" >> "$COMMAND_LOG"',
        'if [ -n "$DOWNLOAD_FAILS" ]; then case "$url" in *"$DOWNLOAD_FAILS"*) exit 22 ;; esac; fi',
        'while [ $# -gt 0 ]; do [ "$1" = "-o" ] && out="$2"; shift; done',
        'printf "// release %s\\n" "${url##*/}" > "$out"',
        "",
      ].join("\n"),
      { mode: 0o700 }
    );
    writeFileSync(
      join(binDir, "mv"),
      '#!/bin/sh\nfor arg; do target="$arg"; done\n[ -n "$MV_FAILS" ] && [ "$target" = "$MV_FAILS" ] && exit 1\nexec /bin/mv "$@"\n',
      { mode: 0o700 }
    );
    writeFileSync(
      join(binDir, "cp"),
      '#!/bin/sh\nfor arg; do target="$arg"; done\n[ -n "$CP_FAILS" ] && [ "$target" = "$CP_FAILS" ] && exit 1\nexec /bin/cp "$@"\n',
      { mode: 0o700 }
    );

    const env = {
      ...process.env,
      COMMAND_LOG: commandLog,
      FORMBRICKS_IMAGE: formbricksImage,
      PATH: `${binDir}:${process.env.PATH ?? ""}`,
    };
    const result = spawnSync("bash", ["-c", updateFormbricksWithoutIpv6, "bash", formbricksScriptPath], {
      cwd: tempDir,
      encoding: "utf8",
      env: { ...env, DOWNLOAD_FAILS: downloadFails, MV_FAILS: replaceFails, CP_FAILS: restoreFails },
    });

    // Runs a printed command the way an operator would: pasted where they started the updater, once the cause
    // of the failure is gone.
    const runAsOperator = (command: string) =>
      spawnSync("bash", ["-c", command], { cwd: tempDir, encoding: "utf8", env });
    const readCommands = () => readFileSync(commandLog, "utf8").trim().split("\n");
    const read = (path: string) => readFileSync(join(installationDir, path), "utf8");

    return {
      result,
      installationDir,
      runAsOperator,
      readCommands,
      read,
      commands: readCommands(),
      model: () => ({ config: read("cube/cube.js"), schema: read("cube/schema/FeedbackRecords.js") }),
    };
  };

  const retryCommandFor = (stdout: string): string => {
    const lines = stdout.split("\n");
    const warning = lines.findIndex((line) => line.includes("Cube model was left as it was"));
    expect(warning).toBeGreaterThanOrEqual(0);
    return lines[warning + 1].trim();
  };

  test("serves the release's model after the update and keeps the previous files", () => {
    const { result, installationDir, commands, read, model } = runUpdate({ withCubeFiles: true });

    expect(result.status).toBe(0);
    expect(model()).toEqual(releaseModel);
    expect(read("cube/previous/cube.js")).toBe(previousModel.config);
    expect(read("cube/previous/schema/FeedbackRecords.js")).toBe(previousModel.schema);
    // Cube mounts cube/schema as its model directory, so a backup or download left there would load too.
    expect(readdirSync(join(installationDir, "cube", "schema"))).toEqual(["FeedbackRecords.js"]);
    expect(existsSync(join(installationDir, "cube", ".download"))).toBe(false);
    // While the stack is down, which is only after every gate, so Cube's next start reads the new model.
    for (const cubeFile of ["cube/cube.js", "cube/schema/FeedbackRecords.js"]) {
      const download = commands.indexOf(`curl ${releaseUrl}/${cubeFile}`);
      expect(download).toBeGreaterThan(commands.indexOf("docker compose down"));
      expect(download).toBeLessThan(commands.indexOf("docker compose up -d --wait postgres"));
    }
  });

  test("keeps the whole model when only the second download fails, and the retry refreshes both", () => {
    const { result, installationDir, commands, runAsOperator, readCommands, read, model } = runUpdate({
      withCubeFiles: true,
      downloadFails: "FeedbackRecords.js",
    });

    expect(result.status).toBe(0);
    expect(commands).toContain(`curl ${releaseUrl}/cube/cube.js`);
    expect(result.stdout).toContain("Could not download cube/schema/FeedbackRecords.js from stable");
    expect(model()).toEqual(previousModel);
    expect(existsSync(join(installationDir, "cube", "previous"))).toBe(false);
    expect(existsSync(join(installationDir, "cube", ".download"))).toBe(false);
    expect(commands.at(-1)).toBe("docker compose up -d");

    const retry = runAsOperator(retryCommandFor(result.stdout));
    expect(retry.status).toBe(0);
    expect(model()).toEqual(releaseModel);
    expect(read("cube/previous/schema/FeedbackRecords.js")).toBe(previousModel.schema);
    expect(readCommands().at(-1)).toBe("docker compose up -d --force-recreate cube");
  });

  test("puts cube.js back when the model file cannot be replaced", () => {
    const { result, installationDir, commands, model } = runUpdate({
      withCubeFiles: true,
      replaceFails: "cube/schema/FeedbackRecords.js",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Could not replace cube/schema/FeedbackRecords.js");
    expect(model()).toEqual(previousModel);
    expect(readdirSync(join(installationDir, "cube", "schema"))).toEqual(["FeedbackRecords.js"]);
    expect(existsSync(join(installationDir, "cube", ".download"))).toBe(false);
    expect(commands.at(-1)).toBe("docker compose up -d");
  });

  test("says how to fix a model it could neither replace nor restore, and still finishes the update", () => {
    const { result, installationDir, commands, runAsOperator, readCommands, model } = runUpdate({
      withCubeFiles: true,
      replaceFails: "cube/schema/FeedbackRecords.js",
      restoreFails: "cube/cube.js",
    });

    expect(result.status).toBe(0);
    expect(model()).toEqual({ config: releaseModel.config, schema: previousModel.schema });
    expect(result.stdout).not.toContain("left as it was");
    expect(existsSync(join(installationDir, "cube", ".download"))).toBe(false);
    expect(commands.at(-1)).toBe("docker compose up -d");

    const lines = result.stdout.split("\n");
    const warning = lines.findIndex((line) =>
      line.includes("the Cube model files are from different releases")
    );
    expect(warning).toBeGreaterThanOrEqual(0);
    const recovery = runAsOperator(lines[warning + 1].trim());
    expect(recovery.status).toBe(0);
    expect(model()).toEqual(previousModel);
    expect(readCommands().at(-1)).toBe("docker compose up -d --force-recreate cube");
  });

  test("never replaces the model without a backup, in the update or its retry", () => {
    const { result, commands, runAsOperator, readCommands, model } = runUpdate({
      withCubeFiles: true,
      backupBlocked: true,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Could not back up cube/cube.js to cube/previous/");
    expect(model()).toEqual(previousModel);
    expect(commands.at(-1)).toBe("docker compose up -d");

    // cube/previous is still a file, so the retry has to stop the same way rather than replace unsaved files.
    const retry = runAsOperator(retryCommandFor(result.stdout));
    expect(retry.status).not.toBe(0);
    expect(model()).toEqual(previousModel);
    expect(readCommands()).not.toContain("docker compose up -d --force-recreate cube");
  });

  test("serves the model of the release the Formbricks image is pinned to", () => {
    const { result, commands, model } = runUpdate({
      withCubeFiles: true,
      formbricksImage: "ghcr.io/formbricks/formbricks:6.0.2",
    });
    const pinnedUrl = "https://raw.githubusercontent.com/formbricks/formbricks/6.0.2/docker";

    expect(result.status).toBe(0);
    expect(commands.filter((command) => command.startsWith("curl "))).toEqual([
      `curl ${pinnedUrl}/cube/cube.js`,
      `curl ${pinnedUrl}/cube/schema/FeedbackRecords.js`,
    ]);
    expect(model()).toEqual(releaseModel);
  });

  // A tag next to a digest is only a label: the digest decides what runs.
  test.each([
    `ghcr.io/formbricks/formbricks@sha256:${"a".repeat(64)}`,
    `ghcr.io/formbricks/formbricks:6.0.2@sha256:${"a".repeat(64)}`,
  ])("leaves the model alone when the image names no release: %s", (formbricksImage) => {
    const { result, commands, model } = runUpdate({ withCubeFiles: true, formbricksImage });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("migration#cube-model-files-for-docker");
    expect(commands.some((command) => command.startsWith("curl "))).toBe(false);
    expect(model()).toEqual(previousModel);
    expect(commands.at(-1)).toBe("docker compose up -d");
  });

  test("leaves an installation without the bundled Cube model alone", () => {
    const { result, installationDir, commands } = runUpdate({ withCubeFiles: false });

    expect(result.status).toBe(0);
    expect(commands.some((command) => command.startsWith("curl "))).toBe(false);
    expect(existsSync(join(installationDir, "cube"))).toBe(false);
  });
});

describe("docker/formbricks.sh Traefik label injection", () => {
  test("pins a Traefik whose buffering middleware keeps empty auth redirects", () => {
    // Before v3.6.15 the auth routers' buffering middleware turned an empty chunked 302, the answer to every
    // OAuth/SSO callback, into a 500 (traefik#11568). docker/traefik-auth-smoke.sh proves it live.
    const image = execFileSync(
      "bash",
      ["-c", 'source "$1"; printf %s "$traefik_image"', "bash", formbricksScriptPath],
      { encoding: "utf8" }
    );
    const version = /^traefik:v(\d+)\.(\d+)\.(\d+)$/.exec(image);

    expect(version).not.toBeNull();
    const [major, minor, patch] = (version ?? []).slice(1).map(Number);
    expect(major * 1_000_000 + minor * 1_000 + patch).toBeGreaterThanOrEqual(3_006_015);
  });

  test.each([
    ["y", "y"],
    ["y", "n"],
    ["n", "y"],
    ["n", "n"],
  ])("writes a static config that refuses encoded path characters (HSTS %s, HTTPS %s)", (hsts, https) => {
    const configPath = join(createTempDir(), "traefik.yaml");
    execFileSync(
      "bash",
      [
        "-c",
        'source "$1"; write_traefik_config "$2" "$3" "$4" ops@example.com',
        "bash",
        formbricksScriptPath,
        configPath,
        hsts,
        https,
      ],
      { encoding: "utf8" }
    );
    type EntryPointHttp = {
      encodedCharacters?: Record<string, boolean>;
      redirections?: { entryPoint: { to: string } };
      middlewares?: string[];
      tls?: { certResolver?: string };
    };
    type EntryPoint = {
      http: EntryPointHttp;
      transport: { respondingTimeouts: { readTimeout: string } };
    };
    const config = load(readFileSync(configPath, "utf8")) as {
      entryPoints: { web: EntryPoint; websecure: EntryPoint };
      providers: { docker: { exposedByDefault: boolean }; file: { directory: string } };
      certificatesResolvers?: { default: { acme: { email: string } } };
    };
    const { web, websecure } = config.entryPoints;

    // The read timeout is what bounds how long a slow sender can hold the auth routers' buffer.
    expect(web.transport.respondingTimeouts.readTimeout).toBe("60s");
    expect(websecure.transport.respondingTimeouts.readTimeout).toBe("60s");
    expect(config.providers.docker.exposedByDefault).toBe(false);
    expect(config.providers.file.directory).toBe("/");

    // Traefik refused all seven by default until v3.6.7; the installer keeps refusing them on both entry points.
    for (const entryPoint of [web.http, websecure.http]) {
      expect(entryPoint.encodedCharacters).toEqual({
        allowEncodedSlash: false,
        allowEncodedBackSlash: false,
        allowEncodedNullCharacter: false,
        allowEncodedSemicolon: false,
        allowEncodedPercent: false,
        allowEncodedQuestionMark: false,
        allowEncodedHash: false,
      });
    }
    expect(web.http.redirections?.entryPoint.to).toBe(hsts === "y" ? "websecure" : undefined);
    expect(websecure.http.middlewares).toEqual(hsts === "y" ? ["hstsHeader"] : undefined);
    expect(websecure.http.tls?.certResolver).toBe(https === "y" ? "default" : undefined);
    expect(config.certificatesResolvers?.default.acme.email).toBe(
      https === "y" ? "ops@example.com" : undefined
    );
  });

  test("adds HTTPS Traefik labels to the formbricks service only", () => {
    const composePath = writeDockerComposeTemplate();

    addFormbricksTraefikLabels(composePath, "y", "y");

    const composeContents = readFileSync(composePath, "utf8");
    const formbricksMigrateBlock = getServiceBlock(composeContents, "formbricks-migrate");
    const formbricksBlock = getServiceBlock(composeContents, "formbricks");
    const authzedBootstrapBlock = getServiceBlock(composeContents, "authzed-db-bootstrap");
    const authzedOpsBlock = getServiceBlock(composeContents, "authzed-ops");
    const authzedInitializeBlock = getServiceBlock(composeContents, "authzed-initialize");
    const spicedbBlock = getServiceBlock(composeContents, "spicedb");

    expect(formbricksMigrateBlock).not.toContain("    labels:");
    expect(formbricksMigrateBlock).not.toContain("traefik.enable=true");
    expect(authzedBootstrapBlock).toContain("authzed-postgres-bootstrap.sh");
    expect(authzedBootstrapBlock).not.toContain("traefik.enable=true");
    expect(spicedbBlock).toContain("authzed/spicedb:v1.56.2");
    expect(spicedbBlock).not.toContain("traefik.enable=true");
    expect(authzedOpsBlock).toContain('profiles: ["authzed-ops"]');
    expect(authzedOpsBlock).not.toContain("traefik.enable=true");
    expect(authzedInitializeBlock).toContain('command: ["upgrade", "prepare"]');
    expect(authzedInitializeBlock).not.toContain("traefik.enable=true");
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
    expect(formbricksBlock).toContain(
      "traefik.http.middlewares.auth-body-limit.buffering.maxRequestBodyBytes=1048576"
    );
    expect(formbricksBlock).toContain(
      "traefik.http.middlewares.auth-body-limit.buffering.memRequestBodyBytes=1048576"
    );
    expect(formbricksBlock).toContain(
      "traefik.http.routers.formbricks-auth.rule=Host(`example.com`) && PathPrefix(`/api/auth`)"
    );
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth.priority=1000");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth.entrypoints=websecure");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth.tls.certresolver=default");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth.service=formbricks");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth.middlewares=auth-body-limit");
    expect(formbricksBlock).not.toContain("formbricks-auth-http");

    const compose = load(composeContents) as { services: { formbricks: { labels: string[] } } };
    expect(compose.services.formbricks.labels).toContain(
      "traefik.http.routers.formbricks-auth.rule=Host(`example.com`) && PathPrefix(`/api/auth`)"
    );
  });

  test("omits ACME certresolver labels when HTTPS setup is disabled", () => {
    const composePath = writeDockerComposeTemplate();

    addFormbricksTraefikLabels(composePath, "y", "n");

    const composeContents = readFileSync(composePath, "utf8");
    const formbricksBlock = getServiceBlock(composeContents, "formbricks");

    expect(formbricksBlock).toContain("traefik.http.routers.formbricks.entrypoints=websecure");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks.tls=true");
    expect(formbricksBlock).toContain("traefik.http.routers.feedback-records-token.tls=true");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth.tls=true");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth.middlewares=auth-body-limit");
    expect(formbricksBlock).toContain("traefik.http.middlewares.hstsHeader.headers.stsSeconds=31536000");
    expect(formbricksBlock).not.toContain("tls.certresolver=default");
    expect(formbricksBlock).not.toContain("formbricks-auth-http");
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
    expect(formbricksBlock).toContain(
      "traefik.http.routers.formbricks-auth-http.rule=Host(`example.com`) && PathPrefix(`/api/auth`)"
    );
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth-http.entrypoints=web");
    expect(formbricksBlock).toContain(
      "traefik.http.routers.formbricks-auth-http.middlewares=auth-body-limit"
    );
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth-http.priority=1000");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth-http.service=formbricks");
    expect(formbricksBlock).not.toContain("formbricks-auth-http.tls");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth.middlewares=auth-body-limit");
    expect(formbricksBlock).not.toContain("tls.certresolver=default");
    expect(formbricksBlock).not.toContain("traefik.http.middlewares.hstsHeader.headers.stsSeconds=31536000");
  });

  test("caps auth bodies on both entrypoints when HTTPS is on and HSTS is off", () => {
    const composePath = writeDockerComposeTemplate();

    addFormbricksTraefikLabels(composePath, "n", "y");

    const formbricksBlock = getServiceBlock(readFileSync(composePath, "utf8"), "formbricks");

    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth.tls.certresolver=default");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth.middlewares=auth-body-limit");
    expect(formbricksBlock).toContain("traefik.http.routers.formbricks-auth-http.entrypoints=web");
    expect(formbricksBlock).toContain(
      "traefik.http.routers.formbricks-auth-http.middlewares=auth-body-limit"
    );
    expect(formbricksBlock).not.toContain("formbricks-auth-http.tls");
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

describe("docker/formbricks.sh IPv6 Compose network (ENG-3897)", () => {
  const ipv6Block = "\nnetworks:\n  default:\n    enable_ipv6: true\n";

  // Runs enable_compose_ipv6 with `sudo` replaced by `prelude`, so a test picks the real Docker Compose or a fake.
  const enableComposeIpv6 = (
    composePath: string,
    mode: "install" | "update",
    prelude = 'sudo() { "$@"; }'
  ): ReturnType<typeof spawnSync> =>
    spawnSync(
      "bash",
      [
        "-c",
        `source "$1"; set +e; ${prelude}\nenable_compose_ipv6 "$2" "$3"`,
        "bash",
        formbricksScriptPath,
        composePath,
        mode === "update" ? "validate" : "",
      ],
      { encoding: "utf8", env: getDockerComposeProcessEnv() }
    );

  const getNetworks = (composeContents: string): unknown =>
    (load(composeContents) as { networks?: unknown }).networks;

  test.each([
    ["26.1.4", false],
    ["27.0.0", true],
    ["27.5.1", true],
    ["29.9.0-rc.1", true],
    ["", false],
    ["unknown", false],
  ])("docker_engine_supports_ipv6_networks(%s) is %s", (version, supported) => {
    const result = spawnSync(
      "bash",
      [
        "-c",
        'source "$1"; set +e; docker_engine_supports_ipv6_networks "$2"',
        "bash",
        formbricksScriptPath,
        version,
      ],
      { encoding: "utf8" }
    );

    expect(result.status === 0).toBe(supported);
  });

  test.each([
    ["IPv6 on", true, "0", true],
    ["IPv6 off by sysctl", true, "1", false],
    ["IPv6 disabled at boot", false, "", false],
  ])("host_has_ipv6 with %s is %s", (_name, hasInterfaces, disableIpv6, expected) => {
    const procRoot = createTempDir();
    mkdirSync(join(procRoot, "net"));
    mkdirSync(join(procRoot, "sys/net/ipv6/conf/all"), { recursive: true });
    if (hasInterfaces) writeFileSync(join(procRoot, "net/if_inet6"), "");
    if (disableIpv6) writeFileSync(join(procRoot, "sys/net/ipv6/conf/all/disable_ipv6"), `${disableIpv6}\n`);

    const result = spawnSync(
      "bash",
      ["-c", 'source "$1"; set +e; host_has_ipv6 "$2"', "bash", formbricksScriptPath, procRoot],
      { encoding: "utf8" }
    );

    expect(result.status === 0).toBe(expected);
  });

  test("on install, adds an IPv6 default network and leaves the rest of the template alone", () => {
    const composePath = writeDockerComposeTemplate();
    const originalCompose = readFileSync(composePath, "utf8");

    const result = enableComposeIpv6(composePath, "install");

    expect(result.status).toBe(0);
    expect(readFileSync(composePath, "utf8")).toBe(originalCompose + ipv6Block);
    expect(existsSync(`${composePath}.before-ipv6-network`)).toBe(false);
  });

  dockerComposeTest(
    "on update, Docker Compose renders the default network with IPv6 and a backup is kept",
    () => {
      const { composePath } = writeDockerComposeFixture("POSTGRES_PASSWORD=test-password\n");
      const originalCompose = readFileSync(composePath, "utf8");
      chmodSync(composePath, 0o600);

      const result = enableComposeIpv6(composePath, "update");

      expect(result.status).toBe(0);
      expect(readFileSync(`${composePath}.before-ipv6-network`, "utf8")).toBe(originalCompose);
      expect(statSync(composePath).mode & 0o777).toBe(0o600);
      const rendered = JSON.parse(
        runDockerCompose(["-f", composePath, "config", "--format", "json"], {
          POSTGRES_PASSWORD: "test-password",
          AUTHZED_TOKEN: "test-authzed-token",
          AUTHZED_DATABASE_PASSWORD: "test-authzed-database-password",
        })
      ) as { networks: Record<string, { enable_ipv6?: boolean }> };
      expect(rendered.networks.default.enable_ipv6).toBe(true);

      expect(enableComposeIpv6(composePath, "update").status).toBe(3);
    }
  );

  test("on update, restores the original when the result does not turn IPv6 on", () => {
    const composePath = writeDockerComposeTemplate();
    const originalCompose = readFileSync(composePath, "utf8");

    const result = enableComposeIpv6(
      composePath,
      "update",
      `sudo() { [[ "$*" == *"--format json" ]] && printf '{"networks":{"default":{"ipam":{}}}}'; return 0; }`
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("would not turn on IPv6 for the default network");
    expect(readFileSync(composePath, "utf8")).toBe(originalCompose);
    expect(existsSync(`${composePath}.tmp`)).toBe(false);
  });

  test("adds default to an existing networks: block at its own indent", () => {
    const tempDir = createTempDir();
    const composePath = join(tempDir, "docker-compose.yml");
    writeFileSync(
      composePath,
      `services:
  formbricks:
    image: ghcr.io/formbricks/formbricks:latest
networks:
    # Shared with the reverse proxy.
    proxy:
        external: true
volumes:
  postgres:
`
    );

    expect(enableComposeIpv6(composePath, "install").status).toBe(0);

    expect(getNetworks(readFileSync(composePath, "utf8"))).toEqual({
      default: { enable_ipv6: true },
      proxy: { external: true },
    });
  });

  test.each([
    ["a block default", "networks:\n  default:\n    name: my-network\n"],
    ["a quoted default", 'networks:\n  "default":\n    driver: bridge\n'],
    ["an inline default", "networks: {default: {name: my-network}}\n"],
    [
      "an inline default on a later line",
      "networks: {\n  proxy: {external: true},\n  default: {name: my-network}\n}\n",
    ],
  ])("leaves %s the operator set untouched", (_name, networks) => {
    const tempDir = createTempDir();
    const composePath = join(tempDir, "docker-compose.yml");
    const composeContents = `services:\n  formbricks:\n    image: example\n${networks}`;
    writeFileSync(composePath, composeContents);

    expect(enableComposeIpv6(composePath, "update").status).toBe(3);
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
  });

  test("says IPv6 stays off when an inline networks: has no default", () => {
    const tempDir = createTempDir();
    const composePath = join(tempDir, "docker-compose.yml");
    const composeContents =
      "services:\n  formbricks:\n    image: example\nnetworks: {proxy: {external: true}}\n";
    writeFileSync(composePath, composeContents);

    const result = enableComposeIpv6(composePath, "update");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("writes networks: inline, so IPv6 cannot be turned on for you");
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
  });

  test("leaves the file untouched when an override sets the default network", () => {
    const composePath = writeDockerComposeTemplate();
    const originalCompose = readFileSync(composePath, "utf8");
    writeFileSync(
      join(dirname(composePath), "docker-compose.override.yml"),
      "networks:\n  default:\n    enable_ipv6: false\n"
    );

    expect(enableComposeIpv6(composePath, "update").status).toBe(3);
    expect(readFileSync(composePath, "utf8")).toBe(originalCompose);
  });

  // update_formbricks with `sudo` faked and the host's IPv6 support decided by the test, not the machine running it.
  const runUpdate = ({
    hostHasIpv6 = true,
    engineVersion = "29.0.0",
    failValidation = false,
    networkInUse = false,
    postgresFailsOnce = false,
    networkAfterFailedUp = false,
  } = {}) => {
    const tempDir = createTempDir();
    const installationDir = join(tempDir, "formbricks");
    const binDir = join(tempDir, "bin");
    const commandLog = join(tempDir, "commands.log");
    const composePath = join(installationDir, "docker-compose.yml");
    const composeContents = `services:
  authzed-ops:
  spicedb:
  hub-worker:
  formbricks:
    image: ghcr.io/formbricks/formbricks:latest
    ports:
      - "127.0.0.1:3000:3000"
`;
    mkdirSync(installationDir, { recursive: true });
    mkdirSync(binDir, { recursive: true });
    writeFileSync(composePath, composeContents);
    writeFileSync(join(installationDir, ".env"), "FORMBRICKS_AUTHZED_V6_MIGRATION_ACKNOWLEDGED=true\n");
    writeFileSync(
      join(binDir, "sudo"),
      `#!/bin/sh
printf "%s\\n" "$*" >> "$COMMAND_LOG"
case "$*" in
  *"config --services") printf "authzed-ops\\nspicedb\\nhub-worker\\nformbricks\\n" ;;
  *"docker version"*) printf "%s\\n" "$ENGINE_VERSION" ;;
  *"config --format json") [ "$FAIL_VALIDATION" = "1" ] || printf '{"networks":{"default":{"name":"formbricks_default","ipam":{},"enable_ipv6":true}}}' ;;
  *"up -d --wait postgres")
    if [ "$POSTGRES_FAILS_ONCE" = "1" ] && [ ! -f "$STATE_DIR/postgres-failed" ]; then
      touch "$STATE_DIR/postgres-failed"
      exit 1
    fi ;;
  *"network inspect formbricks_default")
    [ "$NETWORK_IN_USE" = "1" ] && exit 0
    [ "$NETWORK_AFTER_FAILED_UP" = "1" ] && [ -f "$STATE_DIR/postgres-failed" ] && exit 0
    exit 1 ;;
esac
exit 0
`,
      { mode: 0o700 }
    );

    const result = spawnSync(
      "bash",
      [
        "-c",
        `source "$1"; host_has_ipv6() { [[ "$HOST_HAS_IPV6" == "1" ]]; }; update_formbricks`,
        "bash",
        formbricksScriptPath,
      ],
      {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          COMMAND_LOG: commandLog,
          ENGINE_VERSION: engineVersion,
          FAIL_VALIDATION: failValidation ? "1" : "0",
          HOST_HAS_IPV6: hostHasIpv6 ? "1" : "0",
          NETWORK_IN_USE: networkInUse ? "1" : "0",
          POSTGRES_FAILS_ONCE: postgresFailsOnce ? "1" : "0",
          NETWORK_AFTER_FAILED_UP: networkAfterFailedUp ? "1" : "0",
          STATE_DIR: tempDir,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
        },
      }
    );

    return { result, composePath, composeContents, commands: readFileSync(commandLog, "utf8") };
  };

  test("the updater turns IPv6 on after its last gate and before `down` recreates the network", () => {
    const { result, composePath, composeContents, commands } = runUpdate();

    expect(result.status).toBe(0);
    expect(readFileSync(composePath, "utf8")).toBe(composeContents + ipv6Block);
    const validation = commands.indexOf("docker compose config --format json\n");
    expect(validation).toBeGreaterThan(commands.indexOf("upgrade check"));
    expect(validation).toBeLessThan(commands.indexOf("docker compose down"));
    expect(commands).toContain("docker compose up -d");
  });

  test("the updater puts the file back when `down` leaves the network attached to an outside container", () => {
    const { result, composePath, composeContents, commands } = runUpdate({ networkInUse: true });

    expect(result.status).toBe(0);
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
    expect(result.stdout).toContain("attached to the formbricks_default network, so it could not get IPv6");
    const inspect = commands.indexOf("docker network inspect formbricks_default");
    expect(inspect).toBeGreaterThan(commands.indexOf("docker compose down"));
    expect(inspect).toBeLessThan(commands.indexOf("docker compose up -d"));
    expect(commands).toContain("docker compose up -d\n");
  });

  test("the updater starts again without IPv6 when Docker cannot create the network", () => {
    const { result, composePath, composeContents, commands } = runUpdate({ postgresFailsOnce: true });

    expect(result.status).toBe(0);
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
    expect(result.stdout).toContain("Docker could not create the Compose network with IPv6");
    expect(commands.split("docker compose up -d --wait postgres").length - 1).toBe(2);
    expect(commands).toContain("docker compose up -d\n");
  });

  test("the updater stops on a failed start that left the network in place, keeping IPv6", () => {
    const { result, composePath, composeContents, commands } = runUpdate({
      postgresFailsOnce: true,
      networkAfterFailedUp: true,
    });

    expect(result.status).not.toBe(0);
    expect(readFileSync(composePath, "utf8")).toBe(composeContents + ipv6Block);
    expect(commands.split("docker compose up -d --wait postgres").length - 1).toBe(1);
    expect(commands).not.toContain("formbricks-migrate");
  });

  test("the updater only looks for a leftover network when it changed the file", () => {
    const { commands } = runUpdate({ engineVersion: "26.1.4", networkInUse: true });

    expect(commands).not.toContain("network inspect");
  });

  test("the updater restores the file and still updates when the result does not validate", () => {
    const { result, composePath, composeContents, commands } = runUpdate({ failValidation: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Continuing the update with IPv6 left off on the Compose network");
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
    expect(commands).toContain("docker compose up -d");
  });

  test("the updater leaves the network alone on a host without IPv6", () => {
    const { result, composePath, composeContents, commands } = runUpdate({ hostHasIpv6: false });

    expect(result.status).toBe(0);
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
    expect(commands).not.toContain("config --format json\n");
    expect(result.stdout).not.toContain("IPv6");
  });

  test.each(["26.1.4", ""])("the updater says why it left IPv6 off on Docker Engine %j", (engineVersion) => {
    const { result, composePath, composeContents } = runUpdate({ engineVersion });

    expect(result.status).toBe(0);
    expect(readFileSync(composePath, "utf8")).toBe(composeContents);
    expect(result.stdout).toContain("it needs Docker Engine 27.0 or later");
    expect(result.stdout).toContain("one-click#ipv6-visitors");
  });
});
