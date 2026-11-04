import { load } from "js-yaml";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

type TComposeFile = {
  services: Record<string, { environment?: Record<string, unknown>; shm_size?: unknown }>;
};

const readYaml = <T>(relativePath: string): T =>
  load(readFileSync(join(repositoryRoot, relativePath), "utf8")) as T;

// Cube turns CUBEJS_DB_QUERY_TIMEOUT into a per-query Postgres `statement_timeout`, so one dashboard
// cannot keep the database busy for Cube's default ten minutes.
const CUBE_QUERY_TIMEOUT = "60s";
// Docker gives a container 64 MB of /dev/shm; Postgres parallel workers and hash joins of large charts
// need more and fail with "could not resize shared memory segment" below it.
const POSTGRES_SHM_SIZE = "512mb";

describe("Cube and Postgres limits", () => {
  test.each(["docker/docker-compose.yml", "docker-compose.dev.yml"])(
    "%s bounds every Cube query and gives Postgres enough shared memory",
    (relativePath) => {
      const { services } = readYaml<TComposeFile>(relativePath);
      expect(services.cube.environment?.CUBEJS_DB_QUERY_TIMEOUT).toBe(
        `\${CUBEJS_DB_QUERY_TIMEOUT:-${CUBE_QUERY_TIMEOUT}}`
      );
      expect(services.postgres.shm_size).toBe(POSTGRES_SHM_SIZE);
    }
  );

  test("the Helm chart bounds every bundled Cube query by default", () => {
    const values = readYaml<{ cube: { env: Record<string, unknown> } }>("charts/formbricks/values.yaml");
    expect(values.cube.env.CUBEJS_DB_QUERY_TIMEOUT).toBe(CUBE_QUERY_TIMEOUT);
  });
});
