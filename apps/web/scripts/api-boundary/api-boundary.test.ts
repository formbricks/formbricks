import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { INVENTORY_FILE, renderInventory } from "./internal-route-inventory";
import {
  countServerActions,
  listClientActionImporters,
  listRouteFiles,
  normalizePathParams,
  readPublicBundlePaths,
} from "./scan";

/**
 * The API boundary guard (ENG-1668, ENG-3984). The dashboard talks to the backend over HTTP: public routes
 * under `/api/v3` (documented, API-key capable), internal ones under `/api/internal` (session or pre-login
 * only, never documented). These checks keep new code on that side of the line while the remaining server
 * actions are migrated.
 *
 * The two ratchets only ever fail on an increase, so a PR elsewhere that removes actions or imports passes
 * without touching this file. Lower the baselines when a migration lands, to lock the progress in.
 */

/** Exported server actions left to migrate. Only ever lower this. */
const SERVER_ACTION_BASELINE = 157;

/** Client modules that still call a server action directly. Only ever lower this. */
const CLIENT_ACTION_IMPORTER_BASELINE = 115;

const INTERNAL_AUTH_MODES = new Set(["session", "none"]);

describe("internal routes", () => {
  const internalRoutes = listRouteFiles().filter((route) => route.file.startsWith("app/api/internal/"));

  test("is not empty, so the checks below are checking something", () => {
    expect(internalRoutes.length).toBeGreaterThan(0);
  });

  test.each(internalRoutes.map((route) => [route.path, route] as const))(
    "%s goes through withV3ApiWrapper and never accepts an API key",
    (_path, route) => {
      expect(route.usesWrapper, `${route.file} must use withV3ApiWrapper`).toBe(true);
      // The default mode is "both", so a route that omits `auth` would accept API keys.
      for (const mode of route.authModes) {
        expect(INTERNAL_AUTH_MODES.has(mode), `${route.file} uses auth "${mode}"`).toBe(true);
      }
    }
  );

  test("none of them is published in the public v3 OpenAPI bundle", () => {
    const publicPaths = readPublicBundlePaths();
    const published = internalRoutes.filter((route) => publicPaths.has(normalizePathParams(route.path)));
    expect(published.map((route) => route.path)).toEqual([]);
  });
});

describe("server action ratchet", () => {
  test("no new server actions: new UI data flows go through the internal API", () => {
    const { total, actionsByFile } = countServerActions();
    expect(
      total,
      `Found ${total} exported server actions, more than the baseline of ${SERVER_ACTION_BASELINE}. New UI ` +
        "data flows go through an /api/internal route consumed with TanStack Query (see the api-routes and " +
        `frontend-coding skills). Files: ${[...actionsByFile.keys()].join(", ")}`
    ).toBeLessThanOrEqual(SERVER_ACTION_BASELINE);
  });

  test("no new client modules calling server actions directly", () => {
    const importers = listClientActionImporters();
    expect(
      importers.length,
      `Found ${importers.length} client modules importing a server action module, more than the baseline ` +
        `of ${CLIENT_ACTION_IMPORTER_BASELINE}. Call the backend through its API client instead: ` +
        importers.join(", ")
    ).toBeLessThanOrEqual(CLIENT_ACTION_IMPORTER_BASELINE);
  });
});

describe("internal route inventory", () => {
  test("app/api/INTERNAL_ROUTES.md is up to date (regenerate with `pnpm api:internal:inventory`)", () => {
    expect(readFileSync(INVENTORY_FILE, "utf8")).toBe(renderInventory());
  });
});
