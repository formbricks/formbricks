/**
 * Generates `src/generated/zod.gen.ts` from the committed v3 OpenAPI bundle.
 *
 *   pnpm api:v3:schemas         # regenerate (after editing docs/api-v3-reference/src/, use `pnpm api:v3:sync`)
 *   pnpm api:v3:schemas:check   # fail if the committed module is stale; part of `pnpm lint`
 *
 * The check runs the same pipeline as generation and compares bytes, so formatting is part of what it
 * verifies.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { BUNDLE_PATH } from "../src/testing/bundle";
import { OUTPUT_PATH, REPO_ROOT, buildModule } from "./build";

const firstDifference = (a: string, b: string): number => {
  const left = a.split("\n");
  const right = b.split("\n");
  const index = left.findIndex((line, i) => line !== right[i]);
  return (index === -1 ? Math.min(left.length, right.length) : index) + 1;
};

const main = async (): Promise<void> => {
  const check = process.argv.includes("--check");
  const display = relative(REPO_ROOT, OUTPUT_PATH);
  const generated = await buildModule();

  if (!check) {
    writeFileSync(OUTPUT_PATH, generated);
    console.log(`✓ generated ${display} from ${relative(REPO_ROOT, BUNDLE_PATH)}`);
    return;
  }

  let committed: string;
  try {
    committed = readFileSync(OUTPUT_PATH, "utf8");
  } catch {
    committed = "";
  }
  if (committed !== generated) {
    console.error(
      `✗ ${display} is out of sync with ${relative(REPO_ROOT, BUNDLE_PATH)} (first difference at line ${firstDifference(committed, generated)}).\n` +
        "  Run `pnpm api:v3:schemas` and commit the result (or `pnpm api:v3:sync` after editing docs/api-v3-reference/src/)."
    );
    process.exitCode = 1;
    return;
  }
  console.log(`✓ ${display} is in sync with the v3 bundle.`);
};

await main();
