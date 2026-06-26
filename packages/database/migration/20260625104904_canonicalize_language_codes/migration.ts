import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";
import type { LanguageRow, MigrationStats, SurveyContentRow, SurveyLanguageRow } from "./types";
import { planLanguageMerges, planSurveyLanguageMoves, rewriteI18nKeys, toCanonical } from "./utils";

const SURVEY_BATCH_SIZE = 150;

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
  run: async ({ tx }) => {
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

      // Carry over default/enabled flags onto the survivor's surviving link.
      for (const update of moves.flagUpdates) {
        await tx.$executeRawUnsafe(
          `UPDATE "SurveyLanguage" SET "default" = $1, enabled = $2 WHERE "languageId" = $3 AND "surveyId" = $4`,
          update.default,
          update.enabled,
          merge.survivorId,
          update.surveyId
        );
      }

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
    const surveys = await tx.$queryRaw<SurveyContentRow[]>`
      SELECT id, "welcomeCard", blocks, endings, metadata, "surveyClosedMessage", questions
      FROM "Survey"
      WHERE id IN (SELECT "surveyId" FROM "SurveyLanguage" GROUP BY "surveyId" HAVING COUNT(*) > 1)
    `;
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
        if (!result.changed) continue;

        stats.i18nKeysRewritten += result.keysRewritten;
        for (const code of result.unresolved) stats.unresolvedCodes.add(code);

        const paramIndex = params.length + 1;
        params.push(JSON.stringify(result.value));
        if (field.kind === "jsonArray") {
          setClauses.push(
            `"${field.column}" = COALESCE((SELECT array_agg(elem) FROM jsonb_array_elements($${paramIndex.toString()}::jsonb) elem), ARRAY[]::jsonb[])`
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
      await Promise.all(
        batch.map((update) =>
          tx.$executeRawUnsafe(
            `UPDATE "Survey" SET ${update.setClauses.join(", ")} WHERE id = $${(update.params.length + 1).toString()}`,
            ...update.params,
            update.id
          )
        )
      );
      logger.info(
        `Survey content progress: ${Math.min(i + SURVEY_BATCH_SIZE, surveyUpdates.length).toString()}/${surveyUpdates.length.toString()}`
      );
    }
    stats.surveysContentUpdated = surveyUpdates.length;

    // ---------------------------------------------------------------------------------------------
    // 3. Response.language (skip NULL, the "default" sentinel, and already-canonical values)
    // ---------------------------------------------------------------------------------------------
    logger.info("Canonicalizing Response.language...");
    const responseCodes = await tx.$queryRaw<{ language: string }[]>`
      SELECT DISTINCT language FROM "Response"
      WHERE language IS NOT NULL AND language <> 'default'
    `;
    const responsePairs = buildCanonicalPairs(
      responseCodes.map((r) => r.language),
      stats
    );
    if (responsePairs.olds.length > 0) {
      const updated = await tx.$executeRawUnsafe(
        `UPDATE "Response" AS r
         SET language = data.canon
         FROM (SELECT unnest($1::text[]) AS old, unnest($2::text[]) AS canon) AS data
         WHERE r.language = data.old`,
        responsePairs.olds,
        responsePairs.canons
      );
      stats.responsesUpdated = typeof updated === "number" ? updated : 0;
    }
    logger.info(
      `Response.language: ${responsePairs.olds.length.toString()} distinct codes remapped, ${stats.responsesUpdated.toString()} rows updated`
    );

    // 3b. Response.contactAttributes snapshot `language` key. This JSON is a point-in-time copy of the
    // contact's attributes; it isn't used to pick the render language, but we still canonicalize it so the
    // stored value stays consistent with the contact attribute and Response.language.
    const responseSnapshotCodes = await tx.$queryRaw<{ language: string }[]>`
      SELECT DISTINCT "contactAttributes" ->> 'language' AS language
      FROM "Response"
      WHERE "contactAttributes" ? 'language'
        AND "contactAttributes" ->> 'language' NOT IN ('', 'default')
    `;
    const snapshotPairs = buildCanonicalPairs(
      responseSnapshotCodes.map((r) => r.language),
      stats
    );
    if (snapshotPairs.olds.length > 0) {
      const updated = await tx.$executeRawUnsafe(
        `UPDATE "Response" AS r
         SET "contactAttributes" = jsonb_set(r."contactAttributes", '{language}', to_jsonb(data.canon))
         FROM (SELECT unnest($1::text[]) AS old, unnest($2::text[]) AS canon) AS data
         WHERE r."contactAttributes" ->> 'language' = data.old`,
        snapshotPairs.olds,
        snapshotPairs.canons
      );
      stats.responseContactAttributesUpdated = typeof updated === "number" ? updated : 0;
    }
    logger.info(
      `Response.contactAttributes language: ${snapshotPairs.olds.length.toString()} distinct codes remapped, ${stats.responseContactAttributesUpdated.toString()} rows updated`
    );

    // ---------------------------------------------------------------------------------------------
    // 4. Contact `language` attribute value
    // ---------------------------------------------------------------------------------------------
    logger.info("Canonicalizing contact language attribute values...");
    // Resolve the workspace-scoped `language` attribute keys up front so the queries below can hit the
    // `[attributeKeyId, value]` index directly (attributeKeyId = ANY + value =), instead of joining the
    // whole (potentially millions-of-rows) ContactAttribute table to ContactAttributeKey — that join
    // planned badly and made this step crawl.
    const languageKeyRows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "ContactAttributeKey" WHERE key = 'language'
    `;
    const languageKeyIds = languageKeyRows.map((row) => row.id);
    logger.info(`Found ${languageKeyIds.length.toString()} language attribute keys`);

    if (languageKeyIds.length > 0) {
      const contactCodes = await tx.$queryRawUnsafe<{ value: string }[]>(
        `SELECT DISTINCT value FROM "ContactAttribute"
         WHERE "attributeKeyId" = ANY($1::text[]) AND value <> '' AND value <> 'default'`,
        languageKeyIds
      );
      const contactPairs = buildCanonicalPairs(
        contactCodes.map((c) => c.value),
        stats
      );
      // One UPDATE per distinct code, so each hits the index and we get visible progress.
      for (let i = 0; i < contactPairs.olds.length; i++) {
        const updated = await tx.$executeRawUnsafe(
          `UPDATE "ContactAttribute" SET value = $1
           WHERE "attributeKeyId" = ANY($2::text[]) AND value = $3`,
          contactPairs.canons[i],
          languageKeyIds,
          contactPairs.olds[i]
        );
        stats.contactAttributesUpdated += typeof updated === "number" ? updated : 0;
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
    // throw new Error("Stopping Migration.");
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
