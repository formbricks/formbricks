import type { TCreativeDestination, TCreativePayload } from "@formbricks/creatives";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZShowConditions } from "@formbricks/types/show-conditions";
import { CREATIVE_TYPE_SCHEMAS, type TCreativeTypedGroups, needsDestination } from "./creative";

/**
 * Creatives in the environment payload (ENG-3994): which ones the SDK gets, and in what shape (the
 * `TCreativePayload` contract in `@formbricks/creatives`). The payload is cached for a minute, so only
 * what can't change within the SDK's own hour is decided here; start times, Show when and the share of
 * visitors are the SDK's to decide.
 */

/** The newest deliverable creatives a page can get; far above what a workspace runs at once. */
export const MAX_DELIVERED_CREATIVES = 100;

export const deliveredCreativeSelect = {
  id: true,
  type: true,
  content: true,
  styling: true,
  surveyId: true,
  linkUrl: true,
  showOn: true,
  showConditions: true,
  displayPercentage: true,
  startAt: true,
  endAt: true,
  survey: { select: { type: true } },
  triggers: { select: { actionClass: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
  languages: { where: { default: true }, select: { language: { select: { code: true } } } },
} satisfies Prisma.CreativeSelect;

export type TDeliveredCreativeRow = Prisma.CreativeGetPayload<{ select: typeof deliveredCreativeSelect }>;

/**
 * Published and left on by its author (not paused, closed or archived), not past its end time, and —
 * when it opens a survey — that survey is Active. A creative Paused with its survey is left out until the
 * survey resumes, like a paused survey.
 */
export const getDeliverableCreativesWhere = (now: Date): Prisma.CreativeWhereInput => ({
  status: "inProgress",
  archivedAt: null,
  AND: [
    { OR: [{ endAt: null }, { endAt: { gt: now } }] },
    { OR: [{ surveyId: null }, { survey: { is: { status: "inProgress", archivedAt: null } } }] },
  ],
});

const parseTypedGroups = (row: TDeliveredCreativeRow): TCreativeTypedGroups | null => {
  if (row.type === "feedbackButton") {
    const content = CREATIVE_TYPE_SCHEMAS.feedbackButton.content.safeParse(row.content);
    const styling = CREATIVE_TYPE_SCHEMAS.feedbackButton.styling.safeParse(row.styling);
    return content.success && styling.success
      ? { type: "feedbackButton", content: content.data, styling: styling.data }
      : null;
  }
  const content = CREATIVE_TYPE_SCHEMAS.banner.content.safeParse(row.content);
  const styling = CREATIVE_TYPE_SCHEMAS.banner.styling.safeParse(row.styling);
  return content.success && styling.success
    ? { type: "banner", content: content.data, styling: styling.data }
    : null;
};

const getDestination = (row: TDeliveredCreativeRow, publicDomain: string): TCreativeDestination | null => {
  if (row.surveyId) {
    // A link survey opens its public link; the SDK adds `?creativeId=` when it opens it.
    return row.survey?.type === "link"
      ? {
          type: "survey",
          surveyId: row.surveyId,
          opensAs: "newTab",
          url: `${publicDomain}/s/${row.surveyId}`,
        }
      : { type: "survey", surveyId: row.surveyId, opensAs: "popup" };
  }
  if (row.linkUrl) return { type: "link", url: row.linkUrl };
  return null;
};

/**
 * One creative as the SDK gets it, or `null` when it could never show: nothing to open when it needs a
 * Destination, shown on an action but with none, or stored JSON that no longer fits its type.
 */
export const toCreativePayload = (
  row: TDeliveredCreativeRow,
  publicDomain: string
): TCreativePayload | null => {
  const groups = parseTypedGroups(row);
  const conditions = ZShowConditions.safeParse(row.showConditions ?? null);
  if (!groups || !conditions.success) {
    logger.warn(
      { creativeId: row.id },
      "Creative left out of the environment payload: stored JSON is invalid"
    );
    return null;
  }

  const destination = getDestination(row, publicDomain);
  const triggers = row.triggers.map(({ actionClass }) => actionClass.name);
  if (needsDestination(groups) && !destination) return null;
  if (row.showOn === "action" && triggers.length === 0) return null;

  const common = {
    id: row.id,
    defaultLanguage: row.languages[0]?.language.code ?? "en-US",
    destination,
    showOn: row.showOn,
    triggers,
    conditions: conditions.data,
    displayPercentage: row.displayPercentage,
    startAt: row.startAt?.toISOString() ?? null,
    endAt: row.endAt?.toISOString() ?? null,
  };

  return groups.type === "feedbackButton"
    ? { ...common, type: "feedbackButton", content: groups.content, position: groups.styling.position }
    : { ...common, type: "banner", content: groups.content, position: groups.styling.position };
};

/** The app surveys the payload's creatives open as a popup, which the payload must therefore carry. */
export const getPopupSurveyIds = (creatives: readonly TCreativePayload[]): string[] => [
  ...new Set(
    creatives.flatMap(({ destination }) =>
      destination?.type === "survey" && destination.opensAs === "popup" ? [destination.surveyId] : []
    )
  ),
];
