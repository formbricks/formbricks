import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";

// Every value exported from a module whose first statement is "use server" is a Server Function, and
// Next.js may register it as a Server Action (see .next/server/server-reference-manifest.json) whether
// it is used from a Client Component or a Server Component. Which exports get registered shifts with
// the import graph, so this rule is structural rather than based on one build's manifest.
//
// Actions are built from `actionClient` / `authenticatedActionClient` (lib/utils/action-client), which
// validate input and, for the latter, resolve the session. Plain service and helper modules use
// `import "server-only"` instead of "use server".
//
// Type-only exports are erased at compile time and are always fine.

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");

const ACTION_CLIENT_MODULE = "@/lib/utils/action-client";
const ACTION_CLIENTS = new Set(["actionClient", "authenticatedActionClient"]);
const SKIPPED_DIRS = new Set(["node_modules", ".next", "dist", "coverage", "public", "playwright"]);

// "file:exportName" entries that are allowed to break the rule, each with its reason. The guard also
// fails on an entry that no longer matches anything, so the list cannot outlive its reasons.
const ALLOWED_RAW_EXPORTS = new Map<string, string>([
  [
    "lib/membership/hooks/actions.ts:getMembershipByUserIdOrganizationIdAction",
    "Moves to the action client in ENG-3419; drop this entry with that change.",
  ],
  [
    "lib/membership/hooks/actions.ts:getMembershipRole",
    "Moves to the action client in ENG-3419; drop this entry with that change.",
  ],
]);

const listSourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return SKIPPED_DIRS.has(entry.name) ? [] : listSourceFiles(path.join(dir, entry.name));
    }
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")
      ? [path.join(dir, entry.name)]
      : [];
  });

const hasUseServerDirective = (sourceFile: ts.SourceFile): boolean => {
  const first = sourceFile.statements[0];
  return (
    first !== undefined &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === "use server"
  );
};

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined)?.some((m) => m.kind === kind) ?? false;

// Local names bound to the shared action clients by `import { … } from "@/lib/utils/action-client"`,
// aliases included. A module-level declaration cannot reuse an imported name, so a locally defined
// `actionClient` is never in this set.
const getActionClientBindings = (sourceFile: ts.SourceFile): Set<string> => {
  const bindings = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== ACTION_CLIENT_MODULE
    ) {
      continue;
    }
    const namedBindings = statement.importClause?.namedBindings;
    if (statement.importClause?.isTypeOnly || !namedBindings || !ts.isNamedImports(namedBindings)) continue;
    for (const element of namedBindings.elements) {
      const importedName = (element.propertyName ?? element.name).text;
      if (!element.isTypeOnly && ACTION_CLIENTS.has(importedName)) bindings.add(element.name.text);
    }
  }
  return bindings;
};

// True for `authenticatedActionClient.inputSchema(...).action(...)` and friends: a call to `.action()`
// whose chain starts at a binding imported from the shared action-client module.
const isActionClientAction = (expression: ts.Expression, clientBindings: Set<string>): boolean => {
  if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) {
    return false;
  }
  if (expression.expression.name.text !== "action") return false;

  let node: ts.Expression = expression.expression.expression;
  while (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node)) {
    node = node.expression;
  }
  return ts.isIdentifier(node) && clientBindings.has(node.text);
};

// Returns the names of runtime exports that are not built from an action client.
const findRawExports = (sourceFile: ts.SourceFile): string[] => {
  const raw: string[] = [];
  const clientBindings = getActionClientBindings(sourceFile);

  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;

    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      if (!statement.exportClause) {
        raw.push(`* from ${statement.moduleSpecifier?.getText(sourceFile)}`);
        continue;
      }
      if (ts.isNamespaceExport(statement.exportClause)) {
        raw.push(statement.exportClause.name.text);
        continue;
      }
      for (const element of statement.exportClause.elements) {
        if (!element.isTypeOnly) raw.push(element.name.text);
      }
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      raw.push("default");
      continue;
    }

    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (declaration.initializer && isActionClientAction(declaration.initializer, clientBindings))
          continue;
        raw.push(declaration.name.getText(sourceFile));
      }
      continue;
    }

    if (ts.isEnumDeclaration(statement) && hasModifier(statement, ts.SyntaxKind.ConstKeyword)) continue;

    const name = (statement as ts.DeclarationStatement).name?.getText(sourceFile);
    raw.push(isDefault ? "default" : (name ?? "<anonymous>"));
  }

  return raw;
};

