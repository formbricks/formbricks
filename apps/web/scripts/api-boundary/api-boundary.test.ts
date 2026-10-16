import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { INVENTORY_FILE, renderInventory } from "./internal-route-inventory";
import {
  countServerActions,
  listClientActionImporters,
  listRouteFiles,
  normalizePathParams,
  readHandlers,
  readPublicBundlePaths,
  stripComments,
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

/** Server actions left to migrate, inline ones included. Only ever lower this. */
const SERVER_ACTION_BASELINE = 138;

/** Client modules that still call a server action directly. Only ever lower this. */
const CLIENT_ACTION_IMPORTER_BASELINE = 96;

const INTERNAL_AUTH_MODES = new Set(["session", "none"]);

describe("internal routes", () => {
  const internalRoutes = listRouteFiles().filter((route) => route.file.startsWith("app/api/internal/"));

  test("is not empty, so the checks below are checking something", () => {
    expect(internalRoutes.length).toBeGreaterThan(0);
  });

  test.each(internalRoutes.map((route) => [route.path, route] as const))(
    "%s: every method goes through withV3ApiWrapper and never accepts an API key",
    (_path, route) => {
      expect(route.handlers.length, `${route.file} exports no method handler`).toBeGreaterThan(0);
      for (const { method, usesWrapper, authMode } of route.handlers) {
        expect(usesWrapper, `${route.file} ${method} must be withV3ApiWrapper({ … })`).toBe(true);
        // The default mode is "both", so a handler that omits `auth` would accept API keys.
        expect(INTERNAL_AUTH_MODES.has(authMode), `${route.file} ${method} uses auth "${authMode}"`).toBe(
          true
        );
      }
    }
  );

  test("none of them is published in the public v3 OpenAPI bundle", () => {
    const publicPaths = readPublicBundlePaths();
    // An unparsed bundle would make the check below pass on nothing.
    expect(publicPaths.size).toBeGreaterThan(0);
    const published = internalRoutes.filter((route) => publicPaths.has(normalizePathParams(route.path)));
    expect(published.map((route) => route.path)).toEqual([]);
  });
});

describe("the route scan", () => {
  const route = (source: string) => readHandlers(source);

  test("reads each method's own wrapper and auth mode", () => {
    expect(
      route(`export const GET = withV3ApiWrapper({ auth: "session", handler });
export const POST = withV3ApiWrapper({ handler });`)
    ).toEqual([
      { method: "GET", usesWrapper: true, authMode: "session" },
      { method: "POST", usesWrapper: true, authMode: "both" },
    ]);
  });

  test("does not let one wrapped method vouch for a raw one beside it", () => {
    expect(
      route(`export const GET = withV3ApiWrapper({ auth: "session", handler });
export async function DELETE() { return new Response(null); }`)
    ).toContainEqual({ method: "DELETE", usesWrapper: false, authMode: "custom" });
  });

  test("ignores a wrapper or an auth mode that only appears in a comment", () => {
    expect(
      route(`// export const GET = withV3ApiWrapper({ auth: "session" })
/* auth: "session" */
export const GET = withV3ApiWrapper({ handler });`)
    ).toEqual([{ method: "GET", usesWrapper: true, authMode: "both" }]);
  });

  test("treats a re-exported handler as unverified", () => {
    expect(route(`const handler = () => new Response();\nexport { handler as POST };`)).toEqual([
      { method: "POST", usesWrapper: false, authMode: "custom" },
    ]);
  });

  test("strips comments without touching strings or line numbers", () => {
    const source = `const url = "https://example.com"; // trailing\n/* a\nb */ const x = '/*';`;
    const stripped = stripComments(source);
    expect(stripped).toContain(`"https://example.com"`);
    expect(stripped).toContain(`'/*'`);
    expect(stripped).not.toContain("trailing");
    expect(stripped.split("\n")).toHaveLength(source.split("\n").length);
  });
});

describe("server action ratchet", () => {
  test("no new server actions: new UI data flows go through the internal API", () => {
    const { total, actionsByFile } = countServerActions();
    expect(
      total,
      `Found ${total} server actions, more than the baseline of ${SERVER_ACTION_BASELINE}. New UI ` +
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
