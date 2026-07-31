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

const SEARCH_ROOTS = ["app", "lib", "modules", "scripts"];

const collectSourceFiles = (directory: string): ReadonlyArray<string> => {
  const entries: string[] = [];

  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === ".next") {
      continue;
    }

    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) {
      entries.push(...collectSourceFiles(absolute));
      continue;
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      entries.push(absolute);
    }
  }

  return entries;
};

describe("backfill module boundary", () => {
  const files = SEARCH_ROOTS.flatMap((root) => collectSourceFiles(join(WEB_ROOT, root)));

  test("finds source files to check, so a broken search cannot pass silently", () => {
    expect(files.length).toBeGreaterThan(500);
  });

  test("is imported only by the tooling itself and its command entry points", () => {
    const offenders = files
      .map((absolute) => ({ absolute, relativePath: relative(WEB_ROOT, absolute) }))
      .filter(
        ({ relativePath }) => !ALLOWED_IMPORTER_PREFIXES.some((prefix) => relativePath.startsWith(prefix))
      )
      .filter(({ absolute }) => {
        const source = readFileSync(absolute, "utf8");
        return RESTRICTED_MODULES.some((moduleName) =>
          new RegExp(String.raw`from\s+["'][^"']*(?:lib/)?authzed/${moduleName}["']`).test(source)
        );
      })
      .map(({ relativePath }) => relativePath);

    expect(offenders).toEqual([]);
  });
});
