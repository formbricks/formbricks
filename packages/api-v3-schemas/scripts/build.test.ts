import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { OUTPUT_PATH, buildModule } from "./build";

/**
 * The freshness check as a test: rebuilding from the committed bundle reproduces the committed module
 * byte for byte. `pnpm lint` runs the same comparison through the CLI; this one also runs in the test
 * job, and is what exercises the pipeline end to end rather than rule by rule.
 */
test("the committed module is exactly what the pipeline builds from the committed bundle", async () => {
  expect(await buildModule()).toBe(readFileSync(OUTPUT_PATH, "utf8"));
}, 30_000);
