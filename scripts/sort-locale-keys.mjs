#!/usr/bin/env node
// Keeps the keys of every locale JSON file sorted at every level. oxfmt formats these files but does not
// sort JSON keys, and sorted keys are what keep parallel PRs that add strings from all colliding at the
// end of en-US.json (docs/adr/0041-oxfmt-formats-the-repo.md). Only locale files: other JSON keeps the
// order its authors chose.
//
//   node scripts/sort-locale-keys.mjs [files…]          sort the given files, or every locale file
//   node scripts/sort-locale-keys.mjs --check [files…]  fail if any of them is unsorted (CI)
//
// `pnpm format` and the lint-staged hook run it before oxfmt, so oxfmt formats what this writes.
// Keys sort by UTF-16 code unit (uppercase before lowercase), as scripts/i18n-merge.mjs writes them.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LOCALE_FILES = ["apps/web/locales/*.json", "packages/surveys/locales/*.json"];

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const isSorted = (keys) => keys.every((key, index) => index === 0 || keys[index - 1] <= key);

/** Dotted paths of the objects whose keys are not sorted; `(root)` for the top level. */
export const findUnsortedKeyPaths = (value, path = "") => {
  if (!isObject(value)) return [];
  const keys = Object.keys(value);
  const own = isSorted(keys) ? [] : [path || "(root)"];
  return [...own, ...keys.flatMap((key) => findUnsortedKeyPaths(value[key], path ? `${path}.${key}` : key))];
};

/** A copy of `value` with the keys of every object sorted. */
export const sortKeysDeep = (value) => {
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeysDeep(value[key])])
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const named = args.filter((arg) => arg !== "--check");
  const files =
    named.length > 0
      ? named
      : execFileSync("git", ["ls-files", "--", ...LOCALE_FILES], { encoding: "utf8" })
          .split("\n")
          .filter(Boolean);

  let unsorted = 0;
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const paths = findUnsortedKeyPaths(parsed);
    if (paths.length === 0) continue;
    unsorted += 1;
    if (check) {
      console.error(`${file}: keys out of order in ${paths.join(", ")}`);
    } else {
      writeFileSync(file, `${JSON.stringify(sortKeysDeep(parsed), null, 2)}\n`);
    }
  }
  if (check && unsorted > 0) {
    console.error("Locale keys must be sorted. Run `pnpm format` to sort them.");
    process.exit(1);
  }
}
