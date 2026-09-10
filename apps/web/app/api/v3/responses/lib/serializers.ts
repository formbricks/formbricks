import type { TEmbeddedValueResponse } from "@formbricks/types/embedded-data-resolver";
import type { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { buildAnswerPlan, serializeAnswers, sumV3DurationSeconds } from "./answers";
import { buildEmbeddedDataPlan, serializeEmbeddedData } from "./embedded-data";
import { resolveV3LabelContext } from "./label-resolution";
import type {
  TV3ResponseContact,
  TV3ResponseListItem,
  TV3ResponseResource,
  TV3ResponseTag,
  TV3ResponseUnresolvedEntry,
} from "./resources";
import type { TV3ResponseRow, TV3ResponseSurveyRow } from "./service";

/**
 * Composing one stored response into the two published views.
 *
 * This module holds no rules of its own. `answers.ts`, `embedded-data.ts` and `label-resolution.ts`
 * each own one, and the job here is to run them against the right inputs, in the right order, once
 * per response — plus the two derivations that belong to neither: the envelope and `resolution`.
 *
 * ## Why this is a factory rather than two functions
 *
 * A list page is up to 250 responses and may span every survey in a workspace, so the per-survey
 * work has to be done once per survey rather than once per row. There are two such plans and they
 * are keyed differently:
 *
 * - the **embedded-data plan** depends only on the survey, so it is cached by survey id;
 * - the **answer plan** localizes every element headline, so it depends on the survey *and* the
 *   language the response was collected in. Caching it by survey id alone would serve German labels
 *   for an English response on any survey whose page mixes languages.
 *
 * Both caches live for one call — they are request state, not a shared cache, so nothing here can
 * serve a stale survey definition to a later request.
 */

/** The survey-scoped inputs a response is serialized against. */
type TPlanKey = string;

/**
 * Cache key for the per-(survey, language) answer plan. A space separates them unambiguously:
 * a survey id is a cuid and a lookup key is a BCP-47 code or the literal `default`, so neither
 * side can contain one and no pair of inputs can collide on the joined string.
 */
const planKey = (surveyId: string, lookupKey: string): TPlanKey => `${surveyId} ${lookupKey}`;

/**
 * The stored fields the Embedded Data resolver reads.
 *
 * The read row carries more than the resolver's own input type names, and its `data` / `variables`
 * / `meta` arrive as Prisma `JsonValue`. This narrows once, at the single point where the two types
 * meet, instead of casting at each of the resolver's call sites.
 */
const asEmbeddedValueResponse = (row: TV3ResponseRow): TEmbeddedValueResponse =>
  ({
    id: row.id,
    surveyId: row.surveyId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    finished: row.finished,
    language: row.language,
    data: row.data,
    variables: row.variables,
    ttc: row.ttc,
    meta: row.meta,
  }) as unknown as TEmbeddedValueResponse;

/**
 * `contact.userId` is an attribute row, not a column, so it arrives as a filtered one-element list.
 * Absent is `null` rather than omitted: the contract marks the field optional, but a caller reading
 * a contact it cannot name is better served by an explicit null than by a missing key.
 */
const toContact = (contact: TV3ResponseRow["contact"]): TV3ResponseContact | null =>
  contact ? { id: contact.id, userId: contact.attributes[0]?.value ?? null } : null;

const toTags = (tags: TV3ResponseRow["tags"]): TV3ResponseTag[] =>
  tags.map(({ tag }) => ({ id: tag.id, name: tag.name }));

export interface TV3ResponseSerializer {
  toListItem: (row: TV3ResponseRow, survey: TV3ResponseSurveyRow) => TV3ResponseListItem;
  toResource: (row: TV3ResponseRow, survey: TV3ResponseSurveyRow) => TV3ResponseResource;
}

export const createV3ResponseSerializer = (): TV3ResponseSerializer => {
  const answerPlans = new Map<TPlanKey, ReturnType<typeof buildAnswerPlan>>();
  const embeddedPlans = new Map<string, ReturnType<typeof buildEmbeddedDataPlan>>();

  const answerPlanFor = (survey: TV3ResponseSurveyRow, lookupKey: string) => {
    const key = planKey(survey.id, lookupKey);
    const cached = answerPlans.get(key);
    if (cached) return cached;

    // Hidden fields share the answer map, so `answers[]` skips their storage keys — except where an
    // element claims one, which `buildAnswerPlan` resolves itself. Variables are excluded here
    // because they are keyed by cuid in a different map and can never appear in `data`.
    const ingestedStorageKeys = (survey.embeddedFields ?? [])
      .filter(({ field }) => field.source === "ingested")
      .map(({ link }) => link.storageKey);

    const plan = buildAnswerPlan(survey.blocks as TSurveyBlock[], lookupKey, ingestedStorageKeys);
    answerPlans.set(key, plan);
    return plan;
  };

  const embeddedPlanFor = (survey: TV3ResponseSurveyRow) => {
    const cached = embeddedPlans.get(survey.id);
    if (cached) return cached;

    const elementIds = (survey.blocks as TSurveyBlock[]).flatMap((block) =>
      block.elements.map((element) => element.id)
    );

    const plan = buildEmbeddedDataPlan(survey.embeddedFields ?? [], elementIds);
    embeddedPlans.set(survey.id, plan);
    return plan;
  };

  const toListItem = (row: TV3ResponseRow, survey: TV3ResponseSurveyRow): TV3ResponseListItem => {
    const { lookupKey, labelsLanguage } = resolveV3LabelContext(survey.languages, row.language);

    const answerResult = serializeAnswers(
      answerPlanFor(survey, lookupKey),
      (row.data ?? {}) as TResponseData,
      (row.ttc ?? undefined) as TResponseTtc | undefined
    );
    const embeddedResult = serializeEmbeddedData(embeddedPlanFor(survey), asEmbeddedValueResponse(row));

    // Answers first, then Embedded Data — the order the two collections appear in the payload, so a
    // caller reading `unresolved[]` top to bottom walks the response the same way twice. Neither
    // module can report the same key, since each skips what the other owns.
    const unresolved: TV3ResponseUnresolvedEntry[] = [
      ...answerResult.unresolved,
      ...embeddedResult.unresolved,
    ];

    const durationSeconds = sumV3DurationSeconds((row.ttc ?? undefined) as TResponseTtc | undefined);

    return {
      id: row.id,
      surveyId: row.surveyId,
      surveyName: survey.name,
      workspaceId: survey.workspaceId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      finished: row.finished,
      endingId: row.endingId,
      language: row.language,
      ...(durationSeconds === undefined ? {} : { durationSeconds }),
      resolution: {
        labelPolicy: "currentSurveyDefinition",
        labelsLanguage,
        // The survey's timestamp, not the response's: it is what says which definition the labels
        // above were resolved against, so a client can tell a re-labelled read from a changed one.
        surveyUpdatedAt: survey.updatedAt.toISOString(),
      },
      answers: answerResult.answers,
      embeddedData: embeddedResult.embeddedData,
      unresolved,
      tags: toTags(row.tags),
    };
  };

  /**
   * The detailed view: the list item plus the four fields a single-row read adds.
   *
   * `data` is returned exactly as stored, because it is what `PATCH` accepts — a client corrects an
   * answer by editing this map and sending it back. The typed `answers[]` alongside it is an
   * addition, not a replacement, so nothing here reshapes the map on the way out.
   */
  const toResource = (row: TV3ResponseRow, survey: TV3ResponseSurveyRow): TV3ResponseResource => ({
    ...toListItem(row, survey),
    contact: toContact(row.contact),
    displayId: row.displayId,
    singleUseId: row.singleUseId,
    data: (row.data ?? {}) as TV3ResponseResource["data"],
  });

  return { toListItem, toResource };
};
