import { LANGUAGE_CANONICAL_MAP, normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";
import type { LanguageRow, MigrationStats, SurveyContentRow, SurveyLanguageRow } from "./types";
import { planLanguageMerges, planSurveyLanguageMoves, rewriteI18nKeys, toCanonical } from "./utils";

const SURVEY_BATCH_SIZE = 150;
// The two highest-volume tables are migrated OUTSIDE the mega-transaction in committed chunks (see steps
// 3 & 4). `Response` is walked by primary key; `ContactAttribute` by its `[attributeKeyId, value]` index.
const RESPONSE_BATCH_SIZE = 5000;
const CONTACT_ATTRIBUTE_BATCH_SIZE = 5000;
const PROGRESS_LOG_EVERY_BATCHES = 20;

// Survey content columns that can hold i18nStrings. `blocks` and `endings` are `Json[]` (Postgres
// array of jsonb); the rest are single `Json`.
const SURVEY_CONTENT_FIELDS = [
  { column: "welcomeCard", kind: "json" },
  { column: "blocks", kind: "jsonArray" },
  { column: "endings", kind: "jsonArray" },
  { column: "metadata", kind: "json" },
  { column: "surveyClosedMessage", kind: "json" },
  { column: "questions", kind: "json" },
] as const;

export const canonicalizeLanguageCodes: MigrationScript = {
  type: "data",
  id: "wu5owuszcu0ge717a5vodm0p",
  name: "20260625104904_canonicalize_language_codes",
  // `tx` is the runner's mega-transaction (used for the small, bounded catalog + survey-content steps).
  // `prisma` is the autocommit handle used for the two high-volume tables so their work commits in small
  // chunks — see steps 3 & 4 for why (lock footprint + timeout/convergence).
  run: async ({ prisma, tx }) => {
    const stats: MigrationStats = {
      languageRelabels: 0,
      languageMerges: 0,
      languagesDeleted: 0,
      surveyLanguageRepoints: 0,
      surveyLanguageDeletes: 0,
      surveysContentUpdated: 0,
      i18nKeysRewritten: 0,
      responsesUpdated: 0,
      responseContactAttributesUpdated: 0,
      contactAttributesUpdated: 0,
      unresolvedCodes: new Set<string>(),
    };

    // Snapshot multi-language survey IDs BEFORE Step 1 mutates SurveyLanguage. A survey that links two
    // codes collapsing to the same canonical (e.g. `de` + `de-DE`) gets deduped down to a single link by
    // the merge below; querying `COUNT(*) > 1` afterwards would then skip it and leave its legacy content
    // key un-rewritten. Pre-merge `COUNT(*) > 1` is a superset of the post-merge set (a merge only ever
    // reduces a survey's link count) and single-language surveys only hold the never-rewritten `default`
    // key — so this is exactly the set Step 2 must process.
    const multiLanguageSurveyIds = (
      await tx.$queryRaw<{ surveyId: string }[]>`
        SELECT "surveyId" FROM "SurveyLanguage" GROUP BY "surveyId" HAVING COUNT(*) > 1
      `
    ).map((row) => row.surveyId);

    // ---------------------------------------------------------------------------------------------
    // 1. Language catalog rows
    // ---------------------------------------------------------------------------------------------
    logger.info("Canonicalizing Language rows...");
    const languages = await tx.$queryRaw<LanguageRow[]>`
      SELECT id, code, alias, "workspaceId", created_at AS "createdAt"
      FROM "Language"
    `;
    logger.info(`Loaded ${languages.length.toString()} Language rows`);

    for (const lang of languages) {
      if (normalizeLanguageCode(lang.code) === null) stats.unresolvedCodes.add(lang.code);
    }

    const { relabels, merges } = planLanguageMerges(languages);

    // 1a. Plain relabels (no collision) — batched UNNEST update.
    for (let i = 0; i < relabels.length; i += SURVEY_BATCH_SIZE) {
      const batch = relabels.slice(i, i + SURVEY_BATCH_SIZE);
      await tx.$executeRawUnsafe(
        `UPDATE "Language" AS l
         SET code = data.code
         FROM (SELECT unnest($1::text[]) AS id, unnest($2::text[]) AS code) AS data
         WHERE l.id = data.id`,
        batch.map((r) => r.id),
        batch.map((r) => r.toCode)
      );
    }
    stats.languageRelabels = relabels.length;

    // 1b. Collision merges — handled one group at a time.
    for (const merge of merges) {
      const linkIds = [merge.survivorId, ...merge.absorbedIds];
      const links = await tx.$queryRawUnsafe<SurveyLanguageRow[]>(
        `SELECT "languageId", "surveyId", "default", enabled
         FROM "SurveyLanguage"
         WHERE "languageId" = ANY($1::text[])`,
        linkIds
      );
      const moves = planSurveyLanguageMoves(merge.survivorId, merge.absorbedIds, asLinkArray(links));

      // Drop absorbed links the survivor already has (composite PK forbids duplicates).
      for (const del of moves.deletes) {
        await tx.$executeRawUnsafe(
          `DELETE FROM "SurveyLanguage" WHERE "languageId" = $1 AND "surveyId" = $2`,
          del.languageId,
          del.surveyId
        );
      }
      stats.surveyLanguageDeletes += moves.deletes.length;

      // Move the remaining absorbed links onto the survivor.
      for (const repoint of moves.repoints) {
        await tx.$executeRawUnsafe(
          `UPDATE "SurveyLanguage" SET "languageId" = $1 WHERE "languageId" = $2 AND "surveyId" = $3`,
          merge.survivorId,
          repoint.fromLanguageId,
          repoint.surveyId
        );
      }
      stats.surveyLanguageRepoints += moves.repoints.length;

      // Carry over merged default/enabled flags onto the survivor's surviving link. Runs AFTER repoints
      // so that when the survivor's link for a survey was created by a repoint (survivor wasn't originally
      // linked), the flag update targets the now-existing row instead of being a no-op.
      for (const update of moves.flagUpdates) {
        await tx.$executeRawUnsafe(
          `UPDATE "SurveyLanguage" SET "default" = $1, enabled = $2 WHERE "languageId" = $3 AND "surveyId" = $4`,
          update.default,
          update.enabled,
          merge.survivorId,
          update.surveyId
        );
      }

      // Relabel the survivor to the canonical code and copy over an absorbed alias when the survivor has
      // none. `aliasToSet` is already null unless the survivor's own alias was empty/null and an absorbed
      // row had one, so it takes precedence here (COALESCE($2, alias) — not the other way around, which
      // would wrongly keep a survivor's empty-string alias over a real absorbed one).
      if (merge.survivorNeedsRelabel || merge.aliasToSet !== null) {
        await tx.$executeRawUnsafe(
          `UPDATE "Language" SET code = $1, alias = COALESCE($2, alias) WHERE id = $3`,
          merge.canonical,
          merge.aliasToSet,
          merge.survivorId
        );
      }

      // Delete absorbed rows (their links have all been moved/deleted).
      await tx.$executeRawUnsafe(`DELETE FROM "Language" WHERE id = ANY($1::text[])`, merge.absorbedIds);
      stats.languagesDeleted += merge.absorbedIds.length;
    }
    stats.languageMerges = merges.length;

    logger.info(
      `Language rows: ${stats.languageRelabels.toString()} relabelled, ${stats.languageMerges.toString()} merges (${stats.languagesDeleted.toString()} rows absorbed, ${stats.surveyLanguageRepoints.toString()} links moved, ${stats.surveyLanguageDeletes.toString()} links deduped)`
    );

    // ---------------------------------------------------------------------------------------------
    // 2. Survey content i18n keys (only multi-language surveys can have non-`default` keys)
    // ---------------------------------------------------------------------------------------------
    logger.info("Canonicalizing survey content i18n keys...");
    const surveys =
      multiLanguageSurveyIds.length > 0
        ? await tx.$queryRawUnsafe<SurveyContentRow[]>(
            `SELECT id, "welcomeCard", blocks, endings, metadata, "surveyClosedMessage", questions
             FROM "Survey"
             WHERE id = ANY($1::text[])`,
            multiLanguageSurveyIds
          )
        : [];
    logger.info(`Loaded ${surveys.length.toString()} multi-language surveys`);

    interface SurveyUpdate {
      id: string;
      setClauses: string[];
      params: string[];
    }
    const surveyUpdates: SurveyUpdate[] = [];

    for (const survey of surveys) {
      const setClauses: string[] = [];
      const params: string[] = [];

      for (const field of SURVEY_CONTENT_FIELDS) {
        const original = (survey as unknown as Record<string, unknown>)[field.column];
        const result = rewriteI18nKeys(original);
        // Record unresolved codes before the early exit — content can contain an unparseable language
        // key that doesn't change anything yet still needs to be surfaced.
        for (const code of result.unresolved) stats.unresolvedCodes.add(code);
        if (!result.changed) continue;

        stats.i18nKeysRewritten += result.keysRewritten;

        const paramIndex = params.length + 1;
        params.push(JSON.stringify(result.value));
        if (field.kind === "jsonArray") {
          // array_agg over a function scan isn't guaranteed to preserve element order, and `blocks`/
          // `endings` are order-sensitive (their sequence is the survey's logic). Aggregate explicitly by
          // ordinality so the rebuilt array keeps the original order.
          setClauses.push(
            `"${field.column}" = COALESCE((SELECT array_agg(elem ORDER BY ord) FROM jsonb_array_elements($${paramIndex.toString()}::jsonb) WITH ORDINALITY AS t(elem, ord)), ARRAY[]::jsonb[])`
          );
        } else {
          setClauses.push(`"${field.column}" = $${paramIndex.toString()}::jsonb`);
        }
      }

      if (setClauses.length > 0) {
        surveyUpdates.push({ id: survey.id, setClauses, params });
      }
    }

    for (let i = 0; i < surveyUpdates.length; i += SURVEY_BATCH_SIZE) {
      const batch = surveyUpdates.slice(i, i + SURVEY_BATCH_SIZE);
      // Sequential, not Promise.all: `tx` is a single interactive-transaction connection, and Prisma
      // can't run queries concurrently on one `tx` (it serializes at best, throws and aborts the
      // migration at worst). So concurrency buys nothing here — match the other steps and await in order.
      for (const update of batch) {
        await tx.$executeRawUnsafe(
          `UPDATE "Survey" SET ${update.setClauses.join(", ")} WHERE id = $${(update.params.length + 1).toString()}`,
          ...update.params,
          update.id
        );
      }
      logger.info(
        `Survey content progress: ${Math.min(i + SURVEY_BATCH_SIZE, surveyUpdates.length).toString()}/${surveyUpdates.length.toString()}`
      );
    }
    stats.surveysContentUpdated = surveyUpdates.length;

    // ---------------------------------------------------------------------------------------------
    // 3. Response.language + the contactAttributes 'language' snapshot.
    //
    // `Response` is the highest-volume table and has NO index on `language`, so the old approach — one
    // `UPDATE ... WHERE language = ANY(...)` inside the 30-min mega-transaction — risked (a) exceeding the
    // timeout on a large table, which rolls back EVERY step so the deploy never converges, and (b) holding
    // row locks long enough to stall response ingestion. Instead we walk the table by primary key in fixed
    // chunks and commit each chunk via the autocommit `prisma` handle (NOT `tx`): locks release per chunk
    // and committed progress survives a timeout, since the migration is idempotent (a retry just resumes).
    //
    // The remap set comes from the shared canonical map rather than a `SELECT DISTINCT language` full scan
    // (itself an unindexed full-table read). It covers every known legacy code; an exotic code outside the
    // map is left as-is and still resolves at read time (the renderer canonicalizes on read).
    // ---------------------------------------------------------------------------------------------
    logger.info("Canonicalizing Response.language + contactAttributes snapshot...");
    const responsePairs = buildRemapPairsFromMap();
    if (responsePairs.olds.length > 0) {
      let lastId = "";
      let batchCount = 0;
      for (;;) {
        const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "Response" WHERE id > $1 ORDER BY id LIMIT $2`,
          lastId,
          RESPONSE_BATCH_SIZE
        );
        if (rows.length === 0) break;
        const ids = rows.map((row) => row.id);

        const languageUpdated = await prisma.$executeRawUnsafe(
          `UPDATE "Response" AS r
           SET language = data.canon
           FROM (SELECT unnest($1::text[]) AS old, unnest($2::text[]) AS canon) AS data
           WHERE r.id = ANY($3::text[]) AND r.language = data.old`,
          responsePairs.olds,
          responsePairs.canons,
          ids
        );
        stats.responsesUpdated += typeof languageUpdated === "number" ? languageUpdated : 0;

        const snapshotUpdated = await prisma.$executeRawUnsafe(
          `UPDATE "Response" AS r
           SET "contactAttributes" = jsonb_set(r."contactAttributes", '{language}', to_jsonb(data.canon))
           FROM (SELECT unnest($1::text[]) AS old, unnest($2::text[]) AS canon) AS data
           WHERE r.id = ANY($3::text[])
             AND r."contactAttributes" ->> 'language' = data.old`,
          responsePairs.olds,
          responsePairs.canons,
          ids
        );
        stats.responseContactAttributesUpdated += typeof snapshotUpdated === "number" ? snapshotUpdated : 0;

        lastId = ids[ids.length - 1];
        batchCount += 1;
        if (batchCount % PROGRESS_LOG_EVERY_BATCHES === 0) {
          logger.info(
            `Response progress: ~${(batchCount * RESPONSE_BATCH_SIZE).toString()} scanned, ${stats.responsesUpdated.toString()} language + ${stats.responseContactAttributesUpdated.toString()} snapshot rows updated`
          );
        }
      }
    }
    logger.info(
      `Response.language: ${stats.responsesUpdated.toString()} rows updated; contactAttributes snapshot: ${stats.responseContactAttributesUpdated.toString()} rows updated`
    );

    // ---------------------------------------------------------------------------------------------
    // 4. Contact `language` attribute value.
    //
    // Uses the `[attributeKeyId, value]` index to touch only language rows (never a full-table join to
    // ContactAttributeKey). Runs via the autocommit `prisma` handle and updates each legacy value in
    // index-backed chunks that commit per batch, so a code held by millions of contacts never sits under
    // one long lock.
    // ---------------------------------------------------------------------------------------------
    logger.info("Canonicalizing contact language attribute values...");
    const languageKeyRows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ContactAttributeKey" WHERE key = 'language'
    `;
    const languageKeyIds = languageKeyRows.map((row) => row.id);
    logger.info(`Found ${languageKeyIds.length.toString()} language attribute keys`);

    if (languageKeyIds.length > 0) {
      // Scoped to language rows via the index (not a full-table scan) and returns a handful of codes.
      const contactCodes = await prisma.$queryRawUnsafe<{ value: string }[]>(
        `SELECT DISTINCT value FROM "ContactAttribute"
         WHERE "attributeKeyId" = ANY($1::text[]) AND value <> '' AND value <> 'default'`,
        languageKeyIds
      );
      const contactPairs = buildCanonicalPairs(
        contactCodes.map((c) => c.value),
        stats
      );
      for (let i = 0; i < contactPairs.olds.length; i++) {
        // Index-backed batched update: each pass updates up to CONTACT_ATTRIBUTE_BATCH_SIZE rows still at
        // the legacy value and commits, until fewer than a full batch remain.
        for (;;) {
          const updated = await prisma.$executeRawUnsafe(
            `UPDATE "ContactAttribute" SET value = $1
             WHERE id IN (
               SELECT id FROM "ContactAttribute"
               WHERE "attributeKeyId" = ANY($2::text[]) AND value = $3
               LIMIT $4
             )`,
            contactPairs.canons[i],
            languageKeyIds,
            contactPairs.olds[i],
            CONTACT_ATTRIBUTE_BATCH_SIZE
          );
          const rowsUpdated = typeof updated === "number" ? updated : 0;
          stats.contactAttributesUpdated += rowsUpdated;
          if (rowsUpdated < CONTACT_ATTRIBUTE_BATCH_SIZE) break;
        }
        logger.info(
          `Contact language attribute progress: ${(i + 1).toString()}/${contactPairs.olds.length.toString()} (${contactPairs.olds[i]} -> ${contactPairs.canons[i]})`
        );
      }
    }
    logger.info(`Contact language attribute: ${stats.contactAttributesUpdated.toString()} rows updated`);

    // ---------------------------------------------------------------------------------------------
    // Summary
    // ---------------------------------------------------------------------------------------------
    if (stats.unresolvedCodes.size > 0) {
      logger.warn(
        `Left ${stats.unresolvedCodes.size.toString()} unresolvable language code(s) untouched: ${[...stats.unresolvedCodes].join(", ")}`
      );
    }
    logger.info(
      `Migration complete. Surveys updated: ${stats.surveysContentUpdated.toString()} (${stats.i18nKeysRewritten.toString()} i18n keys), responses: ${stats.responsesUpdated.toString()}, response snapshots: ${stats.responseContactAttributesUpdated.toString()}, contact attributes: ${stats.contactAttributesUpdated.toString()}`
    );
  },
};

// $queryRaw types `default`/`enabled` loosely; coerce to the booleans planSurveyLanguageMoves expects.
const asLinkArray = (rows: SurveyLanguageRow[]): SurveyLanguageRow[] =>
  rows.map((row) => ({
    languageId: row.languageId,
    surveyId: row.surveyId,
    default: Boolean(row.default),
    enabled: Boolean(row.enabled),
  }));

// The full legacy -> canonical remap from the shared canonical map, excluding identity entries. Used for
// the Response steps so we never full-scan the huge, unindexed-on-`language` table just to discover which
// codes exist; the batched UPDATE simply no-ops on any row whose value isn't a known legacy code.
const buildRemapPairsFromMap = (): { olds: string[]; canons: string[] } => {
  const olds: string[] = [];
  const canons: string[] = [];
  for (const [legacy, canonical] of Object.entries(LANGUAGE_CANONICAL_MAP)) {
    if (legacy !== canonical) {
      olds.push(legacy);
      canons.push(canonical);
    }
  }
  return { olds, canons };
};

// Build parallel old/canonical arrays for a batched UNNEST remap, keeping only codes that actually
// change and recording codes that don't resolve to a canonical form.
const buildCanonicalPairs = (
  codes: string[],
  stats: MigrationStats
): { olds: string[]; canons: string[] } => {
  const olds: string[] = [];
  const canons: string[] = [];
  for (const code of codes) {
    if (normalizeLanguageCode(code) === null) {
      stats.unresolvedCodes.add(code);
      continue;
    }
    const canonical = toCanonical(code);
    if (canonical === code) continue; // already canonical
    olds.push(code);
    canons.push(canonical);
  }
  return { olds, canons };
};
