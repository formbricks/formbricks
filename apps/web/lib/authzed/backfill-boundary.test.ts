import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * The backfill tooling performs **no authorization check**. It takes an organization or workspace ID and
 * rewrites that tenant's permission graph, which is correct for an operator command running with the
 * AuthZed system credential and catastrophic behind an HTTP surface: a "repair my organization" endpoint
 * or server action wired to it would be a maximum-impact BOLA — rewrite any tenant's permissions by ID.
 *
 * `import "server-only"` does not prevent this. It blocks *client* imports, not request-path ones. So the
 * boundary is asserted here instead: only the tooling's own modules and its command entry points may
 * reach it. If exposing it ever becomes necessary it needs `assertCan(actor, "organization.manage", …)`
 * in front and the whole-deployment scope removed — not an exemption added to this list.
 */

const WEB_ROOT = new URL("../../", import.meta.url).pathname;

/** Modules that may reach the backfill: the tooling itself, and the CLI entry points. */
const ALLOWED_IMPORTER_PREFIXES = ["lib/authzed/", "scripts/"];

const RESTRICTED_MODULES = ["backfill", "backfill-cli", "backfill-diff", "backfill-source"];

/**
 * Every directory holding application source, plus `apps/web`'s own root modules.
 *
 * `instrumentation*.ts` and `proxy.ts` live at the root rather than under a directory and are as
 * request-path as anything in `app/` — omitting them would leave the most sensitive files unchecked.
 */
const SEARCH_ROOTS = [".", "app", "integration", "lib", "modules", "scripts"];

const collectSourceFiles = (directory: string, recurse: boolean): ReadonlyArray<string> => {
  const entries: string[] = [];

  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === ".next") {
      continue;
    }

    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      if (recurse) {
        entries.push(...collectSourceFiles(absolute, true));
      }
      continue;
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      entries.push(absolute);
    }
  }

  return entries;
};

/**
 * Any reference to a restricted module as a module specifier.
 *
 * Deliberately not anchored to `from`: a static import is only one of the ways in. `await import(…)`,
 * `require(…)`, and a bare side-effect import all reach the same module, and a fence that only caught the
 * tidy spelling would be trivially — and silently — stepped around.
 */
const restrictedSpecifierPattern = (moduleName: string): RegExp =>
  new RegExp(String.raw`["'][^"']*(?:lib/)?authzed/${moduleName}["']`);

const importsRestrictedModule = (source: string): boolean =>
  RESTRICTED_MODULES.some((moduleName) => restrictedSpecifierPattern(moduleName).test(source));

describe("backfill module boundary", () => {
  const files = SEARCH_ROOTS.flatMap((root) => collectSourceFiles(join(WEB_ROOT, root), root !== "."));

  test("finds source files to check, so a broken search cannot pass silently", () => {
    expect(files.length).toBeGreaterThan(500);
  });

  test("searches apps/web's root modules, which hold the request-path proxy and instrumentation", () => {
    const rootModules = files
      .map((absolute) => relative(WEB_ROOT, absolute))
      .filter((relativePath) => !relativePath.includes("/"));

    expect(rootModules).toContain("proxy.ts");
    expect(rootModules).toContain("instrumentation.ts");
  });

  test("is imported only by the tooling itself and its command entry points", () => {
    const offenders = files
      .map((absolute) => ({ absolute, relativePath: relative(WEB_ROOT, absolute) }))
      .filter(
        ({ relativePath }) => !ALLOWED_IMPORTER_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
      )
      .filter(({ absolute }) => importsRestrictedModule(readFileSync(absolute, "utf8")))
      .map(({ relativePath }) => relativePath);

    expect(offenders).toEqual([]);
  });

  test("is not re-exported from the barrel, which would launder it past the allowed prefix", () => {
    // `lib/authzed/` is an allowed importer, so a re-export from inside it would make the tooling
    // reachable as `@/lib/authzed` from anywhere — passing every check above.
    expect(importsRestrictedModule(readFileSync(join(WEB_ROOT, "lib/authzed/index.ts"), "utf8"))).toBe(false);
  });
});
