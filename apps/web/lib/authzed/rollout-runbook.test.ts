import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { AUTHZED_AUTHORIZATION_ROLLOUT_TARGETS } from "./rollout-contract";

/**
 * The runbook's "Valid targets" block is what an operator configures from, and nothing kept it in
 * step with the contract: `page:user` was added by ENG-2388 and both `feedback_gateway` targets
 * before it, and the block listed none of the three. A target the runbook omits is a surface an
 * operator cannot discover, which is the same failure either way — so assert the block rather than
 * trusting the next author to remember.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const RUNBOOK_PATH = path.resolve(here, "../../../../authzed/RUNBOOK.md");

const readDocumentedTargets = (): ReadonlyArray<string> => {
  const runbook = readFileSync(RUNBOOK_PATH, "utf8");
  const block = /Valid targets are:\s*```text\n([\s\S]*?)```/.exec(runbook);
  if (!block) throw new Error('Could not find the "Valid targets" block in authzed/RUNBOOK.md');
  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
};

describe("AuthZed rollout targets are documented", () => {
  test("the runbook lists exactly the supported targets, in contract order", () => {
    // Order too: the block reads as the contract, and a silently reordered list is harder to diff
    // against the constant when a reviewer is checking whether a new surface was added.
    expect(readDocumentedTargets()).toEqual([...AUTHZED_AUTHORIZATION_ROLLOUT_TARGETS]);
  });

  test("the assertion actually reads the runbook", () => {
    // Guards the regex: if the heading or fence is renamed, readDocumentedTargets must throw rather
    // than quietly return nothing and let the comparison above pass against an empty list.
    expect(readDocumentedTargets().length).toBeGreaterThan(0);
    expect(readDocumentedTargets()).toContain("page:user");
  });
});
