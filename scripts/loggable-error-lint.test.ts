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
