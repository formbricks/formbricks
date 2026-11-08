#!/usr/bin/env node
// Resolves the generated i18n files during a conflicted `git merge origin/main` (`pnpm i18n:merge`).
//
// Any long-lived branch that adds keys to an en-US locale conflicts with `main` in every generated
// locale JSON and in `i18n.lock`, because each side appended lines at the same spot. The files are
// machine-written (Lingo.dev) and are not hand-edited, so the conflict has one right answer: keep
// what each side changed relative to the merge base. This script computes it from the three index
// stages and stages the result.
//
// Covers `apps/web` and `packages/surveys`: `locales/*.json` and `i18n.lock`. Nothing else is
// touched; any other unmerged file stays for you.
//
//   * Locale JSON: recursive key-wise three-way merge, written with keys sorted at every level.
//   * i18n.lock: the same merge over its `key: hash` entries, written sorted by key.
//   * A key both sides changed to different values is a true conflict: `theirs` (main) is written,
//     the file is left unstaged, the key is reported, and the exit code is 1 so a person decides.
//
// Built for `git merge`, where stage 2 is your branch and stage 3 is main. During a rebase the two
// swap, so a reported "true conflict" would keep your commit's value instead.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

const MISSING = Symbol("missing");
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// Takes the side that changed relative to the base. When both changed to different values it
// keeps theirs and returns `conflict: true`.
const resolveLeaf = (base, ours, theirs) => {
  if (isDeepStrictEqual(ours, theirs)) return { value: ours, conflict: false };
  if (isDeepStrictEqual(ours, base)) return { value: theirs, conflict: false };
  if (isDeepStrictEqual(theirs, base)) return { value: ours, conflict: false };
  return { value: theirs, conflict: true };
};

const mergeNode = (base, ours, theirs, path, conflicts) => {
  if (isObject(ours) && isObject(theirs) && (isObject(base) || base === MISSING)) {
    const baseObject = isObject(base) ? base : {};
    const merged = {};
    const keys = new Set([...Object.keys(baseObject), ...Object.keys(ours), ...Object.keys(theirs)]);
    for (const key of [...keys].sort()) {
      const value = mergeNode(
        key in baseObject ? baseObject[key] : MISSING,
        key in ours ? ours[key] : MISSING,
        key in theirs ? theirs[key] : MISSING,
        path ? `${path}.${key}` : key,
        conflicts
      );
      if (value !== MISSING) merged[key] = value;
    }
    return merged;
  }
  const { value, conflict } = resolveLeaf(base, ours, theirs);
  if (conflict) conflicts.push(path);
  return value;
};

/** Three-way merge of parsed locale JSON. Returns the merged object (keys sorted) and conflicting key paths. */
export const mergeLocaleJson = (base, ours, theirs) => {
  const conflicts = [];
  const merged = mergeNode(base, ours, theirs, "", conflicts);
  return { merged, conflicts };
};

/** The serialisation the generated locale files round-trip through. */
export const serializeLocaleJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

const LOCK_ENTRY = /^ {4}(.+): ([0-9a-f]{32})$/;

const parseLock = (text) => {
  const header = [];
  const entries = new Map();
  for (const line of text.split("\n")) {
    const match = LOCK_ENTRY.exec(line);
    if (match) entries.set(match[1], match[2]);
    else if (line !== "") header.push(line);
  }
  return { header: header.join("\n"), entries };
};

