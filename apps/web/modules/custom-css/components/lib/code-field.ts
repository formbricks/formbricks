import { FB_PARTS, FB_PART_ATTRIBUTE } from "@formbricks/survey-ui/parts";
import {
  type TCustomCssAppearance,
  type TCustomCssError,
  type TCustomCssWarning,
} from "@formbricks/types/custom-css";

/**
 * The text logic behind the Custom CSS field (ENG-3723): a plain textarea with a line-number gutter,
 * soft tabs and suggestions for the survey's styling contract. Kept out of the component so it can be
 * tested as plain string-in, string-out functions.
 *
 * Every change is a range replacement rather than a new value, so the field can apply it as typed text
 * and the browser's own undo keeps working.
 */

export const SOFT_TAB = "  ";

/** Replace `text.slice(from, to)` with `insert`, then select `selectionStart`–`selectionEnd`. */
export interface TCodeEdit {
  from: number;
  to: number;
  insert: string;
  selectionStart: number;
  selectionEnd: number;
}

export const applyCodeEdit = (text: string, edit: TCodeEdit): string =>
  text.slice(0, edit.from) + edit.insert + text.slice(edit.to);

/** Number of lines the gutter numbers; an empty field still shows line 1. */
export const countLines = (text: string): number => text.split("\n").length;

/** Zero-based line and column of a caret offset, for placing the suggestion list under it. */
export const getCaretPosition = (text: string, caret: number): { line: number; column: number } => {
  const before = text.slice(0, caret);
  const lineStart = before.lastIndexOf("\n") + 1;
  return { line: before.split("\n").length - 1, column: caret - lineStart };
};

/**
 * Tab inserts two spaces at the caret, or indents every line a multi-line selection touches; Shift+Tab
 * removes up to two leading spaces from those lines. The selection follows the text it covered.
 */
export const getSoftTabEdit = (
  text: string,
  selectionStart: number,
  selectionEnd: number,
  outdent: boolean
): TCodeEdit => {
  const isMultiLine = text.slice(selectionStart, selectionEnd).includes("\n");
  if (!outdent && !isMultiLine) {
    const caret = selectionStart + SOFT_TAB.length;
    return {
      from: selectionStart,
      to: selectionEnd,
      insert: SOFT_TAB,
      selectionStart: caret,
      selectionEnd: caret,
    };
  }

  const blockStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
  const lines = text.slice(blockStart, selectionEnd).split("\n");
  const deltas = lines.map((line) =>
    outdent ? -(line.length - line.replace(/^ {1,2}/, "").length) : SOFT_TAB.length
  );
  const changed = lines.map((line, index) => (outdent ? line.slice(-deltas[index]) : SOFT_TAB + line));
  const totalDelta = deltas.reduce((sum, delta) => sum + delta, 0);

  return {
    from: blockStart,
    to: selectionEnd,
    insert: changed.join("\n"),
    selectionStart: Math.max(blockStart, selectionStart + deltas[0]),
    selectionEnd: Math.max(blockStart, selectionEnd + totalDelta),
  };
};

export type TCodeLineMark = "error" | "warning";

/**
 * The gutter marks for one field: lines with an error, or with a removed or ineffective rule. An error
 * outranks a warning on the same line. Issues without a line (a size limit, say) mark nothing.
 */
export const getCodeLineMarks = (
  appearance: TCustomCssAppearance,
  errors: readonly TCustomCssError[],
  warnings: readonly TCustomCssWarning[]
): Map<number, TCodeLineMark> => {
  const marks = new Map<number, TCodeLineMark>();
  for (const warning of warnings) {
    if (warning.appearance === appearance && warning.line !== null) marks.set(warning.line, "warning");
  }
  for (const error of errors) {
    if (error.appearance === appearance && error.line !== null) marks.set(error.line, "error");
  }
  return marks;
};

/**
 * The `--fb-*` variables the theme editor writes, as listed under "Variables" in the customer docs
 * (docs/surveys/general-features/custom-css.mdx); `code-field.test.ts` keeps the two in sync.
 */
