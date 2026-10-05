import { createContext } from "preact";
import {
  CUSTOM_CSS_LAYER_ORDER,
  type TCustomCssCompiled,
  type TRendererCustomCss,
} from "@formbricks/types/custom-css";
import { getStyleNonce } from "@/lib/styles";

/**
 * Customer custom CSS in the renderer (ENG-3552).
 *
 * The CSS arrives already processed by the server: scoped under `#fbjs`, every declaration
 * `!important`, wrapped in its `fb-*` cascade layer, dark rules keyed on
 * `#fbjs[data-appearance="dark"]`. This module only places it in the document:
 *
 * - From the explicit `customCss` prop and nothing else. A survey or styling object that happens to
 *   carry CSS is ignored, so an SDK that does not pass the prop applies none rather than half.
 * - Into ONE `<style>` element, written through `textContent` (never `innerHTML` or string-built HTML),
 *   carrying the same CSP nonce as the built-in styles.
 * - Replaced on every render, removed when a survey without CSS renders or when the survey that owns
 *   it closes, so repeated surveys never stack or inherit stale rules.
 * - All or nothing. A malformed prop or a failed insertion leaves no custom layer behind, records a
 *   bounded diagnostic (never CSS or answers), and the survey keeps its built-in styling.
 *
 * Switching appearance needs nothing here: both appearances are in the element at once, and M3's
 * `setAppearance` only flips `data-appearance` on the survey roots.
 */

export const CUSTOM_CSS_STYLE_ID = "formbricks__custom-css";
export const CUSTOM_CSS_LAYER_PRELUDE_STYLE_ID = "formbricks__custom-css-layers";

/**
 * The layer order statement placed as the FIRST child of `<head>`.
 *
 * Cascade layers are ordered by where their names first appear in the document, and important
 * declarations in an earlier layer beat those in every later layer (and every unlayered one). Placed
 * first, these four names become the document's first four layers, so customer `!important` rules beat
 * the survey's important Tailwind utilities and the theme editor even when the host page — or the
 * Formbricks app around a link survey or editor preview, which is itself Tailwind v4 — declared
 * `theme, base, components, utilities` before the survey's stylesheet arrived.
 *
 * Only the customer layers, deliberately not the full `CUSTOM_CSS_LAYER_PRELUDE`: naming
 * `theme, base, components, utilities` this early would reorder a host page that uses those names in a
 * different order. The survey's own stylesheet still opens with the full prelude (global.css), which
 * fixes the remaining order wherever the host has not already declared it.
 */
export const CUSTOM_CSS_HEAD_PRELUDE = `@layer ${CUSTOM_CSS_LAYER_ORDER.filter((layer) =>
  layer.startsWith("fb-")
).join(", ")};`;

export type TCustomCssDiagnosticCode = "invalid_prop" | "insertion_failed" | "blocked";

export interface TCustomCssDiagnostic {
  code: TCustomCssDiagnosticCode;
  /** Name of the thrown error, when there was one (e.g. "SecurityError"). Never its message. */
  errorName?: string;
}

const MAX_DIAGNOSTICS = 10;
const DIAGNOSTIC_MESSAGES: Record<TCustomCssDiagnosticCode, string> = {
  invalid_prop: "the customCss prop is malformed",
  insertion_failed: "the style element could not be inserted",
  blocked: "the browser did not apply the style element (check the CSP nonce)",
};

const diagnostics: TCustomCssDiagnostic[] = [];
const warnedCodes = new Set<TCustomCssDiagnosticCode>();

/** CSS the current survey should have applied; kept so a nonce that arrives later can re-apply it. */
let desiredCss: string | null = null;
/** Bumped on every `applyCustomCss`, so a survey that closes late cannot remove a newer survey's CSS. */
let generation = 0;

const recordDiagnostic = (diagnostic: TCustomCssDiagnostic): void => {
  diagnostics.push(diagnostic);
  if (diagnostics.length > MAX_DIAGNOSTICS) diagnostics.shift();

  // One line per kind per page: a host re-rendering a survey must not flood its console.
  if (warnedCodes.has(diagnostic.code)) return;
  warnedCodes.add(diagnostic.code);
  console.warn(
    `Formbricks: custom CSS was not applied because ${DIAGNOSTIC_MESSAGES[diagnostic.code]}. The survey uses its built-in styling.`
  );
};

/** The most recent diagnostics, oldest first. Bounded, and never contains CSS or answers. */
export const getCustomCssDiagnostics = (): readonly TCustomCssDiagnostic[] => [...diagnostics];

export const getCustomCssGeneration = (): number => generation;

/**
 * The generation of the `renderSurvey` call that mounted a survey tree. Provided by `renderSurvey` per
 * render, so a survey's own re-renders (state, appearance) keep the generation it was rendered with and
 * its teardown can never release CSS that a later survey applied. `null` outside `renderSurvey`.
 */
export const CustomCssOwnerContext = createContext<number | null>(null);

const isOptionalString = (value: unknown): boolean => value === undefined || typeof value === "string";

