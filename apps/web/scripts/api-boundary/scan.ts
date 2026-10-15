import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Static scans behind the API boundary guard (`api-boundary.test.ts`) and the internal route inventory
 * (`internal-route-inventory.ts`). Plain file reads, no module loading: route modules pull in `server-only`
 * and the whole app, and none of that is needed to answer "where does this route live and how does it
 * authenticate".
 */

/** `apps/web`, resolved from this file rather than the working directory. */
export const WEB_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const REPO_ROOT = resolve(WEB_ROOT, "../..");
const OPENAPI_BUNDLE = join(REPO_ROOT, "docs/api-v3-reference/openapi.yml");

const SOURCE_EXTENSIONS = [".ts", ".tsx"];
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".next", "playwright", "coverage", "dist"]);

const toPosix = (path: string) => path.split(sep).join("/");

const walk = (directory: string, files: string[] = []): string[] => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(join(directory, entry.name), files);
    } else if (SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      files.push(join(directory, entry.name));
    }
  }
  return files;
};

const isTestFile = (file: string) => /\.(test|spec)\.tsx?$/.test(file) || file.includes("/__mocks__/");

/** Every non-test source file under `apps/web`, as paths relative to it. */
const listSourceFiles = (): string[] =>
  walk(WEB_ROOT)
    .map((file) => toPosix(relative(WEB_ROOT, file)))
    .filter((file) => !isTestFile(file));

const read = (file: string) => readFileSync(join(WEB_ROOT, file), "utf8");

// --- Routes -------------------------------------------------------------------------------------------

const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
export type THttpMethod = (typeof HTTP_METHODS)[number];

/** One exported method handler. */
export type TRouteHandler = {
  method: THttpMethod;
  /** Whether the export is `withV3ApiWrapper({ … })` itself, rather than a function or a re-export. */
  usesWrapper: boolean;
  /** The `auth` mode passed to that wrapper (its default, "both", when none is), or `custom`. */
  authMode: string;
};

export type TRouteFile = {
  /** Relative to `apps/web`, e.g. `app/api/internal/api-keys/route.ts`. */
  file: string;
  /** The URL it serves: route groups dropped, dynamic segments as `{name}` (`{...path}` for catch-alls). */
  path: string;
  methods: THttpMethod[];
  handlers: TRouteHandler[];
  /** Every handler's auth mode, deduplicated and sorted, for the inventory. */
  authModes: string[];
  /** Whether every handler goes through `withV3ApiWrapper`. */
  usesWrapper: boolean;
};

const toUrlPath = (file: string): string =>
  "/" +
  file
    .replace(/^app\//, "")
    .replace(/\/route\.tsx?$/, "")
    .split("/")
    .filter((segment) => !/^\(.+\)$/.test(segment))
    .map((segment) =>
      segment.replace(
        /^\[\[?(\.\.\.)?([^\]]+)\]?\]$/,
        (_m, rest: string | undefined, name: string) => `{${rest ?? ""}${name}}`
      )
    )
    .join("/");

/** The names an `export { … }` list makes public: `GET`, and `handler as GET` → `GET`. */
const readReexportedNames = (source: string): Set<string> => {
  const names = new Set<string>();
  for (const match of source.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const entry of match[1].split(",")) {
      // The exported name is the last word: `GET` itself, or the alias in `handler as GET`.
      const name = entry.trim().split(/\s+/).pop();
      if (name) names.add(name);
    }
  }
  return names;
};

/**
 * The source with its comments blanked out, so a commented-out handler or an `auth:` in a doc comment
 * counts for nothing. A linear scan rather than a regex: string and template literals are skipped intact,
 * so a `//` inside a URL string is not mistaken for a comment.
 */
export const stripComments = (source: string): string => {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i++;
    } else if (char === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      // Keep the comment's line breaks, so line numbers in the result still match the source.
      out += " " + "\n".repeat(source.slice(i, stop).split("\n").length - 1);
      i = stop;
    } else if (char === '"' || char === "'" || char === "`") {
      let j = i + 1;
      while (j < source.length && source[j] !== char) j += source[j] === "\\" ? 2 : 1;
      out += source.slice(i, j + 1);
      i = j + 1;
    } else {
      out += char;
      i++;
    }
  }
  return out;
};

/** Each top-level `export` statement, from its keyword to the next one. */
const splitExports = (source: string): string[] => {
  const starts = [...source.matchAll(/^export\b/gm)].map((match) => match.index);
  return starts.map((start, index) => source.slice(start, starts[index + 1] ?? source.length));
};

const declaredMethod = (statement: string): THttpMethod | undefined => {
  const name = /^export\s+(?:const|async\s+function|function)\s+(\w+)/.exec(statement)?.[1];
  return HTTP_METHODS.find((method) => method === name);
};

const describeHandler = (method: THttpMethod, statement: string): TRouteHandler => {
  const usesWrapper = new RegExp(String.raw`^export\s+const\s+${method}\s*=\s*withV3ApiWrapper\(`).test(
    statement
  );
  if (!usesWrapper) return { method, usesWrapper, authMode: "custom" };
  const declared = /\bauth:\s*"([a-zA-Z]+)"/.exec(statement)?.[1];
  // The wrapper's default, when a route names no mode, is "both".
  return { method, usesWrapper, authMode: declared ?? "both" };
};

