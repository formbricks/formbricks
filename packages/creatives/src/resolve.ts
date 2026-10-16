import {
  type TShowConditionsContext,
  evaluateShowConditions,
} from "@formbricks/types/show-conditions-evaluate";
import type { TCreativePayload, TCreativeText, TCreativeView } from "./types";

/** What `resolve` knows about the page it decides for. Later tickets widen it (language…). */
export interface TCreativePage {
  /** Now, in epoch ms, on the server's clock: the device clock plus `getClockOffset`. */
  now: number;
  /** Actions tracked on this page, for creatives shown when an action fires. */
  firedActions?: ReadonlySet<string>;
  /**
   * The page, visit and device Show when is checked against, with the evaluator surveys use (ADR 0007).
   * Its device type is the SDK's device detection, never the 768 px phone breakpoint. Without it, a
   * creative that has conditions never shows: showing it on pages its conditions exclude would be worse
   * than not showing it.
   */
  showConditionsContext?: TShowConditionsContext;
}

export interface TResolveInput {
  creatives: readonly TCreativePayload[];
  /** The app surveys the SDK can open as a popup: the payload's `data.surveys`. */
  surveys: readonly { id: string }[];
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

const pickText = (text: TCreativeText, defaultLanguage: string): string => text[defaultLanguage] ?? "";

const toView = (creative: TCreativePayload): TCreativeView | null => {
  if (creative.type === "feedbackButton") {
    if (!creative.destination) return null;
    return {
      id: creative.id,
      type: "feedbackButton",
      label: pickText(creative.content.label, creative.defaultLanguage),
      icon: creative.content.icon,
      position: creative.position,
      style: creative.style,
      destination: creative.destination,
    };
  }

  const { message, button, dismissible, accessibleName } = creative.content;
  if (button && !creative.destination) return null;
  return {
    id: creative.id,
    type: "banner",
    message: message[creative.defaultLanguage] ?? [],
    buttonLabel: button && pickText(button.label, creative.defaultLanguage),
    dismissible,
    accessibleName: accessibleName && pickText(accessibleName, creative.defaultLanguage),
    position: creative.position,
    style: creative.style,
    destination: creative.destination,
  };
};

const toTime = (iso: string | null): number | null => (iso === null ? null : Date.parse(iso));

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

    for (const boundary of [startAt, endAt]) {
      if (boundary !== null && boundary > page.now && (nextChangeAt === null || boundary < nextChangeAt)) {
        nextChangeAt = boundary;
      }
    }

    if (startAt !== null && startAt > page.now) continue;
    if (endAt !== null && endAt <= page.now) continue;

    const { destination } = creative;
    if (
      destination?.type === "survey" &&
      destination.opensAs === "popup" &&
      !surveyIds.has(destination.surveyId)
    ) {
      continue;
    }

    if (creative.showOn === "action" && !creative.triggers.some((name) => page.firedActions?.has(name))) {
      continue;
    }

    // Show when applies to the whole creative, whatever shows it (a page view or an action).
    const context = page.showConditionsContext;
    if (creative.conditions && !(context && evaluateShowConditions(creative.conditions, context).passed)) {
      continue;
    }

    const view = toView(creative);
    if (!view) continue;

    // Last, so a visitor is only ever rolled for a creative that would otherwise show.
    if (creative.displayPercentage !== null && getShareRoll(creative.id) >= creative.displayPercentage) {
      continue;
    }

    shown.push(view);
  }

  return { creatives: shown, nextChangeAt };
};
