import {
  type TShowConditionsContext,
  evaluateShowConditions,
} from "@formbricks/types/show-conditions-evaluate";
import { type TVisitorLanguage, chooseLanguage } from "./language";
import type {
  TCreativeDestination,
  TCreativePayload,
  TCreativeText,
  TCreativeTextRun,
  TCreativeView,
} from "./types";

/** What `resolve` knows about the page it decides for. */
export interface TCreativePage {
  /** Now, in epoch ms, on the server's clock: the device clock plus `getClockOffset`. */
  now: number;
  /** Actions tracked on this page, for creatives shown when an action fires. */
  firedActions?: ReadonlySet<string>;
  /**
   * The page, visit and device Show when is checked against, with the evaluator surveys use.
   * Its device type is the SDK's device detection, never the 768 px phone breakpoint. Without it, a
   * creative that has conditions never shows: showing it on pages its conditions exclude would be worse
   * than not showing it.
   */
  showConditionsContext?: TShowConditionsContext;
  /** The visitor's language (ENG-4003). Without it, every creative shows in its default language. */
  language?: TVisitorLanguage;
}

/** An app survey the SDK can open as a popup. */
export interface TResolveSurvey {
  id: string;
}

export interface TResolveInput {
  creatives: readonly TCreativePayload[];
  /** The app surveys the SDK can open as a popup: the payload's `data.surveys`. */
  surveys: readonly TResolveSurvey[];
  page: TCreativePage;
  /** This visitor's share-of-visitors roll for a creative, in [0, 100) (see `createShareRolls`). */
  getShareRoll: (creativeId: string) => number;
}

export interface TResolveResult {
  /** What the page shows, in payload order (newest first). */
  creatives: TCreativeView[];
  /** The next start or end time still ahead, in epoch ms on the server's clock, or `null`. */
  nextChangeAt: number | null;
}

/**
 * A link survey opens in the language the site set; the link page falls back as it always does (to the
 * browser's language when the survey uses it, then the default).
 */
const withVisitorLanguage = (
  destination: TCreativeDestination,
  visitor: TVisitorLanguage | undefined
): TCreativeDestination => {
  const language = visitor?.explicit?.trim();
  if (destination.type !== "survey" || destination.opensAs !== "newTab" || !language) return destination;
  const url = new URL(destination.url);
  url.searchParams.set("lang", language);
  return { ...destination, url: url.toString() };
};

/**
 * The creative's texts in `chosen` (a stored code, or `"default"`). A missing, disabled or empty
 * translation falls back to the default language, text by text.
 */
const toView = (
  creative: TCreativePayload,
  chosen: string | null,
  visitor: TVisitorLanguage | undefined
): TCreativeView | null => {
  const fallback = creative.defaultLanguage;
  const code = chosen && chosen !== "default" ? chosen : fallback;
  const pick = (text: TCreativeText | null | undefined): string => {
    const own = text?.[code];
    return own?.trim() ? own : (text?.[fallback] ?? "");
  };

  if (creative.type === "feedbackButton") {
    if (!creative.destination) return null;
    return {
      id: creative.id,
      type: "feedbackButton",
      label: pick(creative.content.label),
      icon: creative.content.icon,
      position: creative.position,
      style: creative.style,
      destination: withVisitorLanguage(creative.destination, visitor),
    };
  }

  const { message, button, dismissible, accessibleName } = creative.content;
  if (button && !creative.destination) return null;
  const runs = message[code] as TCreativeTextRun[] | undefined;
  return {
    id: creative.id,
    type: "banner",
    message: runs?.some(({ text }) => text.trim()) ? runs : (message[fallback] ?? []),
    buttonLabel: button && pick(button.label),
    dismissible,
    accessibleName: pick(accessibleName) || pick(creative.labels.siteNotice) || null,
    dismissLabel: pick(creative.labels.dismiss) || undefined,
    position: creative.position,
    style: creative.style,
    destination: creative.destination && withVisitorLanguage(creative.destination, visitor),
  };
};

const toTime = (iso: string | null): number | null => (iso === null ? null : Date.parse(iso));

/** Not before its start time and not at or after its end time; either may be unset. */
const isWithinSchedule = (startAt: number | null, endAt: number | null, now: number): boolean =>
  !(startAt !== null && startAt > now) && !(endAt !== null && endAt <= now);

/**
 * Its click would open nothing: it opens an app survey as a popup that the SDK can't open, or that the
 * SDK skips because the survey lacks the language the site set.
 */
const opensNothing = (
  creative: TCreativePayload,
  surveyIds: ReadonlySet<string>,
  language: TVisitorLanguage | undefined
): boolean => {
  const { destination } = creative;
  if (destination?.type !== "survey" || destination.opensAs !== "popup") return false;
  return (
    !surveyIds.has(destination.surveyId) ||
    chooseLanguage(creative.surveyLanguageMatch, creative.autoSelectLanguage, language, "skip") === null
  );
};

/** This page shows it: on a page view or on one of its actions the page tracked, if its Show when holds. */
const matchesPage = (creative: TCreativePayload, page: TCreativePage): boolean => {
  if (creative.showOn === "action" && !creative.triggers.some((name) => page.firedActions?.has(name))) {
    return false;
  }
  // Show when applies to the whole creative, whatever shows it (a page view or an action).
  const context = page.showConditionsContext;
  return !creative.conditions || (!!context && evaluateShowConditions(creative.conditions, context).passed);
};

/**
 * Decides which creatives the page shows right now, and when that can next change on its own. Pure:
 * the SDK calls it on every page view, action, schedule boundary and state refresh, and the editor
 * preview can call it with a page of its own.
 */
export const resolve = ({ creatives, surveys, page, getShareRoll }: TResolveInput): TResolveResult => {
  const surveyIds = new Set(surveys.map(({ id }) => id));
  const shown: TCreativeView[] = [];
  let nextChangeAt: number | null = null;

  for (const creative of creatives) {
    const startAt = toTime(creative.startAt);
    const endAt = toTime(creative.endAt);
    // `nextChangeAt` is itself still ahead, so this keeps the earliest boundary of every creative.
    const ahead: number[] = [nextChangeAt, startAt, endAt].filter(
      (time): time is number => time !== null && time > page.now
    );
    nextChangeAt = ahead.length > 0 ? Math.min(...ahead) : null;

    if (
      !isWithinSchedule(startAt, endAt, page.now) ||
      opensNothing(creative, surveyIds, page.language) ||
      !matchesPage(creative, page)
    ) {
      continue;
    }

    const language = chooseLanguage(
      creative.languageMatch,
      creative.autoSelectLanguage,
      page.language,
      "fallback"
    );
    const view = toView(creative, language, page.language);
    if (!view) continue;

    // Last, so a visitor is only ever rolled for a creative that would otherwise show.
    if (creative.displayPercentage !== null && getShareRoll(creative.id) >= creative.displayPercentage) {
      continue;
    }

    shown.push(view);
  }

  return { creatives: shown, nextChangeAt };
};
