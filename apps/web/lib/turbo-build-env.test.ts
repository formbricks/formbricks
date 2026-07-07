import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

// Guards the coupling between next.config.mjs and turbo.json (see ENG-1663): every env var read in
// next.config.mjs shapes the build output, so it must be part of Turborepo's cache key. A var that
// is missing from `build.env` (or filed under `passThroughEnv`) makes Turborepo — including the CI
// remote cache — replay stale builds when the var's value changes.

const here = path.dirname(fileURLToPath(import.meta.url));
const nextConfigPath = path.resolve(here, "..", "next.config.mjs");
const turboJsonPath = path.resolve(here, "..", "..", "..", "turbo.json");

const getProcessEnvReads = (source: string): string[] => {
  const reads = new Set<string>();
  const pattern = /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g;
  for (const match of source.matchAll(pattern)) {
    reads.add(match[1]);
  }
  return [...reads].sort();
};

describe("turbo.json build.env stays in sync with next.config.mjs", () => {
  const nextConfigSource = fs.readFileSync(nextConfigPath, "utf-8");
  const turboJson = JSON.parse(fs.readFileSync(turboJsonPath, "utf-8")) as {
    tasks: { build: { env: string[]; passThroughEnv?: string[] } };
  };
  const buildEnv = turboJson.tasks.build.env;
  const passThroughEnv = turboJson.tasks.build.passThroughEnv ?? [];

  test("every process.env read in next.config.mjs is hashed via build.env", () => {
    const reads = getProcessEnvReads(nextConfigSource);
    expect(reads.length).toBeGreaterThan(0);

    const missing = reads.filter((name) => !buildEnv.includes(name));
    expect(
      missing,
      `next.config.mjs reads env var(s) not hashed in turbo.json build.env: ${missing.join(", ")}. ` +
        "Add them to the build task's `env` array (NOT `passThroughEnv`), or cached builds go stale."
    ).toEqual([]);
  });

  test("no var is listed in both env and passThroughEnv", () => {
    const overlap = buildEnv.filter((name) => passThroughEnv.includes(name));
    expect(overlap).toEqual([]);
  });
});
