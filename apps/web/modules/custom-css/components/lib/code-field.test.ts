import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { type TCustomCssError, type TCustomCssWarning } from "@formbricks/types/custom-css";
import {
  CUSTOM_CSS_VARIABLES,
  applyCodeEdit,
  countLines,
  getCaretPosition,
  getCodeLineMarks,
  getCssSuggestionEdit,
  getCssSuggestions,
  getSoftTabEdit,
} from "./code-field";

const error = (line: number | null, appearance: "light" | "dark" | null = "light"): TCustomCssError => ({
  code: "syntax_error",
  scope: "workspace",
  appearance,
  line,
  column: 1,
  reason: "",
});

const warning = (line: number | null, appearance: "light" | "dark" = "light"): TCustomCssWarning => ({
  code: "unsafe_property_removed",
  scope: "workspace",
  appearance,
  line,
  column: 1,
  reason: "",
});

const suggestionsFor = (text: string) => getCssSuggestions(text, text.length)?.suggestions ?? [];

describe("countLines and getCaretPosition", () => {
  test("number an empty field as one line and locate the caret by line and column", () => {
    expect(countLines("")).toBe(1);
    expect(countLines("a {}\nb {}\n")).toBe(3);
    expect(getCaretPosition("a {\n  color", 11)).toEqual({ line: 1, column: 7 });
  });
});

describe("getSoftTabEdit", () => {
  test("inserts two spaces at the caret, replacing a single-line selection", () => {
    const text = "a{}";
    const edit = getSoftTabEdit(text, 2, 2, false);
    expect(applyCodeEdit(text, edit)).toBe("a{  }");
    expect(edit.selectionStart).toBe(4);
    expect(applyCodeEdit("abc", getSoftTabEdit("abc", 1, 2, false))).toBe("a  c");
  });

  test("indents every line a multi-line selection touches and keeps that text selected", () => {
    const text = "a {\ncolor: red;\n}";
    const edit = getSoftTabEdit(text, 2, text.length, false);
    const next = applyCodeEdit(text, edit);
    expect(next).toBe("  a {\n  color: red;\n  }");
    expect(next.slice(edit.selectionStart, edit.selectionEnd)).toBe("{\n  color: red;\n  }");
  });

  test("outdents by at most two spaces per line, never past the line start", () => {
    const text = "    a\n b\nc";
    const edit = getSoftTabEdit(text, 0, text.length, true);
    const next = applyCodeEdit(text, edit);
    expect(next).toBe("  a\nb\nc");
    expect([edit.selectionStart, edit.selectionEnd]).toEqual([0, next.length]);
  });
});

describe("getCodeLineMarks", () => {
  test("marks the lines of the shown field only, and an error outranks a warning", () => {
    const marks = getCodeLineMarks(
      "light",
      [error(3), error(5, "dark"), error(null)],
      [warning(3), warning(7)]
    );
    expect([...marks.entries()]).toEqual([
      [3, "error"],
      [7, "warning"],
    ]);
  });
});

describe("getCssSuggestions", () => {
  test("offers every styling hook and the selected states for an opening bracket", () => {
    const suggestions = suggestionsFor("[");
    expect(suggestions).toContain('[data-fb-part="headline"]');
    expect(suggestions).toContain('[data-checked="true"]');
    expect(suggestions).toContain('[aria-checked="true"]');
  });

  test("narrows hooks to the typed value and replaces from the opening bracket", () => {
    const text = '.x, [data-fb-part="opt';
    expect(getCssSuggestions(text, text.length)).toEqual({
      from: 4,
      suggestions: [
        '[data-fb-part="option"]',
        '[data-fb-part="option-label"]',
        '[data-fb-part="option-control"]',
      ],
    });
    expect(suggestionsFor("[aria")).toEqual(['[aria-checked="true"]']);
  });

  test("offers the theme variables as a property and inside var()", () => {
    expect(suggestionsFor(":root {\n  --fb-button-b")).toEqual([
      "--fb-button-bg-color",
      "--fb-button-border-radius",
    ]);
    expect(suggestionsFor("a { color: var(--fb-brand")).toEqual(["--fb-brand-color"]);
  });

  test("stays quiet for other attributes, unknown names and declaration values", () => {
    expect(getCssSuggestions("[type", 5)).toBeNull();
    expect(getCssSuggestions('[data-fb-part="nope', 19)).toBeNull();
    expect(getCssSuggestions("--foo", 5)).toBeNull();
    expect(getCssSuggestions("--fb-brand-color", 16)).toBeNull();
    expect(getCssSuggestions("a { grid-template-columns: [", 28)).toBeNull();
  });

  test("still suggests selectors for a rule nested in a block", () => {
    expect(suggestionsFor("@media (min-width: 600px) {\n  [data").length).toBeGreaterThan(0);
    expect(suggestionsFor("a { color: red; & [data").length).toBeGreaterThan(0);
  });
});

describe("getCssSuggestionEdit", () => {
  test("replaces the typed fragment, absorbs a closing quote and bracket, and puts the caret after it", () => {
    const text = '[data-fb-part="head"] { }';
    const caret = 19;
    const context = getCssSuggestions(text, caret);
    if (!context) throw new Error("expected suggestions");

    const edit = getCssSuggestionEdit(text, caret, context, context.suggestions[0]);

    expect(applyCodeEdit(text, edit)).toBe('[data-fb-part="headline"] { }');
    expect(edit.selectionStart).toBe('[data-fb-part="headline"]'.length);
  });

  test("leaves what follows a variable alone", () => {
    const text = "a { color: var(--fb-brand) }";
    const caret = text.indexOf(")");
    const context = getCssSuggestions(text, caret);
    if (!context) throw new Error("expected suggestions");

    expect(applyCodeEdit(text, getCssSuggestionEdit(text, caret, context, "--fb-brand-color"))).toBe(
      "a { color: var(--fb-brand-color) }"
    );
  });
});

describe("CUSTOM_CSS_VARIABLES", () => {
  test("matches the Variables table in the customer docs", () => {
    const docs = readFileSync(
      new URL("../../../../../../docs/surveys/general-features/custom-css.mdx", import.meta.url),
      "utf8"
    );
    const section = docs.slice(
      docs.indexOf("## Variables"),
      docs.indexOf("```css", docs.indexOf("## Variables"))
    );
    const documented = new Set(section.match(/--fb-[a-z0-9-]+/g));

    expect(new Set(CUSTOM_CSS_VARIABLES)).toEqual(documented);
  });
});
