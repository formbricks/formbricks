import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { type TResponseData, type TResponseInput, type TResponseTtc } from "@formbricks/types/responses";
import { type TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { type TSurvey } from "@formbricks/types/surveys/types";
import { generateOrganizationAIObject } from "@/lib/ai/service";
import { getLocalizedValue } from "@/lib/i18n/utils";

export const EXAMPLE_RESPONSE_COUNT = 10;
// Impression-only displays simulate respondents who saw the survey but didn't
// submit. Combined with the response count, the dashboard's completion rate
// lands around 62% — close to typical web survey benchmarks.
export const EXAMPLE_IMPRESSION_ONLY_COUNT = 6;
export const EXAMPLE_AI_GENERATED_TAG_NAME = "AI-generated example response";

// ~20% of synthetic responses are partial drop-offs to mirror typical survey
// abandonment. The remaining ~80% are finished.
const DROP_OFF_RATE = 0.2;
const RESPONSE_TIME_SPREAD_DAYS = 10;

// Realistic distributions for synthetic response metadata. Weighted toward
// common values so charts don't look uniformly random.
const META_BROWSERS = ["Chrome", "Chrome", "Chrome", "Safari", "Safari", "Firefox", "Edge"];
const META_DEVICES = ["desktop", "desktop", "desktop", "mobile", "mobile", "tablet"];
const META_OS = ["macOS", "Windows", "Windows", "iOS", "iOS", "Android", "Linux"];
const META_COUNTRIES = ["US", "US", "DE", "GB", "FR", "IN", "BR", "JP", "CA", "AU", "NL", "ES"];

// Rough ms-per-element bands used to fabricate per-element TTC. Mirrors what
// real respondents take so the analytics page's avg-time-per-question chart
// looks plausible. Values are intentionally coarse — we only need shape, not
// fidelity.
const TTC_BANDS_MS: Partial<Record<TSurveyElementTypeEnum, [number, number]>> = {
  [TSurveyElementTypeEnum.OpenText]: [8000, 30000],
  [TSurveyElementTypeEnum.MultipleChoiceSingle]: [2000, 7000],
  [TSurveyElementTypeEnum.MultipleChoiceMulti]: [4000, 12000],
  [TSurveyElementTypeEnum.Rating]: [2000, 5000],
  [TSurveyElementTypeEnum.NPS]: [2500, 6000],
  [TSurveyElementTypeEnum.CSAT]: [2000, 5000],
  [TSurveyElementTypeEnum.CES]: [3000, 7000],
  [TSurveyElementTypeEnum.Date]: [3000, 8000],
  [TSurveyElementTypeEnum.Ranking]: [8000, 20000],
  [TSurveyElementTypeEnum.Matrix]: [6000, 18000],
  [TSurveyElementTypeEnum.Address]: [15000, 45000],
  [TSurveyElementTypeEnum.ContactInfo]: [10000, 30000],
  [TSurveyElementTypeEnum.PictureSelection]: [3000, 9000],
  [TSurveyElementTypeEnum.Consent]: [2000, 5000],
};
const DEFAULT_TTC_BAND_MS: [number, number] = [3000, 10000];

// CSPRNG is overkill for preview data, but using node:crypto here avoids
// tripping static-analysis PRNG warnings; cost is negligible at this volume.
const RANDOM_FLOAT_DENOMINATOR = 2 ** 32;
const randomFloat = (): number => randomInt(RANDOM_FLOAT_DENOMINATOR) / RANDOM_FLOAT_DENOMINATOR;
const pickFrom = <T>(arr: readonly T[]): T => arr[randomInt(arr.length)];
const randomIntInclusive = (min: number, max: number): number => randomInt(min, max + 1);

const SUPPORTED_ELEMENT_TYPES = new Set<TSurveyElementTypeEnum>([
  TSurveyElementTypeEnum.OpenText,
  TSurveyElementTypeEnum.MultipleChoiceSingle,
  TSurveyElementTypeEnum.MultipleChoiceMulti,
  TSurveyElementTypeEnum.Rating,
  TSurveyElementTypeEnum.NPS,
  TSurveyElementTypeEnum.CSAT,
  TSurveyElementTypeEnum.CES,
  TSurveyElementTypeEnum.Date,
  TSurveyElementTypeEnum.Ranking,
  TSurveyElementTypeEnum.Matrix,
  TSurveyElementTypeEnum.Address,
  TSurveyElementTypeEnum.ContactInfo,
  TSurveyElementTypeEnum.PictureSelection,
  TSurveyElementTypeEnum.Consent,
]);

const DEFAULT_LANGUAGE = "default";

// Wire format for Address/ContactInfo responses is a fixed-length string array;
// hidden fields contribute empty strings at their position. Order must match
// `convertToValueArray` in the respective survey-runtime elements.
const ADDRESS_FIELD_ORDER = ["addressLine1", "addressLine2", "city", "state", "zip", "country"] as const;
const CONTACT_INFO_FIELD_ORDER = ["firstName", "lastName", "email", "phone", "company"] as const;

type TAddressField = (typeof ADDRESS_FIELD_ORDER)[number];
type TContactInfoField = (typeof CONTACT_INFO_FIELD_ORDER)[number];

type TExampleSentiment = "promoter" | "positive" | "neutral" | "skeptical" | "detractor";
type TExampleVerbosity = "brief" | "normal" | "detailed";
type TExamplePolish = "clean" | "casual" | "rough";

type TExampleRespondentProfile = {
  sentiment: TExampleSentiment;
  persona: string;
  verbosity: TExampleVerbosity;
  polish: TExamplePolish;
  priorities: string[];
};

type TExampleResponsePlanRow = {
  rowId: string;
  profile: TExampleRespondentProfile;
  data: TResponseData;
  ttc: TResponseTtc;
  finished: boolean;
  endingId: string | null;
  language: string | null;
  meta: NonNullable<TResponseInput["meta"]>;
  createdAt: Date;
  openTextElementIds: string[];
};

export type TGeneratedExampleDisplay = {
  createdAt: Date;
};

export type TGeneratedExampleDataset = {
  responses: TGeneratedExampleResponse[];
  displays: TGeneratedExampleDisplay[];
  tagName: typeof EXAMPLE_AI_GENERATED_TAG_NAME;
};

const RESPONDENT_PROFILE_PRESETS: TExampleRespondentProfile[] = (
  [
    ["promoter", "product manager at a growing SaaS team", "detailed", "clean", "team adoption", "speed"],
    ["positive", "founder at a small company", "brief", "casual", "cost", "setup"],
    ["neutral", "operations lead comparing internal tools", "normal", "clean", "reliability", "reporting"],
    [
      "skeptical",
      "software engineer maintaining data workflows",
      "normal",
      "rough",
      "missing features",
      "reliability",
    ],
    ["positive", "customer success manager", "detailed", "clean", "team adoption", "support"],
    ["promoter", "executive stakeholder", "brief", "clean", "reporting", "speed"],
    ["neutral", "designer running user research", "detailed", "casual", "setup", "team adoption"],
    [
      "detractor",
      "developer evaluating the product for a side project",
      "brief",
      "rough",
      "cost",
      "missing features",
    ],
    ["positive", "analytics owner at a mid-market team", "normal", "clean", "reporting", "reliability"],
    ["skeptical", "team lead with a busy roadmap", "normal", "casual", "speed", "setup"],
  ] as const
).map(([sentiment, persona, verbosity, polish, priorityA, priorityB]) => ({
  sentiment,
  persona,
  verbosity,
  polish,
  priorities: [priorityA, priorityB],
}));

const ADDRESS_FIXTURES: Array<Record<TAddressField, string>> = (
  [
    ["14 Example Lane", "", "Springfield", "IL", "62701", "US"],
    ["82 Demo Street", "Suite 4", "Berlin", "BE", "10115", "DE"],
    ["5 Sample Road", "", "London", "", "SW1A 1AA", "GB"],
    ["31 Test Avenue", "Floor 2", "Toronto", "ON", "M5H 2N2", "CA"],
    ["9 Fictional Blvd", "", "Sydney", "NSW", "2000", "AU"],
  ] as const
).map(([addressLine1, addressLine2, city, state, zip, country]) => ({
  addressLine1,
  addressLine2,
  city,
  state,
  zip,
  country,
}));

const CONTACT_INFO_FIXTURES: Array<Record<TContactInfoField, string>> = (
  [
    ["Alex", "Morgan", "alex.morgan@example.com", "+1 555 0101", "Example Labs"],
    ["Jamie", "Taylor", "jamie.taylor@example.com", "+44 20 7946 0102", "Demo Works"],
    ["Sam", "Rivers", "sam.rivers@example.com", "+49 30 1234 0103", "Sample Systems"],
    ["Riley", "Chen", "riley.chen@example.com", "+61 2 5550 0104", "Fictional Studio"],
    ["Jordan", "Lee", "jordan.lee@example.com", "+1 555 0105", "Placeholder Co"],
  ] as const
).map(([firstName, lastName, email, phone, company]) => ({
  firstName,
  lastName,
  email,
  phone,
  company,
}));

// Modern surveys store this in `survey.blocks[].elements`; `survey.questions`
// is the v1-compat field and may be empty. Walk both, de-dupe by id.
const collectSurveyElements = (survey: TSurvey): TSurveyElement[] => {
  const byId = new Map<string, TSurveyElement>();
  for (const block of survey.blocks ?? []) {
    for (const element of block.elements ?? []) {
      byId.set(element.id, element);
    }
  }
  for (const question of survey.questions ?? []) {
    if (!byId.has(question.id)) byId.set(question.id, question as unknown as TSurveyElement);
  }
  return [...byId.values()];
};

const labelsForChoices = (
  element: Extract<
    TSurveyElement,
    {
      type:
        | TSurveyElementTypeEnum.MultipleChoiceSingle
        | TSurveyElementTypeEnum.MultipleChoiceMulti
        | TSurveyElementTypeEnum.Ranking;
    }
  >
): string[] => element.choices.map((c) => getLocalizedValue(c.label, DEFAULT_LANGUAGE)).filter(Boolean);

const pictureSelectionIds = (
  element: Extract<TSurveyElement, { type: TSurveyElementTypeEnum.PictureSelection }>
): string[] => element.choices.map((c) => c.id).filter(Boolean);

const matrixLabels = (element: Extract<TSurveyElement, { type: TSurveyElementTypeEnum.Matrix }>) => ({
  rows: element.rows.map((r) => getLocalizedValue(r.label, DEFAULT_LANGUAGE)).filter(Boolean),
  columns: element.columns.map((c) => getLocalizedValue(c.label, DEFAULT_LANGUAGE)).filter(Boolean),
});

const isElementSupportedForGeneration = (element: TSurveyElement): boolean => {
  switch (element.type) {
    case TSurveyElementTypeEnum.OpenText:
    case TSurveyElementTypeEnum.Rating:
    case TSurveyElementTypeEnum.NPS:
    case TSurveyElementTypeEnum.Consent:
    case TSurveyElementTypeEnum.CSAT:
    case TSurveyElementTypeEnum.CES:
    case TSurveyElementTypeEnum.Date:
      return true;
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
    case TSurveyElementTypeEnum.Ranking:
      return labelsForChoices(element).length > 0;
    case TSurveyElementTypeEnum.Matrix: {
      const { rows, columns } = matrixLabels(element);
      return rows.length > 0 && columns.length > 0;
    }
    case TSurveyElementTypeEnum.Address:
      return ADDRESS_FIELD_ORDER.some((field) => element[field].show);
    case TSurveyElementTypeEnum.PictureSelection:
      return pictureSelectionIds(element).length > 0;
    case TSurveyElementTypeEnum.ContactInfo:
      return CONTACT_INFO_FIELD_ORDER.some((field) => element[field].show);
    default:
      return false;
  }
};

const transformAnswerForElement = (element: TSurveyElement, value: unknown): unknown => {
  switch (element.type) {
    case TSurveyElementTypeEnum.Address: {
      if (typeof value !== "object" || value === null) return undefined;
      const obj = value as Partial<Record<TAddressField, string>>;
      return ADDRESS_FIELD_ORDER.map((f) => obj[f] ?? "");
    }
    case TSurveyElementTypeEnum.ContactInfo: {
      if (typeof value !== "object" || value === null) return undefined;
      const obj = value as Partial<Record<TContactInfoField, string>>;
      return CONTACT_INFO_FIELD_ORDER.map((f) => obj[f] ?? "");
    }
    default:
      return value;
  }
};

export type TExampleResponseSchemaContext = {
  supportedElementIds: string[];
  openTextElementIds: string[];
};

const buildOpenTextResponsesSchema = (): z.ZodTypeAny =>
  z.object({
    responses: z
      .array(
        z.object({
          rowId: z.string().min(1),
          answers: z.record(z.string(), z.string().min(1)),
        })
      )
      .default([]),
  });

export const buildExampleResponsesSchema = (
  survey: TSurvey
): { schema: z.ZodTypeAny; ctx: TExampleResponseSchemaContext } => {
  const supportedElements = collectSurveyElements(survey).filter(
    (element) => SUPPORTED_ELEMENT_TYPES.has(element.type) && isElementSupportedForGeneration(element)
  );
  const openTextElementIds = supportedElements
    .filter((element) => element.type === TSurveyElementTypeEnum.OpenText)
    .map((element) => element.id);

  return {
    schema: buildOpenTextResponsesSchema(),
    ctx: {
      supportedElementIds: supportedElements.map((element) => element.id),
      openTextElementIds,
    },
  };
};

const elementContextForPrompt = (element: TSurveyElement): Record<string, unknown> => {
  const base: Record<string, unknown> = {
    id: element.id,
    type: element.type,
    headline: getLocalizedValue(element.headline, DEFAULT_LANGUAGE),
    subheader: getLocalizedValue(element.subheader, DEFAULT_LANGUAGE) || undefined,
    required: element.required,
  };

  if (
    element.type === TSurveyElementTypeEnum.MultipleChoiceSingle ||
    element.type === TSurveyElementTypeEnum.MultipleChoiceMulti ||
    element.type === TSurveyElementTypeEnum.Ranking
  ) {
    base.choices = labelsForChoices(element);
  }
  if (element.type === TSurveyElementTypeEnum.Rating || element.type === TSurveyElementTypeEnum.CES) {
    base.scale = element.scale;
    base.range = element.range;
  }
  if (element.type === TSurveyElementTypeEnum.CSAT) {
    base.scale = element.scale;
    base.range = element.range;
  }
  if (element.type === TSurveyElementTypeEnum.Matrix) {
    base.rows = matrixLabels(element).rows;
    base.columns = matrixLabels(element).columns;
  }

  return base;
};

const buildPlannedAnswerContext = (row: TExampleResponsePlanRow, elementsById: Map<string, TSurveyElement>) =>
  Object.entries(row.data).map(([elementId, answer]) => {
    const element = elementsById.get(elementId);
    return {
      elementId,
      question: element ? getLocalizedValue(element.headline, DEFAULT_LANGUAGE) : undefined,
      type: element?.type,
      answer,
    };
  });

const buildOpenTextLlmContext = (survey: TSurvey, rows: TExampleResponsePlanRow[]) => {
  const openTextElementIds = new Set(rows.flatMap((row) => row.openTextElementIds));
  const supportedElements = collectSurveyElements(survey).filter(
    (element) => SUPPORTED_ELEMENT_TYPES.has(element.type) && isElementSupportedForGeneration(element)
  );
  const elementsById = new Map(supportedElements.map((element) => [element.id, element]));
  const openTextElements = supportedElements
    .filter((element) => openTextElementIds.has(element.id))
    .map(elementContextForPrompt);

  return {
    surveyTitle: survey.name,
    surveyDescription: survey.welcomeCard?.headline
      ? getLocalizedValue(survey.welcomeCard.headline, DEFAULT_LANGUAGE)
      : undefined,
    surveyElements: supportedElements.map(elementContextForPrompt),
    openTextElements,
    rows: rows.map((row) => ({
      rowId: row.rowId,
      profile: row.profile,
      requestedOpenTextAnswers: row.openTextElementIds.map((elementId) => {
        const element = elementsById.get(elementId);
        return {
          elementId,
          question: element ? getLocalizedValue(element.headline, DEFAULT_LANGUAGE) : undefined,
          subheader: element
            ? getLocalizedValue(element.subheader, DEFAULT_LANGUAGE) || undefined
            : undefined,
        };
      }),
      plannedAnswers: buildPlannedAnswerContext(row, elementsById),
      finished: row.finished,
    })),
  };
};

const SYSTEM_PROMPT = `You write only the free-text answers for synthetic Formbricks survey responses.
Rules:
- Produce exactly one object per requested rowId.
- Fill only the requestedOpenTextAnswers for each row, keyed by each requested elementId.
- Answer each specific open-text question directly. A "main benefit" question needs a benefit; an "improve" question needs an improvement idea; an audience question needs an audience.
- Use the whole survey context and planned answers to keep the respondent coherent across the survey.
- Match the respondent profile, sentiment, priorities, and already-planned answers.
- Use the requested verbosity and polish for each row, and keep that style consistent across all open-text answers in the same row.
- Write like different real respondents, not one synthetic persona.
- Avoid repeating the same answer, opening, or sentence template across rows or across questions in the same row.
- Do not simply restate the question. Avoid starting many answers with phrases like "I think", "The main benefit is", "I would improve", or "For me".
- Match the language of the element headline.
- No corporate buzzwords. No "I would like to commend the team for..." energy.`;

export type TGenerateExampleResponsesArgs = {
  survey: TSurvey;
  organizationId: string;
};

export type TGeneratedExampleResponse = {
  data: TResponseData;
  ttc: TResponseTtc;
  finished: boolean;
  endingId: string | null;
  language: string | null;
  meta: NonNullable<TResponseInput["meta"]>;
  createdAt: Date;
};

const buildRespondentProfiles = (count: number): TExampleRespondentProfile[] =>
  Array.from(
    { length: count },
    (_, index) => RESPONDENT_PROFILE_PRESETS[index % RESPONDENT_PROFILE_PRESETS.length]
  );

// Picks an enabled non-default survey language at random ~30% of the time;
// otherwise leaves it null so the response uses the survey default. Mirrors a
// real distribution where most respondents use the default language.
const pickResponseLanguage = (survey: TSurvey): string | null => {
  const enabledNonDefault = (survey.languages ?? []).filter((l) => l.enabled && !l.default);
  if (enabledNonDefault.length === 0) return null;
  if (randomInt(10) >= 3) return null;
  return pickFrom(enabledNonDefault).language.code;
};

const buildResponseMeta = (): NonNullable<TResponseInput["meta"]> => ({
  source: "example-generation",
  userAgent: {
    browser: pickFrom(META_BROWSERS),
    device: pickFrom(META_DEVICES),
    os: pickFrom(META_OS),
  },
  country: pickFrom(META_COUNTRIES),
});

// Spread createdAt across the last N days, weighted slightly toward more
// recent dates so the responses-over-time chart trends upward.
const pickCreatedAt = (): Date => {
  const now = Date.now();
  const skew = randomFloat() ** 1.6; // bias toward 0 → more recent
  const daysAgo = skew * RESPONSE_TIME_SPREAD_DAYS;
  return new Date(now - daysAgo * 24 * 60 * 60 * 1000);
};

const ttcForElement = (element: TSurveyElement): number => {
  const band = TTC_BANDS_MS[element.type] ?? DEFAULT_TTC_BAND_MS;
  return randomIntInclusive(band[0], band[1]);
};

const hashString = (value: string): number =>
  [...value].reduce((acc, char) => (acc * 31 + (char.codePointAt(0) ?? 0)) % 997, 0);

const shouldSkipOptionalElement = (element: TSurveyElement, rowIndex: number): boolean => {
  if (element.required) return false;
  return (hashString(element.id) + rowIndex) % 5 === 0;
};

const getLumpyIndex = (optionCount: number, rowIndex: number): number => {
  if (optionCount <= 1) return 0;
  const lumpyPattern = [0, 0, 1, 0, 2, 1, 0, 3, 1, 4];
  return Math.min(lumpyPattern[rowIndex % lumpyPattern.length], optionCount - 1);
};

const getScoreForProfile = (
  profile: TExampleRespondentProfile,
  rowIndex: number,
  min: number,
  max: number
): number => {
  const clampedMax = Math.max(min, max);
  const span = clampedMax - min;
  const top = clampedMax;
  const high = min + Math.max(0, Math.round(span * 0.75));
  const middle = min + Math.max(0, Math.round(span * 0.5));
  const low = min + Math.max(0, Math.round(span * 0.25));

  switch (profile.sentiment) {
    case "promoter":
      return rowIndex % 2 === 0 ? top : Math.max(min, top - 1);
    case "positive":
      return Math.max(min, rowIndex % 3 === 0 ? high : top);
    case "neutral":
      return Math.min(clampedMax, rowIndex % 2 === 0 ? middle : middle + 1);
    case "skeptical":
      return Math.max(min, rowIndex % 2 === 0 ? low : middle);
    case "detractor":
      return Math.max(min, rowIndex % 2 === 0 ? min : low);
  }
};

const getNpsForProfile = (profile: TExampleRespondentProfile, rowIndex: number): number => {
  switch (profile.sentiment) {
    case "promoter":
      return rowIndex % 2 === 0 ? 10 : 9;
    case "positive":
      return rowIndex % 2 === 0 ? 9 : 8;
    case "neutral":
      return rowIndex % 2 === 0 ? 8 : 7;
    case "skeptical":
      return rowIndex % 2 === 0 ? 6 : 5;
    case "detractor":
      return rowIndex % 2 === 0 ? 3 : 2;
  }
};

const getIsoDateForRow = (rowIndex: number): string => {
  const daysAgo = ((rowIndex + 1) * 23) % 365;
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

const rotate = <T>(values: T[], startIndex: number): T[] => [
  ...values.slice(startIndex),
  ...values.slice(0, startIndex),
];

const pickAddressValue = (
  element: Extract<TSurveyElement, { type: TSurveyElementTypeEnum.Address }>,
  rowIndex: number
): Partial<Record<TAddressField, string>> => {
  const fixture = ADDRESS_FIXTURES[rowIndex % ADDRESS_FIXTURES.length];
  return Object.fromEntries(
    ADDRESS_FIELD_ORDER.filter((field) => element[field].show).map((field) => [field, fixture[field]])
  );
};

const pickContactInfoValue = (
  element: Extract<TSurveyElement, { type: TSurveyElementTypeEnum.ContactInfo }>,
  rowIndex: number
): Partial<Record<TContactInfoField, string>> => {
  const fixture = CONTACT_INFO_FIXTURES[rowIndex % CONTACT_INFO_FIXTURES.length];
  return Object.fromEntries(
    CONTACT_INFO_FIELD_ORDER.filter((field) => element[field].show).map((field) => [field, fixture[field]])
  );
};

const buildClosedAnswerForElement = (
  element: TSurveyElement,
  profile: TExampleRespondentProfile,
  rowIndex: number
): unknown => {
  switch (element.type) {
    case TSurveyElementTypeEnum.OpenText:
      return undefined;
    case TSurveyElementTypeEnum.MultipleChoiceSingle: {
      const labels = labelsForChoices(element);
      return labels[getLumpyIndex(labels.length, rowIndex)];
    }
    case TSurveyElementTypeEnum.MultipleChoiceMulti: {
      const labels = labelsForChoices(element);
      const first = getLumpyIndex(labels.length, rowIndex);
      const picks = [labels[first]];
      if (labels.length > 1 && rowIndex % 3 !== 0) {
        picks.push(labels[(first + 1 + (rowIndex % (labels.length - 1))) % labels.length]);
      }
      return [...new Set(picks)];
    }
    case TSurveyElementTypeEnum.Rating:
      return getScoreForProfile(profile, rowIndex, 1, element.range ?? 5);
    case TSurveyElementTypeEnum.NPS:
      return getNpsForProfile(profile, rowIndex);
    case TSurveyElementTypeEnum.CSAT:
      return getScoreForProfile(profile, rowIndex, 1, element.range ?? 5);
    case TSurveyElementTypeEnum.CES:
      return getScoreForProfile(profile, rowIndex, 1, element.range);
    case TSurveyElementTypeEnum.Date:
      return getIsoDateForRow(rowIndex);
    case TSurveyElementTypeEnum.Ranking: {
      const labels = labelsForChoices(element);
      return rotate(labels, getLumpyIndex(labels.length, rowIndex));
    }
    case TSurveyElementTypeEnum.Matrix: {
      const { rows, columns } = matrixLabels(element);
      return Object.fromEntries(
        rows.map((row, index) => [row, columns[getLumpyIndex(columns.length, rowIndex + index)]])
      );
    }
    case TSurveyElementTypeEnum.Address:
      return pickAddressValue(element, rowIndex);
    case TSurveyElementTypeEnum.ContactInfo:
      return pickContactInfoValue(element, rowIndex);
    case TSurveyElementTypeEnum.PictureSelection: {
      const ids = pictureSelectionIds(element);
      const first = getLumpyIndex(ids.length, rowIndex);
      if (!element.allowMulti || ids.length === 1) return [ids[first]];
      const picks = [ids[first]];
      if (rowIndex % 3 !== 0) picks.push(ids[(first + 1) % ids.length]);
      return [...new Set(picks)];
    }
    case TSurveyElementTypeEnum.Consent:
      return "accepted";
    default:
      return undefined;
  }
};

const applyDropOffToPlanRow = (
  row: TExampleResponsePlanRow,
  orderedElementIds: string[]
): TExampleResponsePlanRow => {
  if (orderedElementIds.length <= 1 || row.finished) return row;
  const rowNumber = Number(row.rowId.replace("row_", "")) || 0;
  const dropIndex = 1 + (rowNumber % (orderedElementIds.length - 1));
  const keptIds = new Set(orderedElementIds.slice(0, dropIndex));
  const newData: TResponseData = {};
  const newTtc: TResponseTtc = {};
  for (const id of keptIds) {
    if (row.data[id] !== undefined) newData[id] = row.data[id];
    if (row.ttc[id] !== undefined) newTtc[id] = row.ttc[id];
  }
  return {
    ...row,
    data: newData,
    ttc: newTtc,
    openTextElementIds: row.openTextElementIds.filter((id) => keptIds.has(id)),
  };
};

const buildExampleResponsePlan = (survey: TSurvey): TExampleResponsePlanRow[] => {
  const { ctx } = buildExampleResponsesSchema(survey);
  if (ctx.supportedElementIds.length === 0) {
    return [];
  }

  const elementsById = new Map(collectSurveyElements(survey).map((el) => [el.id, el]));
  const finishedEndingId = survey.endings?.[0]?.id ?? null;
  const profiles = buildRespondentProfiles(EXAMPLE_RESPONSE_COUNT);

  return profiles.map((profile, index) => {
    const data: TResponseData = {};
    const ttc: TResponseTtc = {};
    const openTextElementIds: string[] = [];

    for (const id of ctx.supportedElementIds) {
      const element = elementsById.get(id);
      if (!element || shouldSkipOptionalElement(element, index)) continue;

      if (element.type === TSurveyElementTypeEnum.OpenText) {
        openTextElementIds.push(id);
        ttc[id] = ttcForElement(element);
        continue;
      }

      const answer = buildClosedAnswerForElement(element, profile, index);
      const transformed = transformAnswerForElement(element, answer);
      if (transformed === undefined) continue;
      data[id] = transformed as TResponseData[string];
      ttc[id] = ttcForElement(element);
    }

    const isFinished = index >= Math.ceil(EXAMPLE_RESPONSE_COUNT * DROP_OFF_RATE);
    const row: TExampleResponsePlanRow = {
      rowId: `row_${index}`,
      profile,
      data,
      ttc,
      finished: isFinished,
      endingId: isFinished ? finishedEndingId : null,
      language: pickResponseLanguage(survey),
      meta: buildResponseMeta(),
      createdAt: pickCreatedAt(),
      openTextElementIds,
    };

    return applyDropOffToPlanRow(row, ctx.supportedElementIds);
  });
};

const ensureTrailingPunctuation = (value: string): string =>
  /[.!?]$/.test(value.trim()) ? value.trim() : `${value.trim()}.`;

const lowercaseFirst = (value: string): string => value.charAt(0).toLowerCase() + value.slice(1);

const uppercaseFirst = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const applyFallbackStyle = (answer: string, profile: TExampleRespondentProfile): string => {
  const trimmed = ensureTrailingPunctuation(answer);

  if (profile.polish === "rough") {
    return lowercaseFirst(trimmed);
  }

  if (profile.polish === "casual" && profile.verbosity === "brief") {
    return lowercaseFirst(trimmed);
  }

  return uppercaseFirst(trimmed);
};

const buildFallbackOpenTextAnswer = (
  profile: TExampleRespondentProfile,
  element: TSurveyElement | undefined
): string => {
  const headline = element ? getLocalizedValue(element.headline, DEFAULT_LANGUAGE).toLowerCase() : "";
  const variant = hashString(`${profile.persona}-${headline}`) % 4;
  const secondaryPriority = profile.priorities[1] ?? profile.priorities[0];

  if (headline.includes("who") || headline.includes("people") || headline.includes("benefit from")) {
    const answers = [
      `Teams like ${profile.persona}s, especially when ${profile.priorities[0]} matters.`,
      `Best fit is probably ${profile.persona}s who care about ${profile.priorities[0]}.`,
      `${profile.persona}s would get the most out of it.`,
      `Mostly ${profile.persona}s with a lot of pressure around ${profile.priorities[0]}.`,
    ];
    return applyFallbackStyle(answers[variant], profile);
  }

  if (headline.includes("benefit")) {
    const answers = [
      `Better ${profile.priorities[0]} without much extra setup.`,
      `It saves time around ${profile.priorities[0]}, which is what I notice first.`,
      `Clearer ${profile.priorities[0]} for the team.`,
      `${profile.priorities[0]} feels easier to stay on top of now.`,
    ];
    return applyFallbackStyle(
      profile.verbosity === "brief" ? answers[variant].split(",")[0] : answers[variant],
      profile
    );
  }

  if (headline.includes("improve") || headline.includes("better")) {
    const answers = [
      `Make ${secondaryPriority} easier to configure.`,
      `A bit more guidance around ${secondaryPriority} would help.`,
      `Tighten up ${secondaryPriority}; that is where I still slow down.`,
      `${secondaryPriority} could be clearer for first-time users.`,
    ];
    return applyFallbackStyle(answers[variant], profile);
  }

  switch (profile.verbosity) {
    case "brief":
      return applyFallbackStyle(
        profile.sentiment === "detractor" ? "Not enough value yet." : "Helpful so far.",
        profile
      );
    case "detailed":
      return applyFallbackStyle(
        `As a ${profile.persona}, I mostly care about ${profile.priorities.join(
          " and "
        )}. The experience is ${profile.sentiment === "detractor" ? "not quite there yet" : "moving in the right direction"}.`,
        profile
      );
    case "normal":
      return applyFallbackStyle(
        `It mainly helps with ${profile.priorities[0]}, though I would still watch ${profile.priorities[1]}.`,
        profile
      );
  }
};

const fillOpenTextAnswers = async (
  survey: TSurvey,
  organizationId: string,
  planRows: TExampleResponsePlanRow[]
): Promise<TExampleResponsePlanRow[]> => {
  const rowsNeedingText = planRows.filter((row) => row.openTextElementIds.length > 0);
  if (rowsNeedingText.length === 0) return planRows;
  const elementsById = new Map(collectSurveyElements(survey).map((element) => [element.id, element]));

  const { object } = await generateOrganizationAIObject<{
    responses: Array<{ rowId: string; answers: Record<string, string> }>;
  }>({
    organizationId,
    schema: buildOpenTextResponsesSchema() as z.ZodType<{
      responses: Array<{ rowId: string; answers: Record<string, string> }>;
    }>,
    system: SYSTEM_PROMPT,
    prompt: `Write free-text answers for these planned synthetic survey responses.

Survey context (JSON):
${JSON.stringify(buildOpenTextLlmContext(survey, rowsNeedingText), null, 2)}`,
  });

  const answersByRowId = new Map(object.responses.map((response) => [response.rowId, response.answers]));

  return planRows.map((row) => {
    if (row.openTextElementIds.length === 0) return row;

    const answers = answersByRowId.get(row.rowId) ?? {};
    const data = { ...row.data };
    for (const elementId of row.openTextElementIds) {
      data[elementId] = (answers[elementId] ||
        buildFallbackOpenTextAnswer(row.profile, elementsById.get(elementId))) as TResponseData[string];
    }

    return { ...row, data };
  });
};

const toGeneratedResponse = (row: TExampleResponsePlanRow): TGeneratedExampleResponse => ({
  data: row.data,
  ttc: row.ttc,
  finished: row.finished,
  endingId: row.endingId,
  language: row.language,
  meta: row.meta,
  createdAt: row.createdAt,
});

export const generateExampleResponseDataset = async ({
  survey,
  organizationId,
}: TGenerateExampleResponsesArgs): Promise<TGeneratedExampleDataset> => {
  const planRows = buildExampleResponsePlan(survey);
  if (planRows.length === 0) {
    return { responses: [], displays: [], tagName: EXAMPLE_AI_GENERATED_TAG_NAME };
  }

  const rowsWithText = await fillOpenTextAnswers(survey, organizationId, planRows);

  return {
    responses: rowsWithText.map(toGeneratedResponse),
    displays: buildExampleImpressionTimestamps(EXAMPLE_IMPRESSION_ONLY_COUNT).map((createdAt) => ({
      createdAt,
    })),
    tagName: EXAMPLE_AI_GENERATED_TAG_NAME,
  };
};

export const generateExampleResponses = async (
  args: TGenerateExampleResponsesArgs
): Promise<TGeneratedExampleResponse[]> => (await generateExampleResponseDataset(args)).responses;

export const toExampleResponseInput = (
  surveyId: string,
  workspaceId: string,
  generated: TGeneratedExampleResponse,
  displayId?: string
): TResponseInput => ({
  workspaceId,
  surveyId,
  finished: generated.finished,
  endingId: generated.endingId,
  language: generated.language ?? undefined,
  data: generated.data,
  ttc: generated.ttc,
  meta: generated.meta,
  ...(displayId ? { displayId } : {}),
});

// Builds timestamps for impression-only displays — same distribution shape as
// response createdAt so the two trends look consistent on the dashboard.
export const buildExampleImpressionTimestamps = (count: number): Date[] =>
  Array.from({ length: count }, () => pickCreatedAt());
