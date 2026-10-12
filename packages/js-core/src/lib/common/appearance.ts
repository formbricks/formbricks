export type TAppearance = "light" | "dark" | "system";

const APPEARANCES: ReadonlySet<unknown> = new Set<TAppearance>(["light", "dark", "system"]);

// Kept in memory for the page session only: appearance is an app setting, not something to store on
// the contact (unlike setLanguage), and it survives logout (ENG-3452). Default light (ENG-3551).
let appearance: TAppearance = "light";

export const isAppearance = (value: unknown): value is TAppearance => APPEARANCES.has(value);

export const getAppearance = (): TAppearance => appearance;

/**
 * Sets how surveys render: "light", "dark", or "system" to follow the browser setting.
 * Works before setup, and switches an already open survey in place without losing answers.
 * Returns false (and changes nothing) for an unknown value.
 */
export const setAppearance = (value: unknown): boolean => {
  if (!isAppearance(value)) return false;
  appearance = value;
  // Optional: the renderer is served by the (possibly older, self-hosted) Formbricks instance and
  // may predate setAppearance. An old renderer then keeps rendering light.
  globalThis.window.formbricksSurveys?.setAppearance?.(value);
  return true;
};
