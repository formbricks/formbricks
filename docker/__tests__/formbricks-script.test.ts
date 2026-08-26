import { load } from "js-yaml";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const formbricksScriptPath = fileURLToPath(new URL("../formbricks.sh", import.meta.url));
const dockerComposeTemplatePath = fileURLToPath(new URL("../docker-compose.yml", import.meta.url));
const legacyValkeyImage =
  "valkey/valkey@sha256:12ba4f45a7c3e1d0f076acd616cb230834e75a77e8516dde382720af32832d6d";
const multiArchValkeyImage =
  "valkey/valkey@sha256:e0eb7c480958d32bdc4357a74bdd70653ae15f2f9b4c93c4a5a9fad1dc471c84";

const tempDirs: string[] = [];

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

const migrateLegacyValkeyImage = (composePath: string, validationResult: "success" | "failure"): string => {
  const validationLogPath = join(createTempDir(), "validation.log");

  execFileSync(
    "bash",
    [
      "-lc",
      `source "$1"
sudo() {
  printf '%s\\n' "$*" >> "$VALIDATION_LOG_PATH"
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

    const validationLogPath = migrateLegacyValkeyImage(composePath, "success");

    expect(readFileSync(composePath, "utf8")).toBe(originalCompose);
    expect(readFileSync(`${composePath}.before-valkey-8.1.9`, "utf8")).toContain(legacyValkeyImage);
    expect(readFileSync(validationLogPath, "utf8")).toBe(`docker compose -f ${composePath} config\n`);
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
    expect(readFileSync(validationLogPath, "utf8")).toBe(`docker compose -f ${composePath} config\n`);
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