/** A route's method handlers. A re-exported one (`export { GET }`) is opaque to this scan: `custom`. */
export const readHandlers = (source: string): TRouteHandler[] => {
  const code = stripComments(source);
  const handlers = new Map<THttpMethod, TRouteHandler>();
  for (const statement of splitExports(code)) {
    const method = declaredMethod(statement);
    if (method) handlers.set(method, describeHandler(method, statement));
  }
  for (const name of readReexportedNames(code)) {
    const method = HTTP_METHODS.find((candidate) => candidate === name);
    if (method) handlers.set(method, { method, usesWrapper: false, authMode: "custom" });
  }
  return HTTP_METHODS.flatMap((method) => handlers.get(method) ?? []);
};

const byText = (a: string, b: string) => a.localeCompare(b);

/** Every `route.ts` under `app/api`. */
export const listRouteFiles = (): TRouteFile[] =>
  listSourceFiles()
    .filter((file) => file.startsWith("app/api/") && /\/route\.tsx?$/.test(file))
    .map((file) => {
      const handlers = readHandlers(read(file));
      return {
        file,
        path: toUrlPath(file),
        methods: handlers.map((handler) => handler.method),
        handlers,
        authModes: [...new Set(handlers.map((handler) => handler.authMode))].toSorted(byText),
        usesWrapper: handlers.length > 0 && handlers.every((handler) => handler.usesWrapper),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

/** The paths published in the public v3 OpenAPI bundle, with `{param}` names normalized away. */
export const readPublicBundlePaths = (): Set<string> => {
  const bundle = readFileSync(OPENAPI_BUNDLE, "utf8");
  // A path is a key indented by exactly two spaces under `paths:` — `  /api/v3/...:`.
  const paths = bundle
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("  /") && !line.startsWith("   ") && line.endsWith(":"))
    .map((line) => line.slice(2, -1))
    .filter((path) => !/[\s:]/.test(path));
  return new Set(paths.map(normalizePathParams));
};

/** `/a/{x}/b` and `/a/{y}/b` are the same route: compare paths with parameter names erased. */
export const normalizePathParams = (path: string) =>
  path
    .split("/")
    .map((segment) => (segment.startsWith("{") && segment.endsWith("}") ? "{}" : segment))
    .join("/");

// --- Server actions ------------------------------------------------------------------------------------

const ACTION_EXPORT = /^export const (\w+)\s*=\s*(?:authenticatedActionClient|actionClient)\b/gm;
const USE_SERVER = /^\s*["']use server["'];?/;
/** A `"use server"` directive opening a function body rather than a module: an inline server action. */
const INLINE_USE_SERVER = /^[ \t]+["']use server["'];?[ \t]*$/gm;
const USE_CLIENT = /^\s*["']use client["'];?/;

export type TServerActionCensus = {
  /** `file → action names`, for every module that defines one; an inline action is named by its line. */
  actionsByFile: Map<string, string[]>;
  total: number;
};

const lineOf = (source: string, index: number) => source.slice(0, index).split("\n").length;

/** The server actions a module defines: exported ones in a `"use server"` module, inline ones anywhere. */
const readServerActions = (source: string): string[] => {
  if (USE_SERVER.test(source)) {
    return [
      ...[...source.matchAll(ACTION_EXPORT)].map((match) => match[1]),
      ...[...source.matchAll(/^export\s+async\s+function\s+(\w+)/gm)].map((match) => match[1]),
    ];
  }
  const code = stripComments(source);
  return [...code.matchAll(INLINE_USE_SERVER)].map(
    (match) => `inline action at line ${lineOf(code, match.index)}`
  );
};

/**
 * Every server action: `next-safe-action` clients and plain exported functions in `"use server"` modules,
 * and functions marked `"use server"` inline (in a server component, say).
 */
export const countServerActions = (): TServerActionCensus => {
  const actionsByFile = new Map<string, string[]>();
  for (const file of listSourceFiles()) {
    const names = readServerActions(read(file));
    if (names.length > 0) actionsByFile.set(file, names);
  }
  const total = [...actionsByFile.values()].reduce((sum, names) => sum + names.length, 0);
  return { actionsByFile, total };
};

/**
 * Client modules (`"use client"`) that import a server action module. A client module is the frontend; an
 * import of an action module is the frontend calling server code directly instead of going through the API.
 */
export const listClientActionImporters = (): string[] => {
  const actionModules = new Set(countServerActions().actionsByFile.keys());
  const importers: string[] = [];
  for (const file of listSourceFiles()) {
    const source = read(file);
    if (!USE_CLIENT.test(source)) continue;
    const specifiers = [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)].map((match) => match[1]);
    if (specifiers.some((specifier) => resolvesToActionModule(file, specifier, actionModules))) {
      importers.push(file);
    }
  }
  return importers.toSorted(byText);
};

const resolvesToActionModule = (fromFile: string, specifier: string, actionModules: Set<string>) => {
  let base: string;
  if (specifier.startsWith("@/")) base = specifier.slice(2);
  else if (specifier.startsWith(".")) base = toPosix(join(fromFile, "..", specifier));
  else return false;
  return SOURCE_EXTENSIONS.some(
    (extension) => actionModules.has(base + extension) || actionModules.has(`${base}/index${extension}`)
  );
};
