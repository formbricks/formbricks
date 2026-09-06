import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

// The brain bundle reaches production only as a side effect of the web app's
// build graph: apps/web declares this package as a dependency, so turbo's
// `^build` builds it and the copy plugin drops the bundle into
// apps/web/public/js/mobile/v1/. Nothing fails loudly if that edge is removed
// — deployed servers just 404 the bundle and every mobile shell silently falls
// back to native logic. These assertions make that removal a red test instead.

const repoRoot = resolve(__dirname, "../../..");

const readJson = <T>(relativePath: string): T =>
  JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8")) as T;

describe("mobile-core serving wiring", () => {
  test("apps/web depends on this package so ^build produces the bundle", () => {
    const webPackage = readJson<{ dependencies?: Record<string, string> }>("apps/web/package.json");
    expect(webPackage.dependencies?.["@formbricks/mobile-core"]).toBe("workspace:*");
  });

  test("this package has a build script for turbo to run", () => {
    const ownPackage = readJson<{ scripts?: Record<string, string> }>("packages/mobile-core/package.json");
    expect(ownPackage.scripts?.build).toBeDefined();
  });
});
