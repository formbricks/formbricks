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

/** The variables `env.ts` reads that `text` does not mention and the baseline does not already list. */
const unwired = (keys: string[], text: string, listed: string[]) =>
  keys.filter((key) => !mentions(text, key) && !listed.includes(key));

/** Baseline entries to delete: wired since, or no longer read by `env.ts`. */
const stale = (keys: string[], text: string, listed: string[]) =>
  listed.filter((key) => mentions(text, key) || !keys.includes(key));

const keys = readEnvKeys();

// Fixed here rather than read from the baseline, so a file whose gaps are all fixed is still checked.
const WIRED_FILES = [
  ".env.example",
  "docker/docker-compose.yml",
  "docs/self-hosting/configuration/environment-variables.mdx",
] as const;
const listedFor = (file: (typeof WIRED_FILES)[number]): string[] =>
  (baseline as Record<string, string[] | undefined>)[file] ?? [];

describe("environment variable wiring", () => {
  test("finds the variables, so the checks below are checking something", () => {
    expect(keys.length).toBeGreaterThan(100);
  });

  test("the baseline names only the files checked here", () => {
    expect(Object.keys(baseline).sort()).toEqual([...WIRED_FILES].sort());
  });

  test.each(WIRED_FILES)("%s: every variable the app reads is wired, or already in the baseline", (file) => {
    const missing = unwired(keys, read(file), listedFor(file));
    expect(missing, `wire these through ${file} (docs/agents/self-hosting-config.md)`).toEqual([]);
  });

  test.each(WIRED_FILES)("%s: the baseline lists no variable that is wired or gone", (file) => {
    expect(
      stale(keys, read(file), listedFor(file)),
      "delete these from scripts/env-wiring-baseline.json"
    ).toEqual([]);
  });

  test("a new variable fails; a wired or removed one is reported as a stale baseline entry", () => {
    const text = "SMTP_HOST=\n";
    expect(unwired(["SMTP_HOST", "NEW_SETTING"], text, [])).toEqual(["NEW_SETTING"]);
    expect(stale(["SMTP_HOST"], text, ["SMTP_HOST", "REMOVED_SETTING"])).toEqual([
      "SMTP_HOST",
      "REMOVED_SETTING",
    ]);
  });
});
