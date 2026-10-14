import { CheckFailure, describeHealthFailures, failingHealthComponents } from "../src/diagnostics.ts";
import { expect, tierTest } from "../src/fixtures.ts";

const test = tierTest("infra");

test("app answers /health", async ({ api }) => {
  const response = await api.get("/health", { authenticated: false });
  if (response.status !== 200) {
    throw new CheckFailure(
      "App",
      `GET /health returned HTTP ${response.status}`,
      "check that the container is running and that the reverse proxy forwards to it"
    );
  }
});

test("database and cache are healthy", async ({ api }) => {
  const response = await api.get("/api/v2/health", { authenticated: false });
  if (response.status !== 200 && response.status !== 503) {
    throw new CheckFailure(
      "App",
      `GET /api/v2/health returned HTTP ${response.status}`,
      "check the app logs; this endpoint should answer even when a dependency is down"
    );
  }

  const failing = failingHealthComponents((response.json as { data?: unknown } | undefined)?.data);
  if (failing.length > 0) {
    throw new CheckFailure(
      "Dependencies",
      describeHealthFailures(failing),
      "fix the dependency above, then re-run"
    );
  }
});

test("public domain answers /health", async ({ api, config }) => {
  test.skip(!config.splitDomain, "single-domain setup");

  const response = await api.get("/health", { authenticated: false, origin: "publicUrl" });
  expect(response.status, "PUBLIC_URL /health").toBe(200);
});
