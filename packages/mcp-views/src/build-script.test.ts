import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

// `pnpm build -- --only=<view>` runs the package script first. When the script cleared `dist` itself, every
// scoped build deleted the other views and the `index.js` the web app imports, and the web tests then failed
// to resolve the package. Clearing belongs to scripts/build.mjs, which does it for full builds only.
test("the build script leaves clearing dist to build.mjs", () => {
  const manifest = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  expect(manifest.scripts.build).not.toMatch(/rimraf|rm\s+-/);
  expect(readFileSync(path.join(__dirname, "..", "scripts", "build.mjs"), "utf8")).toMatch(
    /if \(!only\) \{\s*await rm\(distDir/
  );
});
