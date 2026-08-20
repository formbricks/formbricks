import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
];

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

const renderDockerCompose = (envContents: string): RenderedDockerComposeConfig => {
  const { composePath, envPath } = writeDockerComposeFixture(envContents);

  return JSON.parse(
    runDockerCompose([
      "--env-file",
      envPath,
      "-f",
      composePath,
      "--project-directory",
      dirname(composePath),
      "config",
      "--format",
      "json",
    ])
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

const readExistingPostgresPassword = (envPath: string, composePath: string): string =>
  execFileSync(
    "bash",
    [
      "-lc",
      'source "$1"; read_existing_postgres_password "$2" "$3"',
      "bash",
      formbricksScriptPath,
      envPath,
      composePath,
    ],
    { encoding: "utf8" }
  ).trimEnd();

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
  test("rejects a missing PostgreSQL password", () => {
    expect(() => renderDockerCompose("")).toThrow(/POSTGRES_PASSWORD.*missing a value/);
  });

  test("renders a URL-safe PostgreSQL password into every bundled database client", () => {
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

  test("renders encoded connection URLs while retaining the raw PostgreSQL password", () => {
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
    const postgresPassword = getDotenvValue(envContents, "POSTGRES_PASSWORD");
    const secondPostgresPassword = getDotenvValue(secondEnvContents, "POSTGRES_PASSWORD");

    expect(envContents).toMatch(/^POSTGRES_PASSWORD=[a-f0-9]{64}$/m);
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

  test("preserves and URL-encodes the password from an existing one-click installation", () => {
    const tempDir = createTempDir();
    const envPath = join(tempDir, ".env");
    const composePath = join(tempDir, "docker-compose.yml");

    writeFileSync(
      composePath,
      `services:
  postgres:
    environment:
      - POSTGRES_PASSWORD=legacy:p@ss/word?#
`
    );

    const existingPassword = readExistingPostgresPassword(envPath, composePath);
    writeGeneratedEnvFile(envPath, existingPassword);

    const envContents = readFileSync(envPath, "utf8");

    expect(existingPassword).toBe("legacy:p@ss/word?#");
    expect(envContents).toContain("POSTGRES_PASSWORD=legacy:p@ss/word?#");
    expect(envContents).toContain("POSTGRES_PASSWORD_URL_ENCODED=legacy%3Ap%40ss%2Fword%3F%23");
  });

  test("preserves unrelated environment entries and literal dollar signs across reruns", () => {
    const composePath = writeDockerComposeTemplate();
    const envPath = join(dirname(composePath), ".env");
    const password = "legacy$PASSWORD_SENTINEL";

    writeFileSync(
      envPath,
      `# Operator-managed settings
PUBLIC_URL=https://surveys.example.com
CUSTOM_SECRET=keep-me
HUB_API_KEY=replace-me
`
    );

    writeGeneratedEnvFile(envPath, password);

    const firstEnvContents = readFileSync(envPath, "utf8");
    const renderedEnvironment = getRenderedDockerComposeEnvironment(composePath, envPath, {
      PASSWORD_SENTINEL: "rewritten",
    });

    expect(firstEnvContents).toContain("# Operator-managed settings");
    expect(firstEnvContents).toContain("PUBLIC_URL=https://surveys.example.com");
    expect(firstEnvContents).toContain("CUSTOM_SECRET=keep-me");
    expect(firstEnvContents).not.toContain("HUB_API_KEY=replace-me");
    expect(firstEnvContents).toContain("POSTGRES_PASSWORD=legacy$$PASSWORD_SENTINEL");
    expect(firstEnvContents).toContain("POSTGRES_PASSWORD_URL_ENCODED=legacy%24PASSWORD_SENTINEL");
    expect(getDotenvValue(renderedEnvironment, "POSTGRES_PASSWORD")).toBe(password);

    const existingPassword = readExistingPostgresPassword(envPath, composePath);
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
