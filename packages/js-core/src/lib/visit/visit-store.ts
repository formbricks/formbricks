import type { TVisitSnapshot } from "@formbricks/types/show-conditions";
import { MAX_UNIQUE_PAGES, normalizeUrlPath } from "@formbricks/types/show-conditions-evaluate";
import { type TVisitUtm, readUtmParams } from "@formbricks/types/visit";

/**
 * The visit store: what one visitor did in this browser tab (ENG-3570, ENG-3872).
 *
 * It lives in sessionStorage, which gives the product rule for free: a new tab starts empty, while
 * reloads and leaving the site and coming back in the same tab keep the visit going. In a classic
 * multi-page site every page load runs `setup()` again with fresh memory, so nothing here may live
 * only in a variable.
 *
 * Rules:
 * - A new page is the first load of a document, `pushState`, `popstate`, or a page restored from
 *   the back/forward cache. In a single-page app only a change of path counts; a query or hash
 *   change does not. `replaceState` never adds a page — routers use it for redirects — it only
 *   corrects the current path.
 * - Paths are stored as `normalizeUrlPath` gives them, so `/plans/`, `/plans` and `/Plans` are one
 *   page, compared the same way the path conditions compare them.
 * - `path` is the journey in order, with consecutive repeats (a reload) collapsed, capped at 50
 *   entries while always keeping the first page. `uniquePaths` holds every different path apart
 *   from it, up to `MAX_UNIQUE_PAGES`, so what fell out of the journey still counts as visited.
 * - Time on site counts time on our pages only: a page's time is banked on `pagehide`, so time spent
 *   on another site before coming back in the same tab is left out. No timer runs.
 * - The campaign (`utm`) is the UTM set of the latest page of the visit whose URL carried any: the
 *   landing page, unless the visitor later reached a page tagged with another campaign. It is kept
 *   as a whole set, never merged, so two campaigns are never mixed into one attribution. A page
 *   without UTM parameters leaves it as it was (ENG-7430).
 * - If storage is blocked, there is no visit (`null`), and visit conditions fail closed.
 */

export const VISIT_STORAGE_KEY = "formbricks-visit";
/**
 * The longest UTM value the visit keeps. The entry is rewritten on every page, so a crafted link with
 * a huge `utm_campaign` would otherwise be carried and re-serialised for the rest of the visit.
 */
export const MAX_UTM_VALUE_LENGTH = 500;
const MAX_PATH_ENTRIES = 50;

interface TVisitState {
  startedAt: number;
  entryReferrer: string;
  pageViews: number;
  path: string[];
  uniquePaths: string[];
  /** Whether the current page added its path to `uniquePaths`, so a redirect can take it back. */
  currentPathIsNew: boolean;
  /** Time spent on earlier pages of this visit, in milliseconds. */
  accumulatedMs: number;
  /** When the current page started counting; `null` once its time has been banked. */
  pageStartedAt: number | null;
  /** Absent until a page of the visit carries UTM parameters, and in visits an older SDK started. */
  utm?: TVisitUtm;
}

const isStringList = (value: unknown): boolean =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const isVisitState = (value: unknown): value is TVisitState => {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.startedAt === "number" &&
    typeof state.entryReferrer === "string" &&
    typeof state.pageViews === "number" &&
    isStringList(state.path) &&
    isStringList(state.uniquePaths) &&
    typeof state.currentPathIsNew === "boolean" &&
    typeof state.accumulatedMs === "number" &&
    (state.pageStartedAt === null || typeof state.pageStartedAt === "number") &&
    // Only its shape is checked: the renderer reads each UTM key on its own and drops any non-string.
    (state.utm === undefined || (typeof state.utm === "object" && state.utm !== null))
  );
};

/** `undefined` when storage itself is unavailable; `null` when it works but holds no visit yet. */
const loadState = (): TVisitState | null | undefined => {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(VISIT_STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    return isVisitState(parsed) ? parsed : null;
  } catch {
    // An unreadable entry is no visit, not blocked storage: the next page starts a fresh one.
    return null;
  }
};

const saveState = (state: TVisitState): void => {
  try {
    sessionStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage is blocked or full. The visit simply stops updating; nothing else depends on it.
  }
};

const bankPageTime = (state: TVisitState, now: number): void => {
  if (state.pageStartedAt === null) return;
  state.accumulatedMs += Math.max(0, now - state.pageStartedAt);
  state.pageStartedAt = null;
};