export const CUSTOM_CSS_VARIABLES = [
  "--fb-survey-brand-color",
  "--fb-brand-color",
  "--fb-survey-background-color",
  "--fb-border-radius",
  "--fb-element-headline-color",
  "--fb-element-headline-font-family",
  "--fb-element-headline-font-size",
  "--fb-element-headline-font-weight",
  "--fb-element-description-color",
  "--fb-element-description-font-family",
  "--fb-element-description-font-size",
  "--fb-element-description-font-weight",
  "--fb-option-bg-color",
  "--fb-option-border-color",
  "--fb-option-label-color",
  "--fb-option-border-radius",
  "--fb-option-font-family",
  "--fb-option-font-size",
  "--fb-option-font-weight",
  "--fb-option-padding-x",
  "--fb-option-padding-y",
  "--fb-input-bg-color",
  "--fb-input-border-color",
  "--fb-input-text-color",
  "--fb-input-placeholder-color",
  "--fb-input-border-radius",
  "--fb-input-font-family",
  "--fb-input-font-size",
  "--fb-input-font-weight",
  "--fb-input-height",
  "--fb-input-padding-x",
  "--fb-input-padding-y",
  "--fb-input-shadow",
  "--fb-button-bg-color",
  "--fb-button-text-color",
  "--fb-button-border-radius",
  "--fb-button-height",
  "--fb-button-font-size",
  "--fb-button-font-weight",
  "--fb-button-padding-x",
  "--fb-button-padding-y",
  "--fb-progress-track-bg-color",
  "--fb-progress-indicator-bg-color",
  "--fb-progress-track-height",
  "--fb-focus-ring-outer-color",
  "--fb-focus-ring-inner-color",
  "--fb-focus-ring-outer-width",
  "--fb-focus-ring-inner-width",
] as const;

export interface TCssSuggestionContext {
  /** Start of the fragment a suggestion replaces; it ends at the caret. */
  from: number;
  /** Shown as they are inserted. */
  suggestions: string[];
}

const hookSelector = (part: string) => `[${FB_PART_ATTRIBUTE}="${part}"]`;
const HOOK_SELECTORS = FB_PARTS.map(hookSelector);
const STATE_SELECTORS = ['[data-checked="true"]', '[aria-checked="true"]'];

/** Nothing to offer once the typed fragment is already complete. */
const toContext = (from: number, typed: string, matches: string[]): TCssSuggestionContext | null => {
  const suggestions = matches.filter((match) => match !== typed);
  return suggestions.length > 0 ? { from, suggestions } : null;
};

/**
 * Suggestions for the fragment before the caret, if it is one we can help with:
 * - a variable being typed (`--f`, `--fb-but`…), as a property or inside `var()`: the matching `--fb-*`
 *   variables;
 * - a hook value being typed (`[data-fb-part="`, `[data-fb-part="opt`…): the matching hooks;
 * - an attribute selector being typed (`[`, `[data`, `[aria`…), outside a declaration's value: every
 *   hook as a full selector and the selected-state attributes, narrowed to what the typed name starts.
 */
export const getCssSuggestions = (text: string, caret: number): TCssSuggestionContext | null => {
  const before = text.slice(0, caret);

  const variableMatch = /--f[a-z0-9-]*$/.exec(before);
  if (variableMatch) {
    const typed = variableMatch[0];
    return toContext(
      variableMatch.index,
      typed,
      CUSTOM_CSS_VARIABLES.filter((variable) => variable.startsWith(typed))
    );
  }

  if (isInsideDeclarationValue(before)) return null;

  const valueMatch = new RegExp(String.raw`\[${FB_PART_ATTRIBUTE}="?([a-z-]*)$`).exec(before);
  if (valueMatch) {
    const typedPart = valueMatch[1];
    return toContext(
      valueMatch.index,
      valueMatch[0],
      FB_PARTS.filter((part) => part.startsWith(typedPart)).map(hookSelector)
    );
  }

  const attributeMatch = /\[[a-z-]*$/.exec(before);
  if (attributeMatch) {
    const typed = attributeMatch[0];
    return toContext(
      attributeMatch.index,
      typed,
      [...HOOK_SELECTORS, ...STATE_SELECTORS].filter((selector) => selector.startsWith(typed))
    );
  }

  return null;
};

/** Inside `{ … }`, after a property name and its colon: a value, where a selector makes no sense. */
const isInsideDeclarationValue = (before: string): boolean => {
  let depth = 0;
  for (const char of before) {
    if (char === "{") depth++;
    else if (char === "}") depth = Math.max(0, depth - 1);
  }
  if (depth === 0) return false;
  // Nested rules are allowed, so a `[` inside a block can still start a selector. A declaration is a
  // property name and a colon since the block opened or the previous declaration ended.
  const statementStart =
    Math.max(before.lastIndexOf("{"), before.lastIndexOf(";"), before.lastIndexOf("}")) + 1;
  return /^[a-z-]+\s*:(?!:)/i.test(before.slice(statementStart).trimStart());
};

/** Replaces the typed fragment with the chosen suggestion and puts the caret after it. */
export const getCssSuggestionEdit = (
  text: string,
  caret: number,
  context: TCssSuggestionContext,
  suggestion: string
): TCodeEdit => {
  // A selector's closing `"]` already after the caret is absorbed, not doubled.
  const closing = suggestion.endsWith("]") ? (/^"?\]/.exec(text.slice(caret))?.[0] ?? "") : "";
  const end = context.from + suggestion.length;
  return {
    from: context.from,
    to: caret + closing.length,
    insert: suggestion,
    selectionStart: end,
    selectionEnd: end,
  };
};
