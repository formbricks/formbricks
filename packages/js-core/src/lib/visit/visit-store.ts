import type { TVisitSnapshot } from "@formbricks/types/show-conditions";

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
 * - `path` is the journey in order, with consecutive repeats (a reload) collapsed, capped at 50
 *   entries while always keeping the first page.
 * - Time on site counts time on our pages only: a page's time is banked on `pagehide`, so time spent
 *   on another site before coming back in the same tab is left out. No timer runs.
 * - If storage is blocked, there is no visit (`null`), and visit conditions fail closed.
 */

export const VISIT_STORAGE_KEY = "formbricks-visit";
const MAX_PATH_ENTRIES = 50;

interface TVisitState {
  startedAt: number;
  entryReferrer: string;
  pageViews: number;
  path: string[];
  /** Time spent on earlier pages of this visit, in milliseconds. */
  accumulatedMs: number;
  /** When the current page started counting; `null` once its time has been banked. */
  pageStartedAt: number | null;
}

const isVisitState = (value: unknown): value is TVisitState => {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.startedAt === "number" &&
    typeof state.entryReferrer === "string" &&
    typeof state.pageViews === "number" &&
    Array.isArray(state.path) &&
    state.path.every((entry) => typeof entry === "string") &&
    typeof state.accumulatedMs === "number" &&
    (state.pageStartedAt === null || typeof state.pageStartedAt === "number")
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

const appendPath = (path: string[], pathname: string): void => {
  if (path.at(-1) === pathname) return;
  path.push(pathname);
  if (path.length > MAX_PATH_ENTRIES) path.splice(1, 1);
};

const bankPageTime = (state: TVisitState, now: number): void => {
  if (state.pageStartedAt === null) return;
  state.accumulatedMs += Math.max(0, now - state.pageStartedAt);
  state.pageStartedAt = null;
};

/** Counts a new page: a document load or a page restored from the back/forward cache. */
export const recordPageLoad = (pathname: string, referrer: string, now: number = Date.now()): void => {
  const state = loadState();
  if (state === undefined) return;

  if (state === null) {
    saveState({
      startedAt: now,
      entryReferrer: referrer,
      pageViews: 1,
      path: [pathname],
      accumulatedMs: 0,
      pageStartedAt: now,
    });
    return;
  }

  bankPageTime(state, now);
  state.pageViews += 1;
  state.pageStartedAt = now;
  appendPath(state.path, pathname);
  saveState(state);
};

/** Counts an SPA navigation (`pushState` / `popstate`) as a new page only when the path changes. */
export const recordNavigation = (pathname: string, now: number = Date.now()): void => {
  const state = loadState();
  if (!state || state.path.at(-1) === pathname) return;

  bankPageTime(state, now);
  state.pageViews += 1;
  state.pageStartedAt = now;
  appendPath(state.path, pathname);
  saveState(state);
};

/** `replaceState` corrects the current page's path without counting a new page. */
export const recordPathReplace = (pathname: string): void => {
  const state = loadState();
  if (!state || state.path.length === 0 || state.path.at(-1) === pathname) return;

  state.path[state.path.length - 1] = pathname;
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
    uniquePagesViewed: new Set(state.path).size,
    timeOnSite: Math.floor((state.accumulatedMs + currentPageMs) / 1000),
    entryReferrer: state.entryReferrer,
    visitedUrls: [...state.path],
  };
};
