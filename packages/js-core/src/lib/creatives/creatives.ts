import { type TCreativeView, createShareRolls, render, resolve, resolveClick } from "@formbricks/creatives";
import { getAppearance } from "@/lib/common/appearance";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { getIsSetup } from "@/lib/common/status";
import { getOpenSurveyIds, openSurveyForCreative } from "@/lib/survey/widget";

/**
 * Creatives on the page (ENG-3994). `reconcileCreatives` runs on every page view (`checkPageUrl`), on a
 * state refresh, when the CSP nonce changes and at the next schedule boundary, and makes the page show
 * exactly what `resolve` decides from the cached state: no network, no survey bundle.
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

  if (click.kind === "openTab") {
    window.open(click.url, "_blank", "noopener");
    return;
  }
  if (click.kind === "none") return;

  const survey = Config.getInstance()
    .get()
    .workspace.data.surveys.find(({ id }) => id === click.surveyId);
  if (!survey) {
    Logger.getInstance().debug(`Creative "${view.id}" opens survey "${click.surveyId}", which isn't loaded.`);
    return;
  }

  void openSurveyForCreative(survey, view.id, click.close);
};

const showCreatives = (views: readonly TCreativeView[], appearance: "light" | "dark" = "light"): void => {
  const nonce = window.__formbricksNonce;
  const stillShown = new Set<string>();

  for (const view of views) {
    stillShown.add(view.id);
    const drawnFrom = JSON.stringify([view, nonce, appearance]);
    const shown = shownCreatives.get(view.id);
    // A host the page removed (a framework re-rendering <body>) is drawn again.
    if (shown?.drawnFrom === drawnFrom && shown.host.isConnected) continue;

    shown?.host.remove();
    const host = render(view, { nonce, appearance, onClick: () => handleCreativeClick(view) });
    if (host) shownCreatives.set(view.id, { host, drawnFrom });
    else shownCreatives.delete(view.id);
  }

  for (const [id, { host }] of shownCreatives) {
    if (stillShown.has(id)) continue;
    host.remove();
    shownCreatives.delete(id);
  }
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
    const { workspace } = Config.getInstance().get();
    const now = Date.now() + (workspace.clockOffset ?? 0);
    getShareRoll ??= createShareRolls(getBrowserStorage());

    const { creatives, nextChangeAt } = resolve({
      creatives: workspace.data.creatives ?? [],
      surveys: workspace.data.surveys,
      page: { now },
      getShareRoll,
    });

    showCreatives(creatives, getCreativeAppearance());
    scheduleNextChange(nextChangeAt, now);
  } catch (error) {
    Logger.getInstance().error(`Could not show creatives: ${String(error)}`);
  }
};

/** Takes every creative off the page and stops their schedule timer and appearance watch. */
export const removeCreatives = (): void => {
  showCreatives([]);
  scheduleNextChange(null, 0);
  systemScheme?.removeEventListener("change", reconcileCreatives);
  systemScheme = null;
};
