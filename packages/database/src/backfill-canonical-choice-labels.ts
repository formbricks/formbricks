/* eslint-disable no-console -- operational one-off script, console output is the interface */
/**
 * One-time backfill for ENG-1566 (follow-up to PR #8441).
 *
 * PR #8441 fixed ingestion so selected choice values are stored in Hub with the
 * default-language label. Rows ingested before that fix still carry labels
 * localized to the response language, so one option charts as N categories
 * (e.g. Gender → Male / Female / ذكر / أنثى). This script rewrites those rows
 * to the canonical default-language label using the same label-matching
 * semantics as `transformResponseToFeedbackRecords`.
 *
 * Scope, mirroring the ingestion fix exactly:
 *   - single select / multi select answers (multi select rows hold a ", "-joined
 *     string — each part is canonicalized and the string re-joined)
 *   - matrix COLUMN values (row labels already canonical — they live in
 *     field_label, which was never localized)
 *   - values matching no current choice label pass through untouched: "other"
 *     free-text answers and labels edited since submission stay as-is
 *   - only `source_type = 'formbricks_survey'` rows; CSV/integration rows are
 *     never touched
 *   - only rows with a non-default `language` — default-language responses were
 *     already canonical at ingestion (ingestion omits `language` for default)
 *
 * Idempotent: canonical values map to themselves, so a re-run is a no-op.
 *
 * Usage (from packages/database):
 *   dotenv -e ../../.env -- tsx src/backfill-canonical-choice-labels.ts            # dry run (default)
 *   dotenv -e ../../.env -- tsx src/backfill-canonical-choice-labels.ts --execute  # apply updates
 *   dotenv -e ../../.env -- tsx src/backfill-canonical-choice-labels.ts --survey <surveyId>
 *
 * Required env:
 *   DATABASE_URL      — Formbricks app DB (survey definitions + source mappings)
 *   HUB_DATABASE_URL  — Hub DB holding feedback_records
 *                       (local dev: postgresql://postgres:postgres@localhost:5432/hub)
 */
import { createRequire } from "node:module";
import { Client } from "pg";
import { PrismaClient } from "./prisma";
import { createPrismaPgAdapter } from "./prisma-adapter";

// @formbricks/types is CJS while this package is ESM; tsx's named-import interop
// fails to detect the transpiled export, so require() it instead.
const require = createRequire(import.meta.url);
const { getTextContent } = require("@formbricks/types/surveys/validation") as {
  getTextContent: (str: string) => string;
};

// --- helpers duplicated from apps/web (that code is "server-only" and can't be
// --- imported from a standalone script; semantics must stay identical) ---------

type TI18nString = Record<string, string>;

// apps/web/lib/i18n/utils.ts#getLocalizedValue: exact language key or "" — no
// fallback to default for a missing translation.
const getLocalizedValue = (value: TI18nString | undefined | null, languageId: string): string => {
  if (!value || typeof value !== "object" || !("default" in value)) return "";
  return value[languageId] ?? "";
};

interface ChoiceLike {
  id: string;
  label: TI18nString;
}

// apps/web/lib/feedback-source/transform.ts#getChoiceLabel
const getChoiceLabel = (choice: ChoiceLike, language: string): string =>
  getTextContent(getLocalizedValue(choice.label, language));

// transform.ts#findChoiceByLabel + normalizeChoiceValue's canonicalize, for one label
const canonicalizeLabel = (choices: ChoiceLike[], label: string, language: string): string => {
  const choice = choices.find((c) => getChoiceLabel(c, language) === label);
  return choice ? getChoiceLabel(choice, "default") : label;
};

// Multi select values were stored as `value.join(", ")` (convertValueToHubFields).
// Canonicalize each part and re-join. Single-label values are the 1-part case.
// Caveat: a choice label that itself contains ", " would be split incorrectly —
// but such a value was already ambiguous at ingestion time; we only rewrite when
// every part maps cleanly, so ambiguous values are left untouched (a part that
// matches nothing maps to itself, which is the same passthrough the fix uses).
const canonicalizeValue = (choices: ChoiceLike[], value: string, language: string): string => {
  return value
    .split(", ")
    .map((part) => canonicalizeLabel(choices, part, language))
    .join(", ");
};

// --- main -----------------------------------------------------------------------

interface PlannedUpdate {
  tenantId: string;
  surveyId: string;
  fieldColumn: "field_id" | "field_group_id";
  fieldValue: string;
  language: string;
  from: string;
  to: string;
}

