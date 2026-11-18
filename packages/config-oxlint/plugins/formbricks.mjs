/*
 * Formbricks' own oxlint JS plugin. oxlint has no `no-restricted-syntax`, so the repo's selector-based
 * guardrails (direct `process.env` reads in apps/web, markup-parsing APIs in code that runs on customer
 * pages) run through `formbricks/restricted-syntax`, which takes the same `{ selector, message }` options
 * ESLint's rule did. oxlint JS plugins support ESLint selector syntax, so the selectors carry over as-is.
 *
 * A line that has to use a restricted API disables the rule with the reason it is safe:
 *   // oxlint-disable-next-line formbricks/restricted-syntax -- <reason>
 *
 * `formbricks/no-inline-lint-config` reports ESLint's inline configuration comments, which oxlint
 * ignores without a warning: a rule configured that way silently does nothing.
 *
 * The rules under `../rules/` replace prose CODING_STANDARDS.md used to carry (ENG-7325); each message
 * carries its reason. They are plain AST visitors. apps/web enables them in its oxlint.config.ts and
 * grandfathers existing violations per file in `apps/web/formbricks-rules-baseline.json`. Tests:
 * scripts/formbricks-lint-rules.test.ts (each rule), scripts/formbricks-lint-wiring.test.ts (scoping).
 */
import { contentDispositionHelper } from "../rules/content-disposition-helper.mjs";
import { deletionService } from "../rules/deletion-service.mjs";
import { gatePredicate } from "../rules/gate-predicate.mjs";
import { loggableErrorRule } from "../rules/loggable-error.mjs";
import { rawUploadRead } from "../rules/raw-upload-read.mjs";
import { spreadsheetWriter } from "../rules/spreadsheet-writer.mjs";
import { strictInputObject } from "../rules/strict-input-object.mjs";
import { tenantScopedWhere } from "../rules/tenant-scoped-where.mjs";

const restrictedSyntax = {
  meta: {
    type: "problem",
    docs: { description: "Disallow syntax matched by the configured ESLint selectors." },
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: { selector: { type: "string" }, message: { type: "string" } },
        required: ["selector"],
        additionalProperties: false,
      },
      uniqueItems: true,
    },
  },
  create(context) {
    const visitors = {};
    for (const { selector, message } of context.options) {
      const report = (node) =>
        context.report({ node, message: message ?? `Using '${selector}' is not allowed.` });
      const previous = visitors[selector];
      visitors[selector] = previous
        ? (node) => {
            previous(node);
            report(node);
          }
        : report;
    }
    return visitors;
  },
};

// `/* eslint <rule>: … */`, `/* eslint-env */`, `/* global(s) */` and `/* exported */`, as ESLint reads
// them. Disable and enable directives (`eslint-disable…`, `eslint-enable…`), which oxlint honours, do
// not match.
const INLINE_CONFIG = /^\s*(eslint(?:-env)?|globals?|exported)(?:\s|$)/;

const noInlineLintConfig = {
  meta: {
    type: "problem",
    docs: { description: "Disallow ESLint inline configuration comments, which oxlint ignores." },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const match = comment.type === "Block" ? INLINE_CONFIG.exec(comment.value) : null;
          if (!match) continue;
          context.report({
            loc: comment.loc,
            message: `oxlint ignores \`/* ${match[1]} */\` comments, so this configures nothing. Set the rule, environment or global in the workspace's oxlint.config.ts, in an override scoped to this file if needed.`,
          });
        }
      },
    };
  },
};

export default {
  meta: { name: "formbricks" },
  rules: {
    "content-disposition-helper": contentDispositionHelper,
    "deletion-service": deletionService,
    "gate-predicate": gatePredicate,
    "loggable-error": loggableErrorRule,
    "no-inline-lint-config": noInlineLintConfig,
    "raw-upload-read": rawUploadRead,
    "restricted-syntax": restrictedSyntax,
    "spreadsheet-writer": spreadsheetWriter,
    "strict-input-object": strictInputObject,
    "tenant-scoped-where": tenantScopedWhere,
  },
};
