import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { STAGED_LINES_RULE_IDS } from "@formbricks/config-oxlint/sonar-parity";
import { type FixtureDiagnostic, lintFixtures } from "@formbricks/config-oxlint/testing";

/*
 * `formbricks/loggable-error` (packages/config-oxlint/plugins/formbricks.mjs): a caught error reaches the
 * logger through `loggableError`, never raw, because pino writes its message and a message can carry user
 * content (CODING_STANDARDS.md, "Errors"). Reviewers asked for this fix on seven of the last 100 merged PRs.
 *
 * About 450 existing calls log raw, so it is a staged-lines rule: the pre-commit hook fails a commit on it
 * only inside the lines the commit changes, and the whole-repo lint leaves it off.
 */

const root = fileURLToPath(new URL("..", import.meta.url));
const RULE = "formbricks/loggable-error";

// Each logs a caught error raw: one report per fixture.
const raw: Record<string, string> = {
  "shorthand.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.error({ error }, "work failed");
  }
};
`,
  "err-key.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.warn({ err: error, attempt: 1 }, "work failed");
  }
};
`,
  "positional.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (err) {
    logger.error(err, "work failed");
  }
};
`,
  "message.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.error({ reason: (error as Error).message }, "work failed");
  }
};
`,
  "with-context.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.withContext({ job: "sync" }).error({ error }, "work failed");
  }
};
`,
  "promise-catch.ts": `import { logger } from "@formbricks/logger";
export const run = (work: () => Promise<void>) =>
  work().catch((error: unknown) => logger.error({ error }, "work failed"));
`,
  "stack.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.error({ trace: (error as Error).stack }, "work failed");
  }
};
`,
  "cause.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.error({ cause: (error as Error).cause }, "work failed");
  }
};
`,
  "template.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.error(\`work failed: \${(error as Error).message}\`);
  }
};
`,
  "concat.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.error("work failed: " + String(error));
  }
};
`,
  "stringify.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.error({ detail: JSON.stringify(error) }, "work failed");
  }
};
`,
  "nested.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.error({ ctx: { attempt: 1, error } }, "work failed");
  }
};
`,
  "log-name.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    const log = logger.withContext({ job: "sync" });
    log.error({ error }, "work failed");
  }
};
`,
  "context-logger.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    const contextLogger = logger.withContext({ job: "sync" });
    contextLogger.warn({ error }, "work failed");
  }
};
`,
  "function-handler.ts": `import { logger } from "@formbricks/logger";
export const run = (work: () => Promise<void>) =>
  work().catch(function onFailure(error: unknown) {
    logger.error({ error }, "work failed");
  });
`,
  "then-rejection.ts": `import { logger } from "@formbricks/logger";
export const run = (work: () => Promise<void>) =>
  work().then(
    () => logger.info("work done"),
    (error: unknown) => logger.error({ error }, "work failed")
  );
`,
  "concat-left.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.error(String(error) + " - work failed");
  }
};
`,
  "destructured-catch.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch ({ message }) {
    logger.error({ message }, "work failed");
  }
};
`,
  "destructured-handler.ts": `import { logger } from "@formbricks/logger";
export const run = (work: () => Promise<void>) =>
  work().catch(({ message }: Error) => logger.error({ message }, "work failed"));
`,
};

// None of these reports.
const clean: Record<string, string> = {
  "loggable.ts": `import { logger } from "@formbricks/logger";
import { loggableError } from "@formbricks/logger/loggable-error";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.error({ err: loggableError(error) }, "work failed");
  }
};
`,
  // Not a caught error: a value the code built itself.
  "own-value.ts": `import { logger } from "@formbricks/logger";
