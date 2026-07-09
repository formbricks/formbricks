/**
 * Backfill for ENG-1566 / ENG-1673 (choice answers in Hub feedback_records).
 *
 * Design (current): choice values are stored in the language the respondent
 * submitted, and cross-language identity lives in `value_id` — the stable id of
 * the matched survey choice (single selects) or matrix column. Charts group and
 * filter on value_id; labels are resolved for display from the survey definition.
 *
 * Two generations of historical rows predate this design:
 *   1. Rows ingested while ENG-1566 canonicalization was live carry the
 *      DEFAULT-language label even though the response was taken in another
 *      language (e.g. a German response showing "Female").
 *   2. Rows ingested before ENG-1673 (or before the ingestion language-key fix)
 *      carry no value_id.
 *
 * Phases, mirroring current ingestion semantics exactly:
 *   - Phase 1 (re-localize): for rows in a non-default response language whose
 *     value_text equals a choice's default-language label, rewrite value_text to
 *     that choice's label in the response language. Values matching no choice
 *     ("other" free text, edited labels) and empty translations pass through.
 *     Multi select rows hold a ", "-joined string — each part is re-localized.
 *   - Phase 2 (populate value_id): rows whose value_text equals a choice label
 *     in the row's language (default-language labels for rows whose language is
 *     NULL, 'default', or the survey's default code) get that choice's id.
 *     Multi select rows are skipped — ingestion never assigns them an id, since
 *     one joined record cannot carry multiple ids. Labels shared by more than
 *     one choice in the same language are ambiguous and skipped with a log line.
 *   - Only `source_type = 'formbricks_survey'` rows; CSV/integration rows are
 *     never touched.
 *
 * Idempotent: re-localized values no longer match a default label, and phase 2
 * only touches `value_id IS NULL` rows, so a re-run is a no-op.
 *
 * Usage (from packages/database):
 *   dotenv -e ../../.env -- tsx src/backfill-canonical-choice-labels.ts            # dry run (default)
 *   dotenv -e ../../.env -- tsx src/backfill-canonical-choice-labels.ts --execute  # apply updates
 *   dotenv -e ../../.env -- tsx src/backfill-canonical-choice-labels.ts --survey <surveyId>
 *
 * Required env:
 *   DATABASE_URL      — Formbricks app DB (survey definitions + source mappings)
 *   HUB_DATABASE_URL  — Hub postgres holding feedback_records
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

// Phase 1 unit: a value_text holding a DEFAULT-language label (old canonicalization)
// is rewritten to the same choice's label in the response language. No match, or an
// empty/missing translation, passes through untouched.
const localizeLabel = (choices: ChoiceLike[], label: string, language: string): string => {
  const choice = choices.find((c) => getChoiceLabel(c, "default") === label);
  if (!choice) return label;
  return getChoiceLabel(choice, language) || label;
};

// Single select and matrix values are matched as a WHOLE string (ingestion's
// normalizeChoiceValue string branch), so a free-text "other" answer containing
// ", " is never split apart. Only multi select values were stored as
// `value.join(", ")` (convertValueToHubFields), so only those are split, each part
// localized, and re-joined.
const localizeValue = (
  choices: ChoiceLike[],
  value: string,
  language: string,
  splitParts: boolean
): string => {
  if (!splitParts) return localizeLabel(choices, value, language);
  return value
    .split(", ")
    .map((part) => localizeLabel(choices, part, language))
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
  // A bare `--survey` (missing/flag-shaped value) must not silently widen a canary run to ALL surveys.
  if (surveyFlagIndex !== -1 && (!onlySurveyId || onlySurveyId.startsWith("--"))) {
    console.error("--survey requires a survey id (e.g. --survey clxabc123).");
    process.exit(1);
  }
  console.log(
    `Scope: ${onlySurveyId ? `survey ${onlySurveyId}` : "ALL surveys"} — ${execute ? "EXECUTE" : "dry run"}`
  );

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
    // (for choice definitions) and its enabled languages (default + others).
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
              where: { enabled: true },
              select: { default: true, language: { select: { code: true } } },
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
      kind: "single" | "multi" | "matrix";
      choices: ChoiceLike[];
      /** Enabled non-default language codes — labels live under these keys. */
      otherLanguageCodes: string[];
      /** Concrete code of the default language (labels live under "default"). */
      defaultLanguageCode?: string;
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

      // Same element scoping as ingestion.
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
        kind: isMatrix ? "matrix" : element.type === "multipleChoiceMulti" ? "multi" : "single",
        choices,
        otherLanguageCodes: mapping.survey.languages.filter((l) => !l.default).map((l) => l.language.code),
        defaultLanguageCode: mapping.survey.languages.find((l) => l.default)?.language.code,
      });
    }

    const planned: PlannedUpdate[] = [];
    const scannedElements = targets.length;

    // ---- Phase 1: re-localize value_text that old canonicalization rewrote into the
    // ---- default language (multi-language surveys only) ------------------------------
    for (const target of targets) {
      const { tenantId, surveyId, elementId, fieldColumn, kind, choices, otherLanguageCodes } = target;
      if (otherLanguageCodes.length === 0) continue; // single-language survey — nothing to re-localize

      // Distinct values actually present in Hub for this element in non-default languages.
      // The survey's default-language code is deliberately not queried: those rows already
      // hold the default label, which IS their submitted-language label.
      const { rows } = await hub.query<{ value_text: string; language: string }>(
        `SELECT DISTINCT value_text, language
           FROM feedback_records
          WHERE tenant_id = $1
            AND source_type = 'formbricks_survey'
            AND source_id = $2
            AND ${fieldColumn} = $3
            AND language = ANY($4)
            AND value_text IS NOT NULL`,
        [tenantId, surveyId, elementId, otherLanguageCodes]
      );

      for (const row of rows) {
        const localized = localizeValue(choices, row.value_text, row.language, kind === "multi");
        if (localized === row.value_text) continue; // already localized or no match (passthrough)

        planned.push({
          tenantId,
          surveyId,
          fieldColumn,
          fieldValue: elementId,
          language: row.language,
          from: row.value_text,
          to: localized,
        });
      }
    }

    // Guard against order-dependent double rewrites: if update A's target value equals
    // update B's source value within the same (element, language), running A first would
    // leave rows that B then rewrites AGAIN (rows land two hops away from their original
    // value). Skip A and surface it — B still runs correctly on the rows that originally
    // held its source value.
    const sourceKeys = new Set(planned.map((u) => `${u.fieldValue}|${u.language}|${u.from}`));
    const executable = planned.filter((update) => {
      if (sourceKeys.has(`${update.fieldValue}|${update.language}|${update.to}`)) {
        console.log(
          `  [skip] [${update.language}] "${update.from}" → "${update.to}" — target value is itself scheduled for rewrite on this element; resolve manually to avoid chained rewrites.`
        );
        return false;
      }
      return true;
    });

    console.log(
      `Scanned ${String(scannedElements)} choice/matrix element mappings — ` +
        `${String(executable.length)} distinct (value, language) rewrites planned` +
        `${planned.length !== executable.length ? ` (${String(planned.length - executable.length)} skipped for chained-rewrite risk)` : ""}.`
    );

    let totalRows = 0;
    for (const update of executable) {
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
        ? `Phase 1 done — ${String(totalRows)} feedback_records rows re-localized.`
        : `Phase 1 dry run — ${String(totalRows)} feedback_records rows WOULD be re-localized.`
    );

    // ---- Phase 2: populate value_id (ENG-1673) — runs only when the Hub schema has the
    // column (ENG-1671). Matches value_text against choice labels in the ROW's language:
    // default-language labels for rows whose language is NULL, 'default', or the survey's
    // default code (ingestion stores the concrete code); localized labels for the rest.
    // "Other" free text and stale labels match nothing and stay NULL — same passthrough
    // semantics as ingestion. Applies to single-language surveys too.
    const { rows: columnCheck } = await hub.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'feedback_records'
          AND column_name = 'value_id'`
    );
    if (columnCheck.length === 0) {
      console.log("value_id column not present in Hub schema (pre ENG-1671) — skipping value_id phase.");
      return;
    }

    let valueIdRows = 0;
    let ambiguousLabels = 0;
    for (const target of targets) {
      // Ingestion never assigns value_id to multi select records (a joined record cannot
      // carry multiple ids) — skip them here too so backfilled and freshly ingested rows
      // share the same semantics.
      if (target.kind === "multi") continue;

      // One matching pass per label key: "default" covers rows with no concrete language
      // (plus the default language's own code); every other enabled language matches by
      // its localized labels.
      const languagePasses: { labelKey: string; sqlPredicate: string; sqlParams: string[] }[] = [
        {
          labelKey: "default",
          sqlPredicate: "(language IS NULL OR language = 'default' OR language = $6)",
          sqlParams: [target.defaultLanguageCode ?? "default"],
        },
        ...target.otherLanguageCodes.map((code) => ({
          labelKey: code,
          sqlPredicate: "language = $6",
          sqlParams: [code],
        })),
      ];

      for (const pass of languagePasses) {
        // label (in this language) → choice ids; a label used by more than one choice is
        // ambiguous — skip it.
        const idsByLabel = new Map<string, string[]>();
        for (const choice of target.choices) {
          const label = getChoiceLabel(choice, pass.labelKey);
          if (!label) continue;
          idsByLabel.set(label, [...(idsByLabel.get(label) ?? []), choice.id]);
        }

        for (const [label, ids] of idsByLabel) {
          if (ids.length > 1) {
            ambiguousLabels++;
            console.log(
              `  [value_id] skipping ambiguous label "${label}" (${pass.labelKey}, ${String(ids.length)} choices)`
            );
            continue;
          }
          if (execute) {
            const result = await hub.query(
              `UPDATE feedback_records
                  SET value_id = $1, updated_at = now()
                WHERE tenant_id = $2
                  AND source_type = 'formbricks_survey'
                  AND source_id = $3
                  AND ${target.fieldColumn} = $4
                  AND value_text = $5
                  AND value_id IS NULL
                  AND ${pass.sqlPredicate}`,
              [ids[0], target.tenantId, target.surveyId, target.elementId, label, ...pass.sqlParams]
            );
            if (result.rowCount) {
              valueIdRows += result.rowCount;
              console.log(
                `  [value_id] [${pass.labelKey}] "${label}" → ${ids[0]} (${String(result.rowCount)} rows)`
              );
            }
          } else {
            const { rows } = await hub.query<{ count: string }>(
              `SELECT count(*)::text AS count
                 FROM feedback_records
                WHERE tenant_id = $1
                  AND source_type = 'formbricks_survey'
                  AND source_id = $2
                  AND ${target.fieldColumn} = $3
                  AND value_text = $4
                  AND value_id IS NULL
                  AND ${pass.sqlPredicate.replace("$6", "$5")}`,
              [target.tenantId, target.surveyId, target.elementId, label, ...pass.sqlParams]
            );
            if (Number(rows[0].count) > 0) {
              valueIdRows += Number(rows[0].count);
              console.log(
                `  [value_id] [dry-run] [${pass.labelKey}] "${label}" → ${ids[0]} (${rows[0].count} rows)`
              );
            }
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
