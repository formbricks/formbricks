import { describe, expect, test } from "vitest";
import { callRoute } from "@/integration/api-routes";
import { GET } from "@/modules/api/v2/health/route";

/**
 * `GET /api/v2/health` against the real Postgres and Valkey. The unit suite (`lib/tests/health-checks.test.ts`)
 * mocks both, so this is where the probe is seen to reach them. Moved from `playwright/api/health.spec.ts`
 * (ENG-7518).
 */
describe("GET /api/v2/health", () => {
  test("answers 200 without credentials and reports both stores healthy", async () => {
    const response = await callRoute(GET, { path: "/api/v2/health" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { main_database: true, cache_database: true } });
  });
});