const startVisit = (pathname: string, referrer: string, now: number): void => {
  saveState({
    startedAt: now,
    entryReferrer: referrer,
    pageViews: 1,
    path: [pathname],
    uniquePaths: [pathname],
    currentPathIsNew: true,
    accumulatedMs: 0,
    pageStartedAt: now,
  });
};

const markUnique = (state: TVisitState, pathname: string): void => {
  state.currentPathIsNew =
    !state.uniquePaths.includes(pathname) && state.uniquePaths.length < MAX_UNIQUE_PAGES;
  if (state.currentPathIsNew) state.uniquePaths.push(pathname);
};

const addPage = (state: TVisitState, pathname: string, now: number): void => {
  bankPageTime(state, now);
  state.pageViews += 1;
  state.pageStartedAt = now;
  if (state.path.at(-1) !== pathname) {
    state.path.push(pathname);
    if (state.path.length > MAX_PATH_ENTRIES) state.path.splice(1, 1);
  }
  markUnique(state, pathname);
  saveState(state);
};

/** Counts a new page: a document load or a page restored from the back/forward cache. */
export const recordPageLoad = (rawPath: string, referrer: string, now: number = Date.now()): void => {
  const pathname = normalizeUrlPath(rawPath);
  const state = loadState();
  if (state === undefined) return;

  if (state === null) {
    startVisit(pathname, referrer, now);
    return;
  }
  addPage(state, pathname, now);
};

/** Counts an SPA navigation (`pushState` / `popstate`) as a new page only when the path changes. */
export const recordNavigation = (rawPath: string, now: number = Date.now()): void => {
  const pathname = normalizeUrlPath(rawPath);
  const state = loadState();
  if (state === undefined) return;

  // Storage works but the visit is gone: the site cleared it, as many apps do with
  // `sessionStorage.clear()` on logout. This page starts a new visit. It was reached from inside the
  // site, so the visit has no entry referrer.
  if (state === null) {
    startVisit(pathname, "", now);
    return;
  }
  if (state.path.at(-1) === pathname) return;
  addPage(state, pathname, now);
};

/** `replaceState` corrects the current page's path without counting a new page. */
export const recordPathReplace = (rawPath: string): void => {
  const pathname = normalizeUrlPath(rawPath);
  const state = loadState();
  if (!state || state.path.length === 0 || state.path.at(-1) === pathname) return;

  // A redirect: the path it replaced was never really seen, so it gives back its unique page.
  if (state.currentPathIsNew) state.uniquePaths.pop();
  state.path[state.path.length - 1] = pathname;
  // Replaced back to the page before it: one page, not two in a row.
  if (state.path.at(-2) === pathname) state.path.pop();
  markUnique(state, pathname);
  saveState(state);
};

/**
 * Keeps the campaign of a page whose URL carries UTM parameters, replacing the visit's earlier one.
 * Called for every page the visit records, after it is recorded, so the visit exists. A page without
 * UTM parameters changes nothing: the visit keeps the campaign it arrived with, which is what a
 * survey on a later page should record.
 */
export const recordCampaign = (search: string): void => {
  const utm = readUtmParams(search);
  if (!utm) return;
  const state = loadState();
  if (!state) return;

  state.utm = Object.fromEntries(
    // Counted in UTF-16 units, so a cut through an emoji would keep half of it, which PostgreSQL's
    // JSON input rejects when the response is saved: drop a trailing lone high surrogate.
    Object.entries(utm).map(([key, value]) => [
      key,
      value.slice(0, MAX_UTM_VALUE_LENGTH).replace(/[\uD800-\uDBFF]$/, ""),
    ])
  );
  saveState(state);
};

/** Banks the current page's time as the visitor leaves it, so time away is not counted. */
export const recordPageHide = (now: number = Date.now()): void => {
  const state = loadState();
  if (!state) return;

  bankPageTime(state, now);
  saveState(state);
};

export const getVisitSnapshot = (now: number = Date.now()): TVisitSnapshot | null => {
  const state = loadState();
  if (!state) return null;

  const currentPageMs = state.pageStartedAt === null ? 0 : Math.max(0, now - state.pageStartedAt);
  return {
    pagesViewed: state.pageViews,
    uniquePagesViewed: state.uniquePaths.length,
    timeOnSite: Math.floor((state.accumulatedMs + currentPageMs) / 1000),
    entryReferrer: state.entryReferrer,
    visitedUrls: [...state.path],
    uniquePaths: [...state.uniquePaths],
    ...(state.utm ? { utm: { ...state.utm } } : {}),
  };
};
