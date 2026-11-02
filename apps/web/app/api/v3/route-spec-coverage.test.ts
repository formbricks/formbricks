import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { readBundle } from "@formbricks/api-v3-schemas/testing";

/**
 * Every public `/api/v3` operation is in the OpenAPI bundle, and no session-only one is.
 *
 * Contract tests exercise documented operations only, so a route nobody documented shipped green: two
 * public archive/restore endpoints went out with no spec entry while `pnpm api:v3:check` stayed green.
 * A route's `auth` decides which side it is on: `"both"` (API key or session) is public and must be
 * documented; `"session"` is the app's own and must not be. Catch-all routes (`[[...path]]`) proxy to
 * another service, whose operations the bundle documents path by path, so they are skipped here.
 */

const V3_DIR = dirname(fileURLToPath(import.meta.url));
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/** Session-only routes the bundle still publishes. Remove an entry when its ticket lands. */
const PUBLISHED_SESSION_ONLY: Record<string, string> = {
  "GET /api/v3/tags": "ENG-2533",
  "PATCH /api/v3/tags/{}": "ENG-2533",
  "DELETE /api/v3/tags/{}": "ENG-2533",
  "POST /api/v3/tags/{}/merge": "ENG-2533",
};

type TRouteOperation = { key: string; auth: string | null; file: string };

const findRouteFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findRouteFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });

/** `/api/v3/surveys/[surveyId]/route.ts` → `/api/v3/surveys/{}`; path parameter names are not compared. */
const toPathKey = (file: string): string => {
  const segments = relative(V3_DIR, dirname(file)).split(sep).filter(Boolean);
  const path = segments.map((segment) => (segment.startsWith("[") ? "{}" : segment)).join("/");
  return `/api/v3${path ? `/${path}` : ""}`;
};

const exportedMethods = (source: string): string[] =>
  HTTP_METHODS.filter((method) =>
    new RegExp(`export\\s+(?:const|async\\s+function|function)\\s+${method}\\b`).test(source)
  );

const collectRouteOperations = (): TRouteOperation[] =>
  findRouteFiles(V3_DIR)
    .filter((file) => !file.includes("[[..."))
    .flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const auth = /\bauth:\s*"([a-z]+)"/.exec(source)?.[1] ?? null;
      const path = toPathKey(file);
      return exportedMethods(source).map((method) => ({ key: `${method} ${path}`, auth, file }));
    });

const collectDocumentedOperations = (): Set<string> => {
  const paths = readBundle().paths as Record<string, Record<string, unknown>>;
  return new Set(
    Object.entries(paths).flatMap(([path, item]) =>
      HTTP_METHODS.filter((method) => method.toLowerCase() in item).map(
        (method) => `${method} ${path.replace(/\{[^}]+\}/g, "{}")}`
      )
    )
  );
};

describe("API v3 route and OpenAPI coverage", () => {
  const routes = collectRouteOperations();
  const documented = collectDocumentedOperations();

  test("finds the route files and the bundle", () => {
    expect(routes.length).toBeGreaterThan(50);
    expect(documented.size).toBeGreaterThan(50);
  });

  test("every route declares its auth mode", () => {
    expect(routes.filter((route) => route.auth === null).map((route) => route.file)).toEqual([]);
  });

  test("every public operation is documented in the bundle", () => {
    const undocumented = routes
      .filter((route) => route.auth === "both" && !documented.has(route.key))
      .map((route) => route.key);
    expect(undocumented).toEqual([]);
  });

  test("no session-only operation is documented, except the ticketed ones", () => {
    const published = routes
      .filter((route) => route.auth === "session" && documented.has(route.key))
      .map((route) => route.key)
      .sort();
    expect(published).toEqual(Object.keys(PUBLISHED_SESSION_ONLY).sort());
  });
});
