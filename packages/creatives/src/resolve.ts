import type { TShowConditionGroup } from "@formbricks/types/show-conditions";
import {
  type TLanguageResolver,
  type TMatchableLanguage,
  type TVisitorLanguage,
  chooseLanguage,
} from "./language";
import type {
  TCreativeDestination,
  TCreativePayload,
  TCreativeText,
  TCreativeTextRun,
  TCreativeView,
} from "./types";

/** What `resolve` knows about the page it decides for. Later tickets widen it (device…). */
export interface TCreativePage {
  /** Now, in epoch ms, on the server's clock: the device clock plus `getClockOffset`. */
  now: number;
  /** Actions tracked on this page, for creatives shown when an action fires. */
  firedActions?: ReadonlySet<string>;
  /** The visitor's language (ENG-4003). Without it, every creative shows in its default language. */
  language?: TVisitorLanguage;
}

/** An app survey the SDK can open as a popup, with what decides whether the visitor's language skips it. */
export interface TResolveSurvey {
  id: string;
  languages?: readonly TMatchableLanguage[];
  autoSelectLanguage?: boolean | null;
}

export interface TResolveInput {
  creatives: readonly TCreativePayload[];
  /** The app surveys the SDK can open as a popup: the payload's `data.surveys`. */
  surveys: readonly TResolveSurvey[];
  page: TCreativePage;
  /** This visitor's share-of-visitors roll for a creative, in [0, 100) (see `createShareRolls`). */
  getShareRoll: (creativeId: string) => number;
  /**
   * Evaluates Show when. Without one, a creative that has conditions never shows: showing it on pages
   * its conditions exclude would be worse than not showing it.
   */
  passesConditions?: (conditions: TShowConditionGroup) => boolean;
  /**
   * The full language matcher: the surveys bundle's `resolveSurveyLanguage`, which carries the canonical
   * language table the SDK leaves out. Without it languages are matched exactly (code or alias), and
   * `languagePending` says when the full matcher could decide otherwise.
   */
  resolveLanguage?: TLanguageResolver;
}

export interface TResolveResult {
  /** What the page shows, in payload order (newest first). */
  creatives: TCreativeView[];
  /** The next start or end time still ahead, in epoch ms on the server's clock, or `null`. */
  nextChangeAt: number | null;
  /**
   * A language was chosen without the full matcher and could change with it (a language the site set
   * that matches no code or alias exactly, say `de-AT` for `de-DE`): resolve again once it is loaded.
   */
  languagePending: boolean;
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
 * translation falls back to the default language, text by text (ADR 0011).
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

/**
 * Decides which creatives the page shows right now, and when that can next change on its own. Pure:
 * the SDK calls it on every page view, action, schedule boundary and state refresh, and the editor
 * preview can call it with a page of its own.
 */
export const resolve = ({
  creatives,
  surveys,
  page,
  getShareRoll,
  passesConditions,
  resolveLanguage,
}: TResolveInput): TResolveResult => {
  const surveysById = new Map(surveys.map((survey) => [survey.id, survey]));
  const shown: TCreativeView[] = [];
  let nextChangeAt: number | null = null;
  let languagePending = false;
  const choose = (item: TResolveSurvey | TCreativePayload, unmatched: "fallback" | "skip"): string | null => {
    const { language, settled } = chooseLanguage(item, page.language, unmatched, resolveLanguage);
    languagePending ||= !settled;
    return language;
  };

  for (const creative of creatives) {
    const startAt = toTime(creative.startAt);
    const endAt = toTime(creative.endAt);

    for (const boundary of [startAt, endAt]) {
      if (boundary !== null && boundary > page.now && (nextChangeAt === null || boundary < nextChangeAt)) {
        nextChangeAt = boundary;
      }
    }

    if (startAt !== null && startAt > page.now) continue;
    if (endAt !== null && endAt <= page.now) continue;

    const { destination } = creative;
    let popupSurvey: TResolveSurvey | undefined;
    if (destination?.type === "survey" && destination.opensAs === "popup") {
      popupSurvey = surveysById.get(destination.surveyId);
      if (!popupSurvey) continue;
    }

    if (creative.showOn === "action" && !creative.triggers.some((name) => page.firedActions?.has(name))) {
      continue;
    }

    if (creative.conditions && !passesConditions?.(creative.conditions)) continue;

    // Its click would open nothing: the SDK skips an app survey that lacks the language the site set
    // (ADR 0011). Decided after the other rules, so a creative hidden anyway never waits for the matcher.
    if (popupSurvey && choose(popupSurvey, "skip") === null) continue;

    const view = toView(creative, choose(creative, "fallback"), page.language);
    if (!view) continue;

    // Last, so a visitor is only ever rolled for a creative that would otherwise show.
    if (creative.displayPercentage !== null && getShareRoll(creative.id) >= creative.displayPercentage) {
      continue;
    }

    shown.push(view);
  }

  return { creatives: shown, nextChangeAt, languagePending };
};
