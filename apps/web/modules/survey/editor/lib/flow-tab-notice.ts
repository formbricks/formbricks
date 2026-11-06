/**
 * The one-time "Logic has moved" notice on the Questions tab (ENG-6929, T29). Logic left the block
 * cards for the Flow tab; the notice points there until the Flow tab has been opened once in this
 * browser. Per browser rather than per account, like the other dismissals kept in localStorage: it is
 * a hint, and losing it costs nothing.
 */

export const FLOW_TAB_SEEN_STORAGE_KEY = "formbricks-survey-editor-flow-tab-seen";

const SEEN_VALUE = "1";

/**
 * Whether the Flow tab was opened before in this browser. A browser that denies storage (Safari in
 * private mode throws instead of returning null) reads as not seen, so the notice still shows there;
 * the editor then hides it for the rest of the page view once the Flow tab is opened.
 */
export const hasSeenFlowTab = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FLOW_TAB_SEEN_STORAGE_KEY) === SEEN_VALUE;
  } catch {
    return false;
  }
};

export const markFlowTabSeen = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FLOW_TAB_SEEN_STORAGE_KEY, SEEN_VALUE);
  } catch {
    // Storage unavailable (private mode, quota, blocked site data): the notice comes back on the next
    // page view, which is better than an error for a hint.
  }
};
