import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

/*
 * A disable directive that suppresses nothing fails lint (`reportUnusedDisableDirectives` in the root
 * oxlint.config.ts, ENG-7329). oxlint reads that option from the root config only, so the fixture is
 * linted from the repo root rather than through `lintFixtures`, which runs inside a workspace.
 */

const root = fileURLToPath(new URL("..", import.meta.url));

describe("stale disable directives", () => {
  test("are reported as errors", () => {
    const fixtureDir = mkdtempSync(path.join(root, "oxlint-fixtures-"));
    try {
      const file = path.join(fixtureDir, "stale.ts");
      writeFileSync(
        file,
        "// eslint-disable-next-line no-console -- nothing to suppress\nexport const a = 1;\n"
      );
      const { stdout, stderr, status } = spawnSync(
        process.execPath,
        [`${root}node_modules/oxlint/bin/oxlint`, "--format", "json", file],
        {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, NODE_OPTIONS: "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON" },
        }
      );
      expect(status, stderr).toBe(1);
      const { diagnostics } = JSON.parse(stdout) as {
        diagnostics: { severity: string; message: string }[];
      };
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          severity: "error",
          message: expect.stringContaining("Unused eslint-disable"),
        })
      );
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  }, 30_000);
});
