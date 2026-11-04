import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, test } from "vitest";

// Unlike `<a target="_blank">`, `window.open()` does not imply `noopener`: the opened page gets a live
// `window.opener` handle and can navigate this tab to any URL (reverse tabnabbing). Every call in the app
// therefore passes `noopener` in its features argument. The rule is structural, so it checks the source
// rather than one rendered component.

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");

const SKIPPED_DIRS = new Set(["node_modules", ".next", "dist", "coverage", "public", "playwright"]);

const listSourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return SKIPPED_DIRS.has(entry.name) ? [] : listSourceFiles(path.join(dir, entry.name));
    }
    return /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts") &&
      !/\.test\.tsx?$/.test(entry.name)
      ? [path.join(dir, entry.name)]
      : [];
  });

// `window.open(…)` and `globalThis.window.open(…)`.
const isWindowOpen = (node: ts.CallExpression): boolean => {
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== "open") return false;
  const target = callee.expression;
  if (ts.isIdentifier(target)) return target.text === "window";
  return (
    ts.isPropertyAccessExpression(target) &&
    target.name.text === "window" &&
    ts.isIdentifier(target.expression) &&
    target.expression.text === "globalThis"
  );
};

const passesNoopener = (node: ts.CallExpression): boolean => {
  const features = node.arguments[2];
  return (
    features !== undefined &&
    (ts.isStringLiteral(features) || ts.isNoSubstitutionTemplateLiteral(features)) &&
    /(^|,)\s*noopener(\s*=\s*(yes|1|true))?\s*(,|$)/i.test(features.text)
  );
};

type TWindowOpenCall = { location: string; noopener: boolean };

const findWindowOpenCalls = (fileName: string, source: string): TWindowOpenCall[] => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const calls: TWindowOpenCall[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && isWindowOpen(node)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      calls.push({ location: `${fileName}:${line + 1}`, noopener: passesNoopener(node) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return calls;
};

describe("window.open noopener", () => {
  test("recognises the call shapes it guards and the features strings that satisfy it", () => {
    const calls = findWindowOpenCalls(
      "fixture.tsx",
      [
        `window.open(url, "_blank");`,
        `globalThis.window.open(url, "_blank");`,
        `window.open(url, "_blank", "noreferrer");`,
        `window.open(url, "_blank", "noopener,noreferrer");`,
        `globalThis.window.open(url, "_blank", "noopener");`,
        "window.open(url, `share`, `width=1,noopener=yes,noreferrer=yes`);",
        `dialog.open(url);`,
      ].join("\n")
    );

    expect(calls.map((call) => call.noopener)).toEqual([false, false, false, true, true, true]);
  });

  test("every window.open call in apps/web passes noopener", () => {
    const calls = listSourceFiles(webRoot).flatMap((file) =>
      findWindowOpenCalls(path.relative(webRoot, file), fs.readFileSync(file, "utf8"))
    );

    // The scan has to see the app's real call sites, or an empty result would pass vacuously.
    expect(calls.length).toBeGreaterThan(5);
    expect(calls.filter((call) => !call.noopener).map((call) => call.location)).toEqual([]);
  });
});