/** Three-way merge of `i18n.lock` text: its `key: hash` entries merge key-wise and come out sorted by key. */
export const mergeI18nLock = (baseText, oursText, theirsText) => {
  const base = parseLock(baseText);
  const ours = parseLock(oursText);
  const theirs = parseLock(theirsText);
  const conflicts = [];

  const header = resolveLeaf(base.header, ours.header, theirs.header);
  if (header.conflict) conflicts.push("(lock header)");

  const keys = new Set([...base.entries.keys(), ...ours.entries.keys(), ...theirs.entries.keys()]);
  const lines = [];
  for (const key of [...keys].sort()) {
    const { value, conflict } = resolveLeaf(
      base.entries.get(key) ?? MISSING,
      ours.entries.get(key) ?? MISSING,
      theirs.entries.get(key) ?? MISSING
    );
    if (conflict) conflicts.push(key);
    if (value !== MISSING) lines.push(`    ${key}: ${value}`);
  }
  return { merged: `${header.value}\n${lines.join("\n")}\n`, conflicts };
};

const MERGEABLE = /^(?:apps\/web|packages\/surveys)\/(?:locales\/[^/]+\.json|i18n\.lock)$/;

export const isMergeablePath = (path) => MERGEABLE.test(path);

const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

// `git ls-files -u -z` lists `<mode> <sha> <stage>\t<path>` once per stage that exists.
const unmergedStages = (cwd) => {
  const byPath = new Map();
  for (const entry of git(cwd, "ls-files", "-u", "-z").split("\0")) {
    const match = /^\d+ [0-9a-f]+ ([123])\t(.+)$/.exec(entry);
    if (!match) continue;
    if (!byPath.has(match[2])) byPath.set(match[2], new Set());
    byPath.get(match[2]).add(Number(match[1]));
  }
  return byPath;
};

const mergeFile = (cwd, path, stages) => {
  const stage = (number) => (stages.has(number) ? git(cwd, "show", `:${number}:${path}`) : null);
  const [base, ours, theirs] = [stage(1), stage(2), stage(3)];
  if (ours === null || theirs === null) return null; // deleted on one side: a person decides
  if (path.endsWith(".json")) {
    const { merged, conflicts } = mergeLocaleJson(
      base === null ? {} : JSON.parse(base),
      JSON.parse(ours),
      JSON.parse(theirs)
    );
    return { text: serializeLocaleJson(merged), conflicts };
  }
  const { merged, conflicts } = mergeI18nLock(base ?? "", ours, theirs);
  return { text: merged, conflicts };
};

export const run = (cwd) => {
  const unmerged = unmergedStages(cwd);
  const mergeable = [...unmerged.keys()].filter(isMergeablePath).sort();
  const others = [...unmerged.keys()].filter((path) => !isMergeablePath(path)).sort();

  if (mergeable.length === 0) {
    console.log("No unmerged locale files or i18n.lock to resolve.");
    for (const path of others) console.log(`Still unmerged, resolve by hand: ${path}`);
    return others.length === 0 ? 0 : 1;
  }

  const skipped = [];
  const conflicted = [];
  for (const path of mergeable) {
    const result = mergeFile(cwd, path, unmerged.get(path));
    if (result === null) {
      skipped.push(path);
      continue;
    }
    writeFileSync(resolve(cwd, path), result.text);
    if (result.conflicts.length > 0) {
      conflicted.push({ path, keys: result.conflicts });
      console.log(`Conflict   ${path}`);
    } else {
      git(cwd, "add", "--", path);
      console.log(`Resolved   ${path}`);
    }
  }

  for (const path of skipped) console.log(`Skipped    ${path} (deleted on one side; resolve by hand)`);
  if (conflicted.length > 0) {
    console.log("\nTrue conflicts: both sides changed the same key to different values.");
    console.log("The file holds main's value and is not staged. Pick the value, then `git add` it.");
    for (const { path, keys } of conflicted) {
      console.log(`  ${path}`);
      for (const key of keys) console.log(`    ${key}`);
    }
  }
  for (const path of others) console.log(`Still unmerged, resolve by hand: ${path}`);

  if (conflicted.length > 0 || skipped.length > 0) return 1;
  const remaining = others.length > 0 ? " once the remaining files are resolved" : "";
  console.log(`\nNext: run \`pnpm i18n:validate\`, then commit the merge${remaining}.`);
  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  process.exit(run(root));
}
