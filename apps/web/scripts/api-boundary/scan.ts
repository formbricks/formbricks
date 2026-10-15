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

export type TRouteFile = {
  /** Relative to `apps/web`, e.g. `app/api/internal/api-keys/route.ts`. */
  file: string;
  /** The URL it serves: route groups dropped, dynamic segments as `{name}` (`{...path}` for catch-alls). */
  path: string;
  methods: THttpMethod[];
  /** The `auth` modes passed to `withV3ApiWrapper`, or `custom` for a handler that doesn't use it. */
  authModes: string[];
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

const readMethods = (source: string): THttpMethod[] => {
  const found = new Set<THttpMethod>();
  for (const method of HTTP_METHODS) {
    const declared = new RegExp(String.raw`^export\s+(const|async\s+function|function)\s+${method}\b`, "m");
    const reexported = new RegExp(String.raw`^export\s*\{[^}]*\b${method}\b[^}]*\}`, "m");
    if (declared.test(source) || reexported.test(source)) found.add(method);
  }
  return HTTP_METHODS.filter((method) => found.has(method));
};

const byText = (a: string, b: string) => a.localeCompare(b);

/** A route's auth modes; the wrapper's default when no `auth` is given is "both". */
const resolveAuthModes = (usesWrapper: boolean, declared: string[]): string[] => {
  if (!usesWrapper) return ["custom"];
  return declared.length > 0 ? declared.toSorted(byText) : ["both"];
};

/** Every `route.ts` under `app/api`. */
export const listRouteFiles = (): TRouteFile[] =>
  listSourceFiles()
    .filter((file) => file.startsWith("app/api/") && /\/route\.tsx?$/.test(file))
    .map((file) => {
      const source = read(file);
      const usesWrapper = source.includes("withV3ApiWrapper(");
      const authModes = usesWrapper
        ? [...new Set([...source.matchAll(/\bauth:\s*"([a-zA-Z]+)"/g)].map((match) => match[1]))]
        : [];
      return {
        file,
        path: toUrlPath(file),
        methods: readMethods(source),
        authModes: resolveAuthModes(usesWrapper, authModes),
        usesWrapper,
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
export const normalizePathParams = (path: string) => path.replace(/\{[^}]+\}/g, "{}");

// --- Server actions ------------------------------------------------------------------------------------

const ACTION_EXPORT = /^export const (\w+)\s*=\s*(?:authenticatedActionClient|actionClient)\b/gm;
const USE_SERVER = /^\s*["']use server["'];?/;
const USE_CLIENT = /^\s*["']use client["'];?/;

export type TServerActionCensus = {
  /** `file → exported action names`, for every `"use server"` module. */
  actionsByFile: Map<string, string[]>;
  total: number;
};

/** Every exported server action: `next-safe-action` clients and plain exported `"use server"` functions. */
export const countServerActions = (): TServerActionCensus => {
  const actionsByFile = new Map<string, string[]>();
  for (const file of listSourceFiles()) {
    const source = read(file);
    if (!USE_SERVER.test(source)) continue;
    const names = [
      ...[...source.matchAll(ACTION_EXPORT)].map((match) => match[1]),
      ...[...source.matchAll(/^export\s+async\s+function\s+(\w+)/gm)].map((match) => match[1]),
    ];
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
