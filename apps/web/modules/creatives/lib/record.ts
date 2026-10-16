import { ZShowConditions } from "@formbricks/types/show-conditions";
import { getEffectiveVisibility } from "@/lib/survey/visibility/policy";
import {
  CREATIVE_TYPE_SCHEMAS,
  type TCreativeState,
  type TCreativeTypedGroups,
  type TDestinationSurveyIssue,
  toCreativeShowConditions,
} from "./creative";
import type { TCreativeRecord, TCreativeRowData, TDestinationSurveyFacts } from "./repository";

/**
 * Between a stored row and the domain state. The JSON columns are parsed with the same per-type schemas
 * every write is validated with, so a row that no longer fits fails loudly here rather than reaching a
 * client in a shape the contract doesn't promise.
 */

const parseTypedGroups = (
  record: Pick<TCreativeRecord, "type" | "content" | "styling">
): TCreativeTypedGroups => {
  if (record.type === "feedbackButton") {
    const schemas = CREATIVE_TYPE_SCHEMAS.feedbackButton;
    return {
      type: "feedbackButton",
      content: schemas.content.parse(record.content),
      styling: schemas.styling.parse(record.styling),
    };
  }
  const schemas = CREATIVE_TYPE_SCHEMAS.banner;
  return {
    type: "banner",
    content: schemas.content.parse(record.content),
    styling: schemas.styling.parse(record.styling),
  };
};

const getDestination = (record: TCreativeRecord): TCreativeState["destination"] => {
  if (record.surveyId) return { type: "survey", surveyId: record.surveyId };
  if (record.linkUrl) return { type: "link", url: record.linkUrl };
  return null;
};

export const toCreativeState = (record: TCreativeRecord): TCreativeState => {
  const defaultLanguage = record.languages.find((language) => language.default)?.language.code ?? "en-US";

  return {
    ...parseTypedGroups(record),
    name: record.name,
    status: record.status,
    publishedAt: record.publishedAt,
    archivedAt: record.archivedAt,
    defaultLanguage,
    languages: record.languages
      .filter((language) => !language.default)
      .map((language) => ({ code: language.language.code, enabled: language.enabled }))
      .sort((left, right) => left.code.localeCompare(right.code)),
    destination: getDestination(record),
    distribution: {
      showOn: record.showOn,
      triggers: record.triggers.map(({ actionClassId }) => ({ actionClassId })),
      conditions: ZShowConditions.parse(record.showConditions ?? null),
      displayPercentage: record.displayPercentage,
    },
    schedule: { startAt: record.startAt, endAt: record.endAt },
  };
};

/** The columns a state writes; triggers and languages are written beside them by the repository. */
export const toCreativeRowData = (state: TCreativeState): TCreativeRowData => ({
  name: state.name,
  status: state.status,
  publishedAt: state.publishedAt,
  archivedAt: state.archivedAt,
  content: state.content,
  styling: state.styling,
  surveyId: state.destination?.type === "survey" ? state.destination.surveyId : null,
  linkUrl: state.destination?.type === "link" ? state.destination.url : null,
  showOn: state.distribution.showOn,
  showConditions: toCreativeShowConditions(state.distribution.conditions),
  displayPercentage: state.distribution.displayPercentage,
  startAt: state.schedule.startAt,
  endAt: state.schedule.endAt,
});

/** Every language a state needs as a workspace `Language`, the default first and always enabled. */
export const getCreativeLanguageRequests = (
  state: Pick<TCreativeState, "defaultLanguage" | "languages">
): { code: string; default: boolean; enabled: boolean }[] => [
  { code: state.defaultLanguage, default: true, enabled: true },
  ...state.languages
    .filter(({ code }) => code !== state.defaultLanguage)
    .map(({ code, enabled }) => ({ code, default: false, enabled })),
];

const isSingleUseEnabled = (singleUse: TDestinationSurveyFacts["singleUse"]): boolean =>
  typeof singleUse === "object" &&
  singleUse !== null &&
  !Array.isArray(singleUse) &&
  "enabled" in singleUse &&
  singleUse.enabled === true;

/**
 * Whether a survey can be a creative's Destination (ENG-3868, T6): in the creative's workspace (a missing
 * row means it isn't), visible to the whole workspace now (a pending change counts as Restricted), and
 * neither single-use nor PIN-protected. Email verification is fine.
 */
export const getDestinationSurveyIssue = (
  facts: TDestinationSurveyFacts | null
): TDestinationSurveyIssue | null => {
  if (!facts) return "notFound";
  if (getEffectiveVisibility(facts) !== "workspace") return "restricted";
  if (isSingleUseEnabled(facts.singleUse)) return "singleUse";
  if (facts.pin) return "pin";
  return null;
};
