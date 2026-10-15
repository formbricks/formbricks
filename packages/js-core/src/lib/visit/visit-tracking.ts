import { emitDebugVisitEvent, isDebugEnabled } from "@/lib/common/debug";
import { getDeviceInfo } from "@/lib/visit/device";
import {
  getVisitSnapshot,
  recordNavigation,
  recordPageHide,
  recordPageLoad,
  recordPathReplace,
} from "@/lib/visit/visit-store";

let isTrackingVisit = false;

const reportVisit = (): void => {
  if (isDebugEnabled()) emitDebugVisitEvent({ visit: getVisitSnapshot(), device: getDeviceInfo() });
};

const onNavigation = (): void => {
  recordNavigation(window.location.pathname);
  reportVisit();
};

const onPathReplace = (): void => {
  recordPathReplace(window.location.pathname);
};

const onPageShow = (event: PageTransitionEvent): void => {
  // A page restored from the back/forward cache runs no scripts and no `setup()`, so this is the only
  // place it gets counted. A normal load also fires `pageshow`, with `persisted: false`.
  if (!event.persisted) return;
  recordPageLoad(window.location.pathname, document.referrer);
  reportVisit();
};

const onPageHide = (): void => {
  recordPageHide();
};

/**
 * Counts this page into the visit and starts listening for the next ones. Runs once per document,
 * from `setup()`, before the SDK's other listeners are added: listeners run in the order they were
 * added, so a `pushState` reaches the visit store before it can fire a page-view trigger, and the
 * trigger sees the page it fired on.
 *
 * These listeners are deliberately not removed on `beforeunload`. That cleanup runs before
 * `pagehide`, which is where the page's time is banked, and a page restored from the back/forward
 * cache must still count.
 */
export const startVisitTracking = (): void => {
  if (isTrackingVisit || typeof window === "undefined") return;
  isTrackingVisit = true;

  recordPageLoad(window.location.pathname, document.referrer);
  reportVisit();

  // `pushstate` / `replacestate` are dispatched by js-core's own history patch (no-code-action.ts).
  window.addEventListener("pushstate", onNavigation);
  window.addEventListener("popstate", onNavigation);
  window.addEventListener("replacestate", onPathReplace);
  window.addEventListener("pageshow", onPageShow);
  window.addEventListener("pagehide", onPageHide);
};