const main = async (): Promise<void> => {
  const execute = process.argv.includes("--execute");
  const surveyFlagIndex = process.argv.indexOf("--survey");
  const onlySurveyId = surveyFlagIndex === -1 ? undefined : process.argv[surveyFlagIndex + 1];

  const hubDatabaseUrl = process.env.HUB_DATABASE_URL;
  if (!hubDatabaseUrl) {
    console.error("HUB_DATABASE_URL is required (Hub postgres holding feedback_records).");
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: createPrismaPgAdapter().adapter });
  const hub = new Client({ connectionString: hubDatabaseUrl });
  await hub.connect();

  try {
    // Every survey element wired to a Hub directory, with the survey's blocks
    // (for choice definitions) and its enabled non-default languages.
    const mappings = await prisma.feedbackSourceFormbricksMapping.findMany({
      where: {
        feedbackSource: { type: "formbricks_survey" },
        ...(onlySurveyId ? { surveyId: onlySurveyId } : {}),
      },
      select: {
        elementId: true,
        surveyId: true,
        feedbackSource: { select: { feedbackDirectoryId: true } },
        survey: {
          select: {
            blocks: true,
            languages: {
              where: { enabled: true, default: false },
              select: { language: { select: { code: true } } },
            },
          },
        },
      },
    });

    interface BackfillTarget {
      tenantId: string;
      surveyId: string;
      elementId: string;
      fieldColumn: "field_id" | "field_group_id";
      choices: ChoiceLike[];
      languageCodes: string[];
    }

    const targets: BackfillTarget[] = [];

    for (const mapping of mappings) {
      const blocks = mapping.survey.blocks as { elements: Record<string, unknown>[] }[];
      const element = blocks.flatMap((block) => block.elements).find((el) => el.id === mapping.elementId) as
        | {
            id: string;
            type: string;
            choices?: ChoiceLike[];
            columns?: ChoiceLike[];
          }
        | undefined;
      if (!element) continue;

      // Same element scoping as the ingestion fix.
      const isSelect = element.type === "multipleChoiceSingle" || element.type === "multipleChoiceMulti";
      const isMatrix = element.type === "matrix";
      if (!isSelect && !isMatrix) continue;

      const choices = isSelect ? element.choices : element.columns;
      if (!choices?.length) continue;

      targets.push({
        tenantId: mapping.feedbackSource.feedbackDirectoryId,
        surveyId: mapping.surveyId,
        elementId: mapping.elementId,
        // Matrix records carry field_id = `${element.id}__${row.id}`; the stable
        // per-element key is field_group_id. Select records use field_id directly.
        fieldColumn: isMatrix ? "field_group_id" : "field_id",
        choices,
        languageCodes: mapping.survey.languages.map((l) => l.language.code),
      });
    }

    const planned: PlannedUpdate[] = [];
    const scannedElements = targets.length;

    // ---- Phase 1: canonicalize localized value_text (multi-language surveys only) ----
    for (const target of targets) {
      const { tenantId, surveyId, elementId, fieldColumn, choices, languageCodes } = target;
      if (languageCodes.length === 0) continue; // single-language survey — nothing localized

      // Distinct localized values actually present in Hub for this element.
      const { rows } = await hub.query<{ value_text: string; language: string }>(
        `SELECT DISTINCT value_text, language
           FROM feedback_records
          WHERE tenant_id = $1
            AND source_type = 'formbricks_survey'
            AND source_id = $2
            AND ${fieldColumn} = $3
            AND language IS NOT NULL
            AND language <> 'default'
            AND value_text IS NOT NULL`,
        [tenantId, surveyId, elementId]
      );

      for (const row of rows) {
        if (!languageCodes.includes(row.language)) continue; // language no longer on the survey
        const canonical = canonicalizeValue(choices, row.value_text, row.language);
        if (canonical === row.value_text) continue; // already canonical or no match (passthrough)

        planned.push({
          tenantId,
          surveyId,
          fieldColumn,
          fieldValue: elementId,
          language: row.language,
          from: row.value_text,
          to: canonical,
        });
      }
    }

    console.log(
      `Scanned ${String(scannedElements)} choice/matrix element mappings — ` +
        `${String(planned.length)} distinct (value, language) rewrites planned.`
    );

    let totalRows = 0;
    for (const update of planned) {
      if (execute) {
        const result = await hub.query(
          `UPDATE feedback_records
              SET value_text = $1, updated_at = now()
            WHERE tenant_id = $2
              AND source_type = 'formbricks_survey'
              AND source_id = $3
              AND ${update.fieldColumn} = $4
              AND language = $5
              AND value_text = $6`,
          [update.to, update.tenantId, update.surveyId, update.fieldValue, update.language, update.from]
        );
        totalRows += result.rowCount ?? 0;
        console.log(
          `  [${update.language}] "${update.from}" → "${update.to}" (${String(result.rowCount)} rows)`
        );
      } else {
        const { rows } = await hub.query<{ count: string }>(
          `SELECT count(*)::text AS count
             FROM feedback_records
            WHERE tenant_id = $1
              AND source_type = 'formbricks_survey'
              AND source_id = $2
              AND ${update.fieldColumn} = $3
              AND language = $4
              AND value_text = $5`,
          [update.tenantId, update.surveyId, update.fieldValue, update.language, update.from]
        );
        totalRows += Number(rows[0].count);
        console.log(
          `  [dry-run] [${update.language}] "${update.from}" → "${update.to}" (${rows[0].count} rows)`
        );
      }
    }

    console.log(
      execute
        ? `Done — ${String(totalRows)} feedback_records rows updated.`
        : `Dry run — ${String(totalRows)} feedback_records rows WOULD be updated. Re-run with --execute to apply.`
    );

    // ---- Phase 2: populate value_id (ENG-1673) — runs only when the Hub schema has the
    // column (ENG-1671). Matches rows whose value_text equals a choice's canonical label
    // exactly (phase 1 has just canonicalized everything mappable), so multi-select joined
    // strings, "other" free text and stale labels naturally stay NULL — same passthrough
    // semantics as ingestion. Applies to single-language surveys too.
    const { rows: columnCheck } = await hub.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'feedback_records' AND column_name = 'value_id'`
    );
    if (columnCheck.length === 0) {
      console.log("value_id column not present in Hub schema (pre ENG-1671) — skipping value_id phase.");
      return;
    }

    let valueIdRows = 0;
    let ambiguousLabels = 0;
    for (const target of targets) {
      // canonical label → choice ids; a label used by more than one choice is ambiguous — skip it.
      const idsByLabel = new Map<string, string[]>();
      for (const choice of target.choices) {
        const label = getChoiceLabel(choice, "default");
        if (!label) continue;
        idsByLabel.set(label, [...(idsByLabel.get(label) ?? []), choice.id]);
      }

      for (const [label, ids] of idsByLabel) {
        if (ids.length > 1) {
          ambiguousLabels++;
          console.log(`  [value_id] skipping ambiguous label "${label}" (${String(ids.length)} choices)`);
          continue;
        }
        const params = [ids[0], target.tenantId, target.surveyId, target.elementId, label];
        if (execute) {
          const result = await hub.query(
            `UPDATE feedback_records
                SET value_id = $1, updated_at = now()
              WHERE tenant_id = $2
                AND source_type = 'formbricks_survey'
                AND source_id = $3
                AND ${target.fieldColumn} = $4
                AND value_text = $5
                AND value_id IS NULL`,
            params
          );
          if (result.rowCount) {
            valueIdRows += result.rowCount;
            console.log(`  [value_id] "${label}" → ${ids[0]} (${String(result.rowCount)} rows)`);
          }
        } else {
          const { rows } = await hub.query<{ count: string }>(
            `SELECT count(*)::text AS count
               FROM feedback_records
              WHERE tenant_id = $2
                AND source_type = 'formbricks_survey'
                AND source_id = $3
                AND ${target.fieldColumn} = $4
                AND value_text = $5
                AND value_id IS NULL
                AND $1 IS NOT NULL`,
            params
          );
          if (Number(rows[0].count) > 0) {
            valueIdRows += Number(rows[0].count);
            console.log(`  [value_id] [dry-run] "${label}" → ${ids[0]} (${rows[0].count} rows)`);
          }
        }
      }
    }
    console.log(
      execute
        ? `value_id phase done — ${String(valueIdRows)} rows populated${ambiguousLabels ? `, ${String(ambiguousLabels)} ambiguous labels skipped` : ""}.`
        : `value_id phase dry run — ${String(valueIdRows)} rows WOULD be populated.`
    );
  } finally {
    await hub.end();
    await prisma.$disconnect();
  }
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