const isCompiledScope = (value: unknown): value is TCustomCssCompiled | null | undefined => {
  if (value === undefined || value === null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return false;
  const { light, dark } = value as Record<string, unknown>;
  return isOptionalString(light) && isOptionalString(dark);
};

const toChunks = (scope: TCustomCssCompiled | null | undefined): string[] =>
  [scope?.light, scope?.dark].filter(
    (chunk): chunk is string => typeof chunk === "string" && chunk.trim() !== ""
  );

/**
 * The stylesheet text for a `customCss` prop: `null` when there is nothing to apply, `undefined` when
 * the prop is malformed. Malformed means "not the compiled shape" — e.g. a stored `{ source, compiled }`
 * entry passed by mistake — and rejects the whole prop rather than applying the part that looked right.
 * Workspace before survey only for readability: the layer prelude, not source order, decides who wins.
 */
export const buildCustomCssText = (customCss: unknown): string | null | undefined => {
  if (customCss === undefined || customCss === null) return null;
  if (typeof customCss !== "object" || Array.isArray(customCss)) return undefined;

  const { workspace, survey } = customCss as TRendererCustomCss;
  if (!isCompiledScope(workspace) || !isCompiledScope(survey)) return undefined;

  const chunks = [...toChunks(workspace), ...toChunks(survey)];
  return chunks.length > 0 ? chunks.join("\n") : null;
};

const applyNonce = (element: HTMLElement): boolean => {
  const nonce = getStyleNonce();
  if (!nonce || element.getAttribute("nonce") === nonce) return false;
  element.setAttribute("nonce", nonce);
  return true;
};

/**
 * Puts the customer layer order first in `<head>`, creating the element once and moving it back to
 * the front if something was inserted before it since. See `CUSTOM_CSS_HEAD_PRELUDE`.
 */
export const ensureCustomCssLayerPrelude = (): void => {
  const head = document.head;
  if (!head) return;

  let prelude = document.getElementById(CUSTOM_CSS_LAYER_PRELUDE_STYLE_ID);
  if (!prelude) {
    prelude = document.createElement("style");
    prelude.id = CUSTOM_CSS_LAYER_PRELUDE_STYLE_ID;
    prelude.textContent = CUSTOM_CSS_HEAD_PRELUDE;
  }

  // A style element only re-checks the CSP when its contents change, so re-assign them when a nonce
  // arrives after the element was inserted (a no-op for the cascade).
  if (applyNonce(prelude) && prelude.isConnected) prelude.textContent = CUSTOM_CSS_HEAD_PRELUDE;
  if (head.firstChild !== prelude) head.insertBefore(prelude, head.firstChild);
};

/** Removes the custom CSS element. The layer prelude stays: empty layers change nothing. */
export const removeCustomCss = (): void => {
  desiredCss = null;
  if (typeof document === "undefined") return;
  document.getElementById(CUSTOM_CSS_STYLE_ID)?.remove();
};

const insertCustomCss = (css: string): void => {
  try {
    ensureCustomCssLayerPrelude();

    let element = document.getElementById(CUSTOM_CSS_STYLE_ID);
    if (element && element.tagName !== "STYLE") {
      element.remove();
      element = null;
    }
    if (!element) {
      element = document.createElement("style");
      element.id = CUSTOM_CSS_STYLE_ID;
    }

    const nonceChanged = applyNonce(element);
    // textContent, never innerHTML: the text is CSS, not markup, whatever it contains.
    if (nonceChanged || element.textContent !== css) element.textContent = css;
    if (!element.isConnected) document.head.appendChild(element);

    // A connected <style> gets its sheet synchronously; none means the browser refused it (CSP).
    if (!(element as HTMLStyleElement).sheet) {
      element.remove();
      recordDiagnostic({ code: "blocked" });
    }
  } catch (error) {
    document.getElementById(CUSTOM_CSS_STYLE_ID)?.remove();
    recordDiagnostic({
      code: "insertion_failed",
      errorName: error instanceof Error ? error.name : undefined,
    });
  }
};

/**
 * Applies the custom CSS for the survey being rendered, replacing whatever an earlier survey left.
 * Never throws: on any failure there is no custom CSS and the survey renders with built-in styling.
 */
export const applyCustomCss = (customCss: unknown): void => {
  generation += 1;
  if (typeof document === "undefined") return;

  const css = buildCustomCssText(customCss);
  if (css === undefined) {
    removeCustomCss();
    recordDiagnostic({ code: "invalid_prop" });
    return;
  }
  if (css === null) {
    removeCustomCss();
    return;
  }

  desiredCss = css;
  insertCustomCss(css);
};

/**
 * Teardown for the survey that applied the CSS. A no-op when another render has applied CSS since,
 * so a closing survey cannot strip the next survey's styles.
 */
export const releaseCustomCss = (ownerGeneration: number): void => {
  if (ownerGeneration !== generation) return;
  removeCustomCss();
};

/**
 * Re-applies the current custom CSS with the current nonce. Called when the host sets the CSP nonce
 * after a survey rendered, so a style the browser refused without it gets a second chance.
 */
export const syncCustomCssNonce = (): void => {
  if (typeof document === "undefined") return;
  if (document.getElementById(CUSTOM_CSS_LAYER_PRELUDE_STYLE_ID)) ensureCustomCssLayerPrelude();
  if (desiredCss !== null) insertCustomCss(desiredCss);
};
