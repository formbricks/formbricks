/*
 * The `formbricks/*` ESLint plugin: repo-specific rules that replace prose CODING_STANDARDS.md used to carry
 * (ENG-7325). Each rule's message carries the reason, so the prose need not come back.
 *
 * Rules are plain AST visitors (no type checker), so they cost nothing measurable in the lint task. Existing
 * violations are frozen in each workspace's `eslint-suppressions.json`; only new code has to comply. Fixing a
 * suppressed violation makes `pnpm lint` fail with "suppressions left that do not occur anymore": run
 * `pnpm lint:prune-suppressions` and commit the updated file.
 *
 * Tests: scripts/formbricks-eslint-rules.test.ts (each rule) and scripts/formbricks-eslint-wiring.test.ts
 * (which apps/web files each rule applies to).
 */
import { contentDispositionHelper } from "./rules/content-disposition-helper.mjs";
import { deletionService } from "./rules/deletion-service.mjs";
import { gatePredicate } from "./rules/gate-predicate.mjs";
import { loggableErrorRule } from "./rules/loggable-error.mjs";
import { rawUploadRead } from "./rules/raw-upload-read.mjs";
import { spreadsheetWriter } from "./rules/spreadsheet-writer.mjs";
import { strictInputObject } from "./rules/strict-input-object.mjs";
import { tenantScopedWhere } from "./rules/tenant-scoped-where.mjs";

export const formbricksPlugin = {
  meta: { name: "formbricks" },
  rules: {
    "content-disposition-helper": contentDispositionHelper,
    "deletion-service": deletionService,
    "gate-predicate": gatePredicate,
    "loggable-error": loggableErrorRule,
    "raw-upload-read": rawUploadRead,
    "spreadsheet-writer": spreadsheetWriter,
    "strict-input-object": strictInputObject,
    "tenant-scoped-where": tenantScopedWhere,
  },
};

export default formbricksPlugin;
