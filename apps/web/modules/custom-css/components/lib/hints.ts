import { type TCustomCssInput } from "@formbricks/types/custom-css";
import { type TCustomCssDraft, normalizeCustomCssInput } from "./draft";

/** Properties whose value is a text or background color — the ones that leave dark mode unreadable. */
const COLOR_PROPERTIES = new Set(["color", "background", "background-color"]);

const isColorDeclaration = (segment: string): boolean => {
  const colonIndex = segment.indexOf(":");
  if (colonIndex === -1) return false;
  return COLOR_PROPERTIES.has(segment.slice(0, colonIndex).trim().toLowerCase());
};

/** The index just past the comment that starts at `index`; an unclosed one runs to the end. */
const skipComment = (css: string, index: number): number => {
  const end = css.indexOf("*/", index + 2);
  return end === -1 ? css.length : end + 2;
};

/** The index just past the string that starts at `index`; a backslash escapes the character after it. */
const skipString = (css: string, index: number): number => {
  const quote = css[index];
  let end = index + 1;
  while (end < css.length && css[end] !== quote) {
    end += css[end] === "\\" ? 2 : 1;
  }
  return end + 1;
};

/** Block depth after a `{`, `;` or `}`; a `}` with no open block is ignored. */
const getDepthAfter = (char: string, depth: number): number => {
  if (char === "{") return depth + 1;
  if (char === "}") return Math.max(0, depth - 1);
  return depth;
};

/**
 * Whether a stylesheet declares a text or background color anywhere, nested rules and at-rule
 * blocks included. A single linear pass: comments and strings are skipped, a run of text ended by
 * `{` is a selector or at-rule prelude and is discarded, and a run inside a block ended by `;` or
 * `}` is a declaration. So `a:hover {` or `@media (prefers-color-scheme: dark) {` never count, and
 * neither do custom properties such as `--brand-color`.
 *
 * Not a validator: malformed CSS is the processor's job, and this only decides whether to show a
 * hint.
 */
export const setsTextOrBackgroundColor = (css: string): boolean => {
  let depth = 0;
  let segment = "";
  let index = 0;

  while (index < css.length) {
    const char = css[index];

    if (char === "/" && css[index + 1] === "*") {
      index = skipComment(css, index);
    } else if (char === '"' || char === "'") {
      segment += "''";
      index = skipString(css, index);
    } else if (char === "{" || char === ";" || char === "}") {
      if (char !== "{" && depth > 0 && isColorDeclaration(segment)) return true;
      depth = getDepthAfter(char, depth);
      segment = "";
      index++;
    } else {
      segment += char;
      index++;
    }
  }

  return false;
};

/**
 * The dark-preview hint (ENG-3551, M4.4): base CSS that sets colors applies in dark mode too, where
 * it can leave dark text on a dark card. Shown only while the dark field is empty — once a creator
 * writes dark rules they have seen the problem. We never generate dark CSS for them.
 */
export const shouldShowDarkPreviewHint = (draft: TCustomCssDraft | TCustomCssInput | null): boolean => {
  const normalized = normalizeCustomCssInput(draft);
  return Boolean(
    normalized?.light && normalized.dark === null && setsTextOrBackgroundColor(normalized.light)
  );
};

const STYLE_TAG = /<style(?=[\s/>]|$)/i;
const REL_ATTRIBUTE = /\srel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

const isStylesheetLink = (tag: string): boolean => {
  const match = REL_ATTRIBUTE.exec(tag);
  const rel = match?.[1] ?? match?.[2] ?? match?.[3] ?? "";
  return rel.toLowerCase().split(/\s+/).includes("stylesheet");
};

/**
 * Whether Custom Head Scripts carry page styles — a `<style>` element or a stylesheet `<link>` —
 * that can overlap Custom CSS (ENG-3415). A string check only: the scripts are never parsed as
 * HTML, executed or changed.
 */
export const hasStylesInHeadScripts = (headScripts: string | null | undefined): boolean => {
  if (!headScripts) return false;
  if (STYLE_TAG.test(headScripts)) return true;

  const lower = headScripts.toLowerCase();
  let from = 0;
  while (from < lower.length) {
    const start = lower.indexOf("<link", from);
    if (start === -1) return false;
    const end = lower.indexOf(">", start);
    const tag = lower.slice(start + "<link".length, end === -1 ? lower.length : end);
    if (/^[\s/]/.test(tag) && isStylesheetLink(tag)) return true;
    from = end === -1 ? lower.length : end + 1;
  }
  return false;
};