const parse = (fileName: string, source: string): ts.SourceFile =>
  ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

const rawExportsOf = (source: string, fileName = "fixture.ts"): string[] => {
  const sourceFile = parse(fileName, source);
  return hasUseServerDirective(sourceFile) ? findRawExports(sourceFile) : [];
};

describe("use server export detection", () => {
  test("accepts actions built from the action clients and type-only exports", () => {
    const source = `"use server";
      import { z } from "zod";
      import { actionClient, authenticatedActionClient as authed } from "@/lib/utils/action-client";
      export type TInput = { id: string };
      export interface TOther { id: string }
      export type { TThird } from "./types";
      export const a = authed.inputSchema(z.object({})).action(async () => {});
      export const b = actionClient.action(async () => {});
      const helper = async () => {};`;
    expect(rawExportsOf(source)).toEqual([]);
  });

  test("flags every other runtime export", () => {
    const source = `"use server";
      import { authenticatedActionClient } from "@/lib/utils/action-client";
      export const getThing = reactCache(async (id: string) => id);
      export const deleteThing = async (id: string) => {};
      export async function updateThing() {}
      export default async function init() {}
      export const notAnAction = authenticatedActionClient.inputSchema(schema);
      export const wrapped = someOtherClient.action(async () => {});
      const local = async () => {};
      export { local };
      export { remote } from "./remote";
      export * from "./everything";`;
    expect(rawExportsOf(source)).toEqual([
      "getThing",
      "deleteThing",
      "updateThing",
      "default",
      "notAnAction",
      "wrapped",
      "local",
      "remote",
      '* from "./everything"',
    ]);
  });

  test("flags actions built from a client that is not the shared one", () => {
    const local = `"use server";
      import { createSafeActionClient } from "next-safe-action";
      const actionClient = createSafeActionClient();
      export const unsafe = actionClient.action(async () => {});`;
    const elsewhere = `"use server";
      import { authenticatedActionClient } from "./my-client";
      import type { actionClient } from "@/lib/utils/action-client";
      export const unsafe = authenticatedActionClient.action(async () => {});`;
    expect(rawExportsOf(local)).toEqual(["unsafe"]);
    expect(rawExportsOf(elsewhere)).toEqual(["unsafe"]);
  });

  test("flags a default-exported page component", () => {
    const source = `"use server";
      export const Page = async () => <div />;
      export default Page;`;
    expect(rawExportsOf(source, "page.tsx")).toEqual(["Page", "default"]);
  });

  test("ignores modules without a leading use server directive", () => {
    expect(rawExportsOf(`import "server-only";\nexport const getThing = async () => {};`)).toEqual([]);
    expect(rawExportsOf(`const x = 1;\n"use server";\nexport const getThing = async () => {};`)).toEqual([]);
  });
});

describe('"use server" modules in apps/web', () => {
  const rawExports = listSourceFiles(webRoot)
    .filter((file) => !/\.test\.tsx?$/.test(file))
    .flatMap((file) => {
      const sourceFile = parse(file, fs.readFileSync(file, "utf-8"));
      if (!hasUseServerDirective(sourceFile)) return [];
      const relative = path.relative(webRoot, file).split(path.sep).join("/");
      return findRawExports(sourceFile).map((name) => `${relative}:${name}`);
    });

  test("export only actions built from the action client", () => {
    expect(
      rawExports.filter((entry) => !ALLOWED_RAW_EXPORTS.has(entry)),
      'Exports of a "use server" module must be built from the action client. Wrap them in authenticatedActionClient, ' +
        'or move them to a module that uses import "server-only" instead of "use server".'
    ).toEqual([]);
  });

  test("keeps no stale exceptions", () => {
    expect([...ALLOWED_RAW_EXPORTS.keys()].filter((entry) => !rawExports.includes(entry))).toEqual([]);
  });
});
