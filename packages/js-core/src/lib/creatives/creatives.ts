import { type TCreativeView, createShareRolls, render, resolve, resolveClick } from "@formbricks/creatives";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { getIsSetup } from "@/lib/common/status";
import { countClick, countImpressions, stopCountingCreatives } from "@/lib/creatives/events";
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
    countClick(view.id);
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

  countClick(view.id);
  void openSurveyForCreative(survey, view.id, click.close);
};

const showCreatives = (views: readonly TCreativeView[]): void => {
  const nonce = window.__formbricksNonce;
  const stillShown = new Set<string>();

  for (const view of views) {
    stillShown.add(view.id);
    const drawnFrom = JSON.stringify([view, nonce]);
    const shown = shownCreatives.get(view.id);
    // A host the page removed (a framework re-rendering <body>) is drawn again.
    if (shown?.drawnFrom === drawnFrom && shown.host.isConnected) continue;

    shown?.host.remove();
    const host = render(view, { nonce, onClick: () => handleCreativeClick(view) });
    if (host) shownCreatives.set(view.id, { host, drawnFrom });
    else shownCreatives.delete(view.id);
  }

  for (const [id, { host }] of shownCreatives) {
    if (stillShown.has(id)) continue;
    host.remove();
    shownCreatives.delete(id);
  }

  // Only what was drawn: a creative `render` can't draw yet showed nothing, so it isn't an Impression.
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
    const { workspace } = Config.getInstance().get();
    const now = Date.now() + (workspace.clockOffset ?? 0);
    getShareRoll ??= createShareRolls(getBrowserStorage());

    const { creatives, nextChangeAt } = resolve({
      creatives: workspace.data.creatives ?? [],
      surveys: workspace.data.surveys,
      page: { now },
      getShareRoll,
    });

    showCreatives(creatives);
    scheduleNextChange(nextChangeAt, now);
  } catch (error) {
    Logger.getInstance().error(`Could not show creatives: ${String(error)}`);
  }
};

/** Takes every creative off the page and stops their schedule timer. */
export const removeCreatives = (): void => {
  showCreatives([]);
  scheduleNextChange(null, 0);
  stopCountingCreatives();
};
