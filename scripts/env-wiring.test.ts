import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import baseline from "./env-wiring-baseline.json";

/*
 * Every variable the web app reads is wired through the files self-hosters configure
 * (docs/agents/self-hosting-config.md, "Wiring an environment variable"). A variable missing from one of
 * them is silently ignored on a self-hosted install, and reviewers caught such misses by hand (#9670,
 * #10228).
 *
 * `env-wiring-baseline.json` holds the variables already missing from each file. It only ever shrinks: a
 * new variable is wired everywhere, and wiring a listed one, or removing it from `lib/env.ts`, deletes its
 * line from the baseline, which the second test enforces.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file: string) => readFileSync(`${root}${file}`, "utf8");

/** The variables `apps/web/lib/env.ts` maps in `runtimeEnv`. */
const readEnvKeys = () => {
  const source = read("apps/web/lib/env.ts");
  const runtimeEnv = source.slice(source.indexOf("runtimeEnv:"));
  return [...new Set([...runtimeEnv.matchAll(/^\s*([A-Z][A-Z0-9_]+):\s*process\.env/gm)].map((m) => m[1]))];
};

const mentions = (text: string, key: string) => new RegExp(`(?<![A-Z0-9_])${key}(?![A-Z0-9_])`).test(text);

const keys = readEnvKeys();
const wiredFiles = Object.keys(baseline) as (keyof typeof baseline)[];

describe("environment variable wiring", () => {
  test("finds the variables, so the checks below are checking something", () => {
    expect(keys.length).toBeGreaterThan(100);
  });

  test.each(wiredFiles)("%s: every variable the app reads is wired, or already in the baseline", (file) => {
    const text = read(file);
    const known = new Set<string>(baseline[file]);
    const missing = keys.filter((key) => !mentions(text, key) && !known.has(key));
    expect(missing, `wire these through ${file} (docs/agents/self-hosting-config.md)`).toEqual([]);
  });

  test.each(wiredFiles)("%s: the baseline lists no variable that is wired or gone", (file) => {
    const text = read(file);
    const stale = baseline[file].filter((key) => mentions(text, key) || !keys.includes(key));
    expect(stale, `delete these from scripts/env-wiring-baseline.json`).toEqual([]);
  });
});
