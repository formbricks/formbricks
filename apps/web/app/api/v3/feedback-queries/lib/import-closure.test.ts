import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

/**
 * ADR 0016 deletes dashboards and charts and keeps Cube as the agent query layer. This pins the keep side:
 * everything the feedback query route and MCP tools import, transitively, must survive that deletion.
 * A static import walk is enough, because a module that is not imported cannot break.
 *
 * What survives is not "no `.tsx` anywhere": the auth stack reaches the email renderer, which is a `.tsx`
 * file and stays. The rule is about the analysis module, whose UI is what goes away.
 */

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

/** Paths a surviving module must not reach: the UI trees and the chart/dashboard types and logic. */
const FORBIDDEN: { why: string; test: (relativePath: string) => boolean }[] = [
  { why: "dashboards are deleted", test: (p) => /(^|\/)dashboards\//.test(p) },
  { why: "charts are deleted (components and lib)", test: (p) => /(^|\/)charts\//.test(p) },
  { why: "analysis UI components are deleted", test: (p) => p.startsWith("modules/ee/analysis/components/") },
  {
    why: "analysis chart and widget types are deleted",
    test: (p) => p === "modules/ee/analysis/types/analysis.ts",
  },
  {
    why: "no UI file belongs in the analysis module",
    test: (p) => p.startsWith("modules/ee/analysis/") && p.endsWith(".tsx"),
  },
];

const SOURCE_EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];
const IMPORT_PATTERN =
  /(?:import|export)\s+(?:type\s+)?(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

const resolveSpecifier = (root: string, specifier: string, from: string): string | null => {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(root, specifier.slice(2));
  else if (specifier.startsWith("./") || specifier.startsWith("../"))
    base = path.resolve(path.dirname(from), specifier);
  else return null; // a package: not ours to delete

  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  const withExtension = SOURCE_EXTENSIONS.map((extension) => base + extension).find((candidate) =>
    fs.existsSync(candidate)
  );
  return withExtension ?? null;
};

/** Every repo file reachable from `entries`, as paths relative to `root`, each with the file that first imported it. */
const importClosure = (root: string, entries: string[]): Map<string, string | null> => {
  const importedBy = new Map<string, string | null>();
  const queue: [string, string | null][] = entries.map((entry) => [path.resolve(root, entry), null]);

  for (let next = queue.shift(); next; next = queue.shift()) {
    const [file, parent] = next;
    const key = path.relative(root, file);
    if (importedBy.has(key)) continue;
    importedBy.set(key, parent);

    for (const match of fs.readFileSync(file, "utf8").matchAll(IMPORT_PATTERN)) {
      const resolved = resolveSpecifier(root, match[1] ?? match[2], file);
      if (resolved) queue.push([resolved, key]);
    }
  }
  return importedBy;
};

const violations = (closure: Map<string, string | null>): string[] =>
  [...closure.keys()].flatMap((file) =>
    FORBIDDEN.filter((rule) => rule.test(file)).map(
      (rule) => `${file} (${rule.why}), imported by ${closure.get(file)}`
    )
  );

describe("feedback query import closure", () => {
  test.each([
    "app/api/v3/feedback-queries/route.ts",
    "app/api/v3/feedback-queries/field-catalog/route.ts",
    "modules/mcp/tools/feedback-queries.ts",
  ])("%s reaches no dashboard, chart or analysis UI file", (entry) => {
    const closure = importClosure(WEB_ROOT, [entry]);

    // Guards the walk itself: an empty or one-file closure would pass the assertion below vacuously.
    expect(closure.has("modules/ee/analysis/api/lib/cube-client.ts")).toBe(true);
    expect(closure.has("modules/ee/analysis/lib/schema-definition.ts")).toBe(true);
    expect(violations(closure)).toEqual([]);
  });
});

describe("the import walk", () => {
  const roots: string[] = [];
  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  const fixture = (files: Record<string, string>): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "closure-"));
    roots.push(root);
    for (const [name, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      fs.writeFileSync(path.join(root, name), content);
    }
    return root;
  };

  test("finds a chart component reached through a relative import, an alias and a dynamic import", () => {
    const root = fixture({
      "entry.ts": 'import { a } from "./lib/a";\nexport const x = a;',
      "lib/a.ts": 'export { b } from "@/modules/ee/analysis/lib/b";',
      "modules/ee/analysis/lib/b.ts":
        'export const b = () => import("@/modules/ee/analysis/charts/components/chart");',
      "modules/ee/analysis/charts/components/chart.tsx": "export const Chart = null;",
    });

    const found = violations(importClosure(root, ["entry.ts"]));

    expect(found.join("\n")).toContain("modules/ee/analysis/charts/components/chart.tsx");
    expect(found.join("\n")).toContain("modules/ee/analysis/lib/b.ts");
  });

  test("passes a closure that stays clear, and ignores packages", () => {
    const root = fixture({
      "entry.ts": 'import { z } from "zod";\nimport "./lib/a";',
      "lib/a.ts": "export const a = 1;",
    });

    expect(violations(importClosure(root, ["entry.ts"]))).toEqual([]);
  });
});
