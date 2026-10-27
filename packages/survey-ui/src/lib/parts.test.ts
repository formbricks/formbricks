import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { FB_PARTS } from "./parts";

// The customer page that documents the hooks. Customers copy selectors from it, so a name that is
// rendered but undocumented — or documented but never rendered — is a broken contract.
const customerDocs = readFileSync(
  new URL("../../../../docs/surveys/general-features/custom-css.mdx", import.meta.url),
  "utf8"
);

describe("FB_PART", () => {
  test("declares each hook name once, in kebab-case", () => {
    expect(new Set(FB_PARTS).size).toBe(FB_PARTS.length);
    for (const part of FB_PARTS) {
      expect(part).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    }
  });

  test("matches the hook names in the customer documentation", () => {
    const documented = new Set(
      Array.from(customerDocs.matchAll(/data-fb-part="([^"]+)"/g), (match) => match[1])
    );
    expect([...documented].sort()).toEqual([...FB_PARTS].sort());
  });
});
