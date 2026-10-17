import "server-only";
import type { TCreativeDestination, TCreativeLanguage, TCreativePayload } from "@formbricks/creatives";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZShowConditions } from "@formbricks/types/show-conditions";
import { needsDestination, parseCreativeTypedGroups } from "./creative";
import { compileCreativeCustomCss } from "./custom-css";
import { getCreativeDeliveryGap } from "./display-status";
import { buildLanguageMatch } from "./language-match";
import { type TWorkspaceStylingInput, getAppliedCustomCssSource, getCreativeStyle } from "./style";
import { getBannerLabels } from "./visitor-labels";

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
  survey: {
    select: {
      type: true,
      autoSelectLanguage: true,
      // For the popup survey's language skip, precomputed for the page (`surveyLanguageMatch`).
      languages: {
        select: { default: true, enabled: true, language: { select: { code: true, alias: true } } },
      },
    },
  },
  triggers: { select: { actionClass: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
  languages: {
    select: { default: true, enabled: true, language: { select: { code: true, alias: true } } },
    orderBy: { default: "desc" },
  },
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

/** What every creative of one workspace's payload is built with. */
export interface TCreativeDeliveryContext {
  publicDomain: string;
  /** The workspace's stored Look & Feel: every creative's default look (ENG-3998). */
  workspaceStyling: TWorkspaceStylingInput | null | undefined;
}

/**
 * One creative as the SDK gets it, or `null` when it could never show: nothing to open when it needs a
 * Destination, shown on an action but with none, or stored JSON that no longer fits its type. Its look
 * arrives computed (`style`), with its own Custom CSS compiled for its shadow root.
 */
const toCreativePayload = async (
  row: TDeliveredCreativeRow,
  { publicDomain, workspaceStyling }: TCreativeDeliveryContext
): Promise<TCreativePayload | null> => {
  const groups = parseCreativeTypedGroups(row);
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
  const deliveryGap = getCreativeDeliveryGap({
    needsDestination: needsDestination(groups),
    hasDestination: destination !== null,
    showOn: row.showOn,
    triggerCount: triggers.length,
  });
  if (deliveryGap) return null;

  const customCssSource = getAppliedCustomCssSource(groups.styling.theme);
  const customCss = customCssSource ? await compileCreativeCustomCss(groups.type, customCssSource) : null;

  const languages: TCreativeLanguage[] = row.languages;
  const defaultLanguage = languages.find((language) => language.default)?.language.code ?? "en-US";

  const common = {
    id: row.id,
    defaultLanguage,
    languages,
    languageMatch: buildLanguageMatch(languages),
    surveyLanguageMatch:
      destination?.type === "survey" && destination.opensAs === "popup" && row.survey
        ? buildLanguageMatch(row.survey.languages)
        : null,
    // Its texts follow the language its survey would open in (ENG-4003); a link or no Destination has
    // no such setting, so only the language the site set counts.
    autoSelectLanguage: row.survey?.autoSelectLanguage ?? false,
    style: getCreativeStyle(groups, workspaceStyling, customCss),
    destination,
    showOn: row.showOn,
    triggers,
    conditions: conditions.data,
    displayPercentage: row.displayPercentage,
    startAt: row.startAt?.toISOString() ?? null,
    endAt: row.endAt?.toISOString() ?? null,
  };

  if (groups.type === "feedbackButton") {
    return { ...common, type: "feedbackButton", content: groups.content, position: groups.styling.position };
  }
  // In every language a visitor can get: the default and the enabled ones.
  const visitorLanguages = languages.filter((language) => language.default || language.enabled);
  return {
    ...common,
    type: "banner",
    content: groups.content,
    labels: await getBannerLabels(visitorLanguages.map(({ language }) => language.code)),
    position: groups.styling.position,
  };
};

/** The payload's `creatives`, in row order, without the ones that could never show. */
export const toCreativePayloads = async (
  rows: readonly TDeliveredCreativeRow[],
  context: TCreativeDeliveryContext
): Promise<TCreativePayload[]> =>
  (await Promise.all(rows.map((row) => toCreativePayload(row, context)))).filter(
    (creative): creative is TCreativePayload => creative !== null
  );

/** The app surveys the payload's creatives open as a popup, which the payload must therefore carry. */
export const getPopupSurveyIds = (creatives: readonly TCreativePayload[]): string[] => [
  ...new Set(
    creatives.flatMap(({ destination }) =>
      destination?.type === "survey" && destination.opensAs === "popup" ? [destination.surveyId] : []
    )
  ),
];
