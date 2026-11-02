import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { isAllowedFile, mentionsLocalFolder, parseGitGrepOutput } from "./check-local-refs.mjs";

describe("mentionsLocalFolder", () => {
  test.each([
    ["a bare relative path", "See .local/plan.md for the rollout."],
    ["a dot-slash path", "// documented in ./.local/notes/cube.md"],
    ["a quoted path", 'const PLAN = ".local/plan.md";'],
    ["a backticked path", "the design lives in `.local/design.md`"],
    ["a path at the start of a line", ".local/scratch.ts"],
    ["a nested folder", "copy it to apps/web/.local/fixtures.json"],
    ["a glob", 'ignores: ["**/.local/**"]'],
    ["a match after a hostname on the same line", "https://cube.formbricks.local/ then .local/x.md"],
  ])("flags %s", (_label, line) => {
    expect(mentionsLocalFolder(line)).toBe(true);
  });

  test.each([
    ["a .local hostname", 'apiUrl: "https://cube.formbricks.local/cubejs-api/v1"'],
    ["another .local hostname", 'createRequest("http://internal.local/api/mcp")'],
    ["a .env.local file", "cp .env.example .env.local"],
    ["a *.local ignore glob", "*.local"],
    ["a longer name", "open .localstack/config"],
    ["the folder name without a path", "the .local folder"],
    ["the tilde home directory", 'export PATH="~/.local/bin:$PATH"'],
    ["$HOME", 'export PATH="$HOME/.local/bin:$PATH"'],
    ["${HOME}", "ENV PATH=${HOME}/.local/bin:$PATH"],
    ["/root", "RUN /root/.local/bin/uv sync"],
    ["/home/<user>", "COPY --from=build /home/node/.local/share /home/node/.local/share"],
  ])("ignores %s", (_label, line) => {
    expect(mentionsLocalFolder(line)).toBe(false);
  });
});

describe("isAllowedFile", () => {
  test.each([".gitignore", "apps/web/.gitignore", ".worktreeinclude", "packages/config-eslint/base.mjs"])(
    "allows %s",
    (path) => {
      expect(isAllowedFile(path)).toBe(true);
    }
  );

  test.each(["AGENTS.md", "packages/config-eslint/next.mjs", "docs/.gitignore.md"])("checks %s", (path) => {
    expect(isAllowedFile(path)).toBe(false);
  });
});

describe("parseGitGrepOutput", () => {
  test("keeps a colon inside the path or the text intact", () => {
    const output = "docs/a:b.md\x0012\x00see: .local/x.md\nREADME.md\x003\x00.local/y\n";

    expect(parseGitGrepOutput(output)).toEqual([
      { path: "docs/a:b.md", line: 12, text: "see: .local/x.md" },
      { path: "README.md", line: 3, text: ".local/y" },
    ]);
  });
});

describe("the check", () => {
  test("still reports a reference when the user's git config colours grep output", () => {
    // `color.grep=always` wraps each match in escape codes, and the `m` that closes the opening code
    // sits right before `.local/`, where the matcher reads it as a hostname character.
    const repository = mkdtempSync(join(tmpdir(), "formbricks-local-refs-"));
    try {
      mkdirSync(join(repository, "scripts"));
      copyFileSync(
        fileURLToPath(new URL("check-local-refs.mjs", import.meta.url)),
        join(repository, "scripts/check-local-refs.mjs")
      );
      writeFileSync(join(repository, "README.md"), "See .local/plan.md for the rollout.\n");
      execFileSync("git", ["init", "--quiet"], { cwd: repository });
      execFileSync("git", ["add", "."], { cwd: repository });

      const result = spawnSync(process.execPath, ["scripts/check-local-refs.mjs"], {
        cwd: repository,
        env: {
          ...process.env,
          GIT_CONFIG_COUNT: "1",
          GIT_CONFIG_KEY_0: "color.grep",
          GIT_CONFIG_VALUE_0: "always",
        },
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("README.md:1: See .local/plan.md");
    } finally {
      rmSync(repository, { recursive: true, force: true });
    }
  });
});