export const report = (error: { code: string }) => {
  logger.error({ error }, "rejected");
};
`,
  // A caught error that never reaches the logger.
  "rethrow.ts": `export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    throw new Error("work failed", { cause: error });
  }
};
`,
  // A nested parameter of the same name is not the caught error.
  "shadowed.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<string[]>) => {
  try {
    await work();
  } catch (error) {
    ["a", "b"].forEach((error) => logger.info({ error }, "item"));
    throw error;
  }
};
`,
  // The first handler of `.then` receives the value, not a rejection.
  "then-fulfilled.ts": `import { logger } from "@formbricks/logger";
export const run = (work: () => Promise<string>) => work().then((error) => logger.info({ error }, "done"));
`,
  // Members other than message, stack and cause carry no user text.
  "harmless-member.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.error({ name: (error as Error).name }, "work failed");
    throw error;
  }
};
`,
  // Only `+` builds a string; a comparison yields a boolean.
  "comparison.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    logger.warn({ timedOut: error === "timeout" }, "work failed");
    throw error;
  }
};
`,
  // A function declared inside the handler binds its own parameter.
  "function-declaration-shadow.ts": `import { logger } from "@formbricks/logger";
export const run = async (work: () => Promise<void>) => {
  try {
    await work();
  } catch (error) {
    function describe(error: string) {
      logger.info({ error }, "item");
    }
    describe("a");
    throw error;
  }
};
`,
};

// One workspace per tier (next, library, react-hooks), the fixtures where each tier's tsconfig includes
// them.
const tiers = [
  { workspace: "apps/web", dir: "modules/loggable-error" },
  { workspace: "packages/types", dir: "loggable-error" },
  { workspace: "packages/surveys", dir: "src/loggable-error" },
];

const withDir = (dir: string, files: Record<string, string>) =>
  Object.fromEntries(Object.entries(files).map(([file, source]) => [`${dir}/${file}`, source]));

const ruleReports = (diagnostics: FixtureDiagnostic[]) =>
  diagnostics.filter((diagnostic) => diagnostic.ruleId === RULE);

describe("formbricks/loggable-error", () => {
  const staged = new Map<string, Record<string, FixtureDiagnostic[]>>();
  const wholeRepo = new Map<string, Record<string, FixtureDiagnostic[]>>();

  beforeAll(() => {
    for (const { workspace, dir } of tiers) {
      const files = withDir(dir, { ...raw, ...clean, "raw.test.ts": raw["shorthand.ts"] });
      // OXLINT_SONAR_PARITY=warn is how the pre-commit runner lints; "off" is the whole-repo lint.
      staged.set(
        workspace,
        lintFixtures(`${root}${workspace}`, files, { env: { OXLINT_SONAR_PARITY: "warn" } })
      );
      wholeRepo.set(
        workspace,
        lintFixtures(`${root}${workspace}`, files, { env: { OXLINT_SONAR_PARITY: "off" } })
      );
    }
  }, 180_000);

  test("is held to the staged lines by the pre-commit runner", () => {
    expect(STAGED_LINES_RULE_IDS).toContain(RULE);
  });

  describe.each(tiers)("$workspace", ({ workspace, dir }) => {
    test.each(Object.keys(raw))("reports a raw caught error: %s", (file) => {
      const reports = ruleReports(staged.get(workspace)![`${dir}/${file}`]);
      expect(reports, JSON.stringify(reports)).toHaveLength(1);
      expect(reports[0].message).toContain("loggableError");
    });

    test.each(Object.keys(clean))("leaves alone: %s", (file) => {
      expect(ruleReports(staged.get(workspace)![`${dir}/${file}`])).toEqual([]);
    });

    test("exempts test files", () => {
      expect(ruleReports(staged.get(workspace)![`${dir}/raw.test.ts`])).toEqual([]);
    });

    test("stays off in the whole-repo lint while the backlog stands", () => {
      expect(ruleReports(wholeRepo.get(workspace)![`${dir}/shorthand.ts`])).toEqual([]);
    });
  });
});

/*
 * The pre-commit runner, end to end: a file git does not track yet is new code throughout, so a raw log in
 * it fails the commit, labelled as new code rather than as a SonarCloud finding.
 */
describe("the pre-commit runner", () => {
  test("fails a new file that logs a caught error raw, as new code", () => {
    const dir = mkdtempSync(path.join(root, "apps/web/modules/loggable-error-hook-"));
    const file = path.join(dir, "raw.ts");
    writeFileSync(file, raw["shorthand.ts"]);
    try {
      const { status, stdout } = spawnSync(process.execPath, ["scripts/lint-staged-oxlint.mjs", file], {
        cwd: root,
        encoding: "utf8",
      });
      expect(stdout).toContain("error (new code)");
      expect(stdout).toContain(RULE);
      expect(status).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
