import { type TSurveyAppearance } from "@formbricks/types/formbricks-surveys";

export type TResolvedAppearance = "light" | "dark";

// No `setAppearance` call means light on every platform (ENG-3551): a host that never opted in keeps
// exactly the survey it has today.
export const DEFAULT_APPEARANCE: TSurveyAppearance = "light";

const DARK_QUERY = "(prefers-color-scheme: dark)";

let requested: TSurveyAppearance = DEFAULT_APPEARANCE;
let systemQuery: MediaQueryList | undefined;
const listeners = new Set<(appearance: TResolvedAppearance) => void>();

const isAppearance = (value: unknown): value is TSurveyAppearance =>
  value === "light" || value === "dark" || value === "system";

// "system" on the web follows the browser setting. Native SDKs resolve their app's own theme and
// only ever pass "light" or "dark", because a WebView reports it inconsistently (ENG-3452).
const resolve = (appearance: TSurveyAppearance): TResolvedAppearance => {
  if (appearance !== "system") return appearance;
  return globalThis.matchMedia?.(DARK_QUERY).matches ? "dark" : "light";
};

export const getResolvedAppearance = (): TResolvedAppearance => resolve(requested);

// Every survey root carries the attribute, including the second #fbjs the dropdown portal renders
// under <body>, so `#fbjs[data-appearance="dark"]` rules reach all of them.
const applyToDom = (resolved: TResolvedAppearance) => {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLElement>('[id="fbjs"]').forEach((root) => {
    root.dataset.appearance = resolved;
  });
};

const notify = () => {
  const resolved = getResolvedAppearance();
  applyToDom(resolved);
  listeners.forEach((listener) => listener(resolved));
};

const onSystemChange = () => notify();

/**
 * Sets the survey appearance. Switching is an attribute flip on the survey roots: the theme CSS
 * already carries both palettes, so the survey keeps its answers, progress and focus.
 * Unknown values fall back to light rather than throwing inside a host page.
 */
export const setAppearance = (appearance: unknown): void => {
  requested = isAppearance(appearance) ? appearance : DEFAULT_APPEARANCE;

  if (requested === "system") {
    if (!systemQuery && typeof globalThis.matchMedia === "function") {
      systemQuery = globalThis.matchMedia(DARK_QUERY);
      systemQuery.addEventListener?.("change", onSystemChange);
    }
  } else if (systemQuery) {
    systemQuery.removeEventListener?.("change", onSystemChange);
    systemQuery = undefined;
  }

  notify();
};

export const subscribeToAppearance = (listener: (appearance: TResolvedAppearance) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
