import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { NESTED_LIST_ITEM_CLASS, NESTED_LIST_ITEM_MARKER_STYLE, exampleTheme } from "./example-theme";

describe("exampleTheme", () => {
  // The stylesheet cannot import the constants, and it is what hides the marker on the structural
  // <li> in the editor, the survey runtime and the studio preview alike. Renaming the theme class
  // without renaming the selector would silently bring the stray bullet back on every surface.
  test("the shared stylesheet suppresses the marker for the theme's nested list class", () => {
    const stylesheet = readFileSync(
      fileURLToPath(new URL("../styles-editor-frontend.css", import.meta.url)),
      "utf8"
    ).replaceAll(/\s+/g, "");

    expect(stylesheet).toContain(`.${NESTED_LIST_ITEM_CLASS}{${NESTED_LIST_ITEM_MARKER_STYLE}`);
  });

  test("uses fb-editor prefix for all classes", () => {
    const themeFlatMap = {
      ...exampleTheme,
      ...exampleTheme.heading,
      ...exampleTheme.list,
      ...exampleTheme.list.nested,
      ...exampleTheme.text,
    };

    Object.values(themeFlatMap).forEach((value) => {
      if (typeof value === "string") {
        expect(value).toMatch(/^fb-editor-/);
      }
    });
  });
});
