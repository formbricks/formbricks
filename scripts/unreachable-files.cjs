// Reachability of apps/web source files from Next entry points (pages, layouts, routes, proxy,
// instrumentation, scripts). A file nothing reaches is dead code; a test is live when its subject is.
// Run it before deleting a module and again after, so a file that is still imported is not removed.
//
// usage: node scripts/unreachable-files.cjs [--unreachable] [--drop prefix1,prefix2]
//                                          [--entries-extra file1,file2] [--why <path under apps/web>]
//                                          [--coupled]
//   (no flag)        counts: total, entries, reachable, unreachable
//   --unreachable    lists the unreachable files
//   --drop           treats the listed apps/web prefixes as deleted and shows what would become unreachable;
//                    --coupled then lists the surviving files that still import them
//   --why <path>     prints the import chain that keeps a file reachable
const path = require("path");
const fs = require("fs");
const web = path.resolve(__dirname, "..", "apps", "web");
const ts = require(require.resolve("typescript", { paths: [web] }));

const cfgPath = path.join(web, "tsconfig.json");
const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, web);
const options = { ...parsed.options, allowImportingTsExtensions: true };

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".next",
  "coverage",
  "public",
  "locales",
  ".next-docs",
  "vendor",
]);
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(e.name)) out.push(p);
  }
  return out;
}
const all = walk(web, []);
const isTest = (f) =>
  /\.(test|spec)\.(ts|tsx)$/.test(f) || /\/__tests__\//.test(f) || /\/__mocks__\//.test(f);
const src = all.filter((f) => !isTest(f));
const tests = all.filter((f) => isTest(f));

const entryRe =
  /\/(page|layout|route|error|not-found|loading|global-error|default|template|opengraph-image|icon|sitemap|robots|manifest)\.(tsx?|jsx?)$/;
const entries = new Set();
for (const f of src) {
  const rel = path.relative(web, f);
  if (rel.startsWith("app/") && entryRe.test("/" + rel)) entries.add(f);
  if (
    /^(proxy|middleware|instrumentation[^/]*|sentry\.[^/]*|next\.config\.mjs|vite\.[^/]*|vitest[^/]*)\.[mc]?[tj]s$/.test(
      rel
    )
  )
    entries.add(f);
  if (rel.startsWith("scripts/")) entries.add(f);
}
const exIdx = process.argv.indexOf("--drop");
if (exIdx > 0) {
  const prefixes = process.argv[exIdx + 1].split(",");
  for (const e of [...entries]) {
    const rel = path.relative(web, e);
    if (prefixes.some((p) => rel.startsWith(p))) entries.delete(e);
  }
}
const extraIdx = process.argv.indexOf("--entries-extra");
if (extraIdx > 0) for (const e of process.argv[extraIdx + 1].split(",")) entries.add(path.join(web, e));

const DROP = exIdx > 0 ? process.argv[exIdx + 1].split(",") : [];
const cache = new Map();
function imports(file) {
  if (cache.has(file)) return cache.get(file);
  const text = fs.readFileSync(file, "utf8");
  const info = ts.preProcessFile(text, true, true);
  const names = new Set(info.importedFiles.map((i) => i.fileName));
  // new URL("./x", import.meta.url)
  for (const m of text.matchAll(/new URL\(\s*["'`](\.[^"'`]+)["'`]\s*,\s*import\.meta\.url/g))
    names.add(m[1]);
  cache.set(file, [...names]);
  return [...names];
}
const host = ts.sys;
function resolve(spec, from) {
  if (!spec.startsWith(".") && !spec.startsWith("@/")) return null;
  const r = ts.resolveModuleName(spec, from, options, host);
  const f = r.resolvedModule && r.resolvedModule.resolvedFileName;
  if (f && f.startsWith(web) && !f.includes("/node_modules/")) return f;
  return null;
}
const seen = new Set();
const stack = [...entries];
const parent = new Map();
while (stack.length) {
  const f = stack.pop();
  if (seen.has(f)) continue;
  seen.add(f);
  if (!fs.existsSync(f)) continue;
  for (const s of imports(f)) {
    const r = resolve(s, f);
    if (r && DROP.some((p) => path.relative(web, r).startsWith(p))) {
      (global.coupled ||= new Map()).set(path.relative(web, f) + " -> " + path.relative(web, r), 1);
      continue;
    }
    if (r && !seen.has(r)) {
      if (!parent.has(r)) parent.set(r, f);
      stack.push(r);
    }
  }
}
// live tests: a test is live when its subject (same stem) or any file it imports is reachable.
// Fixtures and mocks used by live tests then become reachable too. Iterate to a fixpoint.
const stemOf = (t) => t.replace(/\.(integration\.)?(test|spec)\.(tsx?|jsx?)$/, "");
const fixtureLike = (f) =>
  /(__mocks__|__mock__|__fixtures__|\/tests\/|\.mock\.|fixture|mock-data|\.d\.ts$)/.test(f);
const liveTests = new Set();
for (const t of tests) {
  const real = [];
  for (const s2 of imports(t)) {
    const r = resolve(s2, t);
    if (r && !fixtureLike(r) && !isTest(r)) real.push(r);
  }
  const live =
    real.length === 0
      ? [".ts", ".tsx", ".js", ".jsx", ".mts"].some((e) => seen.has(stemOf(t) + e))
      : real.every((r) => seen.has(r) || !fs.existsSync(r));
  if (live) liveTests.add(t);
}
for (const t of liveTests) {
  const st = [t];
  while (st.length) {
    const f = st.pop();
    if (seen.has(f) && f !== t) continue;
    seen.add(f);
    for (const s2 of imports(f)) {
      const r = resolve(s2, f);
      if (r && !seen.has(r) && !DROP.some((p) => path.relative(web, r).startsWith(p))) st.push(r);
    }
  }
}
if (process.argv.includes("--why")) {
  const target = path.join(web, process.argv[process.argv.indexOf("--why") + 1]);
  let cur = target;
  const chain = [];
  while (cur) {
    chain.push(path.relative(web, cur));
    cur = parent.get(cur);
  }
  console.log(chain.join("\n <- "));
  process.exit(0);
}
if (process.argv.includes("--coupled")) {
  for (const k of global.coupled || []) console.log(k[0]);
  process.exit(0);
}
const unreachable = all.filter((f) => !isTest(f)).filter((f) => !seen.has(f) && !entries.has(f));
if (process.argv.includes("--unreachable")) {
  for (const f of unreachable) console.log(path.relative(web, f));
} else {
  console.log(
    JSON.stringify({
      total: src.length,
      entries: entries.size,
      reachable: seen.size,
      unreachable: unreachable.length,
    })
  );
}
