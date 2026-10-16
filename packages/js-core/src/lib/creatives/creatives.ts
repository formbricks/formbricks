import {
  type TCreativeView,
  createShareRolls,
  getCountedPage,
  render,
  resolve,
  resolveClick,
} from "@formbricks/creatives";
import type { TShowConditionsContext } from "@formbricks/types/show-conditions-evaluate";
import { getAppearance } from "@/lib/common/appearance";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { getIsSetup } from "@/lib/common/status";
import { getBrowserLanguageCodes } from "@/lib/common/utils";
import { countClick, countImpressions, stopCountingCreatives } from "@/lib/creatives/events";
import { type TShownCreative, arrangeCreatives, stopArrangingCreatives } from "@/lib/creatives/layout";
import {
  getLoadedLanguageResolver,
  getOpenSurveyIds,
  loadFormbricksSurveysExternally,
  openSurveyForCreative,
} from "@/lib/survey/widget";
import { getDeviceInfo } from "@/lib/visit/device";
import { getVisitSnapshot } from "@/lib/visit/visit-store";

/**
 * Creatives on the page (ENG-3994). `reconcileCreatives` runs on every page view (`checkPageUrl`), on
 * every tracked action, on a state refresh, when the CSP nonce, appearance or language changes and at
 * the next schedule boundary, and makes the page show exactly what `resolve` decides from the cached
 * state: no network, and no survey bundle unless a language needs its matcher (see
 * `reconcileCreatives`).
 */

/**
 * A boundary timer never waits longer than this. Timers stop while a device sleeps, so a long one would
 * fire late after a wake-up; re-checking every minute keeps schedules exact to the minute anyway.
 */
const MAX_BOUNDARY_WAIT_MS = 60_000;

/** The creatives on the page, by id, with what each was drawn from so an unchanged one stays put. */
const shownCreatives = new Map<string, { host: HTMLElement; drawnFrom: string }>();
let boundaryTimer: ReturnType<typeof setTimeout> | null = null;
let getShareRoll: ((creativeId: string) => number) | null = null;
/** The visitor's colour scheme, watched once the host asks for `system`. */
let systemScheme: MediaQueryList | null = null;
/**
 * What happened on this page view (host + path, as Impressions count it), kept in memory only: the
 * banners the visitor closed, and the actions tracked, which show the creatives that show on them. The
 * next page view, a single-page-app route change included, starts over.
 */
const pageView = {
  page: null as string | null,
  dismissed: new Set<string>(),
  firedActions: new Set<string>(),
};

const syncPageView = (): void => {
  const page = getCountedPage(window.location.href);
  if (page === pageView.page) return;
  pageView.page = page;
  pageView.dismissed.clear();
  pageView.firedActions.clear();
};

const dismissBanner = (id: string): void => {
  pageView.dismissed.add(id);
  reconcileCreatives();
};

/**
 * The page, visit and device Show when is checked against: the context the survey SDK builds for its
 * own show conditions (ENG-3926's `passesShowConditions`), from the same visit store and device
 * detection.
 */
const getShowConditionsContext = (): TShowConditionsContext => ({
  url: window.location.href,
  pageReferrer: document.referrer,
  visit: getVisitSnapshot(),
  device: getDeviceInfo(),
});

/**
 * The appearance a creative draws in: the survey's (ENG-3998), which the host sets with
 * `formbricks.setAppearance`. `system` follows the visitor's setting, and a change there redraws.
 */
const getCreativeAppearance = (): "light" | "dark" => {
  const appearance = getAppearance();
  if (appearance !== "system") return appearance;
  if (!systemScheme && typeof window.matchMedia === "function") {
    systemScheme = window.matchMedia("(prefers-color-scheme: dark)");
    systemScheme.addEventListener("change", reconcileCreatives);
  }
  return systemScheme?.matches ? "dark" : "light";
};

const getBrowserStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** The click path: never the survey trigger (ADR 0004). */
const handleCreativeClick = (view: TCreativeView): void => {
  const click = resolveClick(view, getOpenSurveyIds());
  if (click.kind === "none") return;

  if (click.kind === "openTab") {
    window.open(click.url, "_blank", "noopener");
  } else {
    const survey = Config.getInstance()
      .get()
      .workspace.data.surveys.find(({ id }) => id === click.surveyId);
    if (!survey) {
      Logger.getInstance().debug(
        `Creative "${view.id}" opens survey "${click.surveyId}", which isn't loaded.`
      );
      return;
    }
    void openSurveyForCreative(survey, view.id, click.close);
  }

  countClick(view.id);
  // A banner whose button opened its Destination has done its job on this page (ENG-3576).
  if (view.type === "banner") dismissBanner(view.id);
};

const showCreatives = (views: readonly TCreativeView[], appearance: "light" | "dark" = "light"): void => {
  const nonce = window.__formbricksNonce;
  const stillShown = new Set<string>();
  const drawn: TShownCreative[] = [];

  for (const view of views) {
    stillShown.add(view.id);
    const drawnFrom = JSON.stringify([view, nonce, appearance]);
    const shown = shownCreatives.get(view.id);
    // A host the page removed (a framework re-rendering <body>) is drawn again.
    if (shown?.drawnFrom === drawnFrom && shown.host.isConnected) {
      drawn.push({ view, host: shown.host });
      continue;
    }

    shown?.host.remove();
    const host = render(view, {
      nonce,
      appearance,
      onClick: () => handleCreativeClick(view),
      onDismiss: () => dismissBanner(view.id),
    });
    shownCreatives.set(view.id, { host, drawnFrom });
    drawn.push({ view, host });
  }

  for (const [id, { host }] of shownCreatives) {
    if (stillShown.has(id)) continue;
    host.remove();
    shownCreatives.delete(id);
  }

  arrangeCreatives(drawn);
  if (shownCreatives.size > 0) countImpressions(shownCreatives.keys());
};

const scheduleNextChange = (nextChangeAt: number | null, now: number): void => {
  if (boundaryTimer !== null) clearTimeout(boundaryTimer);
  boundaryTimer = null;
  if (nextChangeAt === null) return;

  boundaryTimer = setTimeout(reconcileCreatives, Math.min(nextChangeAt - now, MAX_BOUNDARY_WAIT_MS));
};

export const reconcileCreatives = (): void => {
  if (!getIsSetup()) return;

  try {
    const { workspace, user } = Config.getInstance().get();
    const now = Date.now() + (workspace.clockOffset ?? 0);
    getShareRoll ??= createShareRolls(getBrowserStorage());

    syncPageView();

    const { creatives, nextChangeAt, languagePending } = resolve({
      creatives: workspace.data.creatives ?? [],
      surveys: workspace.data.surveys,
      page: {
        now,
        firedActions: pageView.firedActions,
        showConditionsContext: getShowConditionsContext(),
        // What a survey's language is chosen from (`renderWidget`), so a creative follows its survey.
        language: { explicit: user.data.language, browser: getBrowserLanguageCodes() },
      },
      getShareRoll,
      resolveLanguage: getLoadedLanguageResolver(),
    });
    // The exact matcher couldn't settle a language (say `de-AT` against `de-DE`): the full one ships in
    // the surveys bundle, which a click would load anyway. Decide again once it is here; until then a
    // creative whose survey might be skipped stays hidden. A failed load retries on the next page view.
    if (languagePending) {
      void loadFormbricksSurveysExternally().then(
        () => reconcileCreatives(),
        () => undefined
      );
    }

    showCreatives(
      creatives.filter(({ id }) => !pageView.dismissed.has(id)),
      getCreativeAppearance()
    );
    scheduleNextChange(nextChangeAt, now);
  } catch (error) {
    Logger.getInstance().error(`Could not show creatives: ${String(error)}`);
  }
};

/** An action was tracked on this page (`trackAction`): shows the creatives that show on it. */
export const recordCreativeAction = (actionName: string): void => {
  syncPageView();
  pageView.firedActions.add(actionName);
  reconcileCreatives();
};

/**
 * Takes every creative off the page and stops their schedule timer, appearance and size watches and
 * counting.
 */
export const removeCreatives = (): void => {
  showCreatives([]);
  pageView.dismissed.clear();
  pageView.firedActions.clear();
  stopArrangingCreatives();
  scheduleNextChange(null, 0);
  systemScheme?.removeEventListener("change", reconcileCreatives);
  systemScheme = null;
  stopCountingCreatives();
};
