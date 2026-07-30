import { describe, expect, test } from "vitest";
import {
  NESTED_LIST_ITEM_CLASS,
  NESTED_LIST_ITEM_MARKER_STYLE,
} from "@/modules/ui/components/editor/lib/example-theme";
import { suppressNestedListMarkers } from "./preview-email-template-styles";

describe("suppressNestedListMarkers", () => {
  test("adds an inline marker suppression to a nested-list wrapper li", () => {
    const html = `<ul><li class="${NESTED_LIST_ITEM_CLASS}"><ul><li>child</li></ul></li></ul>`;

    expect(suppressNestedListMarkers(html)).toBe(
      `<ul><li class="${NESTED_LIST_ITEM_CLASS}" style="${NESTED_LIST_ITEM_MARKER_STYLE}"><ul><li>child</li></ul></li></ul>`
    );
  });

  test.each([
    [
      "list items without the nested class",
      '<ul><li class="fb-editor-listitem" value="1">one</li><li>two</li></ul>',
    ],
    [
      "class names that merely contain the nested class as a substring",
      `<ul><li class="${NESTED_LIST_ITEM_CLASS}-custom">item</li></ul>`,
    ],
    ["html without list items", "<p>hello <strong>world</strong></p>"],
  ])("leaves %s untouched", (_case, html) => {
    expect(suppressNestedListMarkers(html)).toBe(html);
  });

  test("matches the nested class among multiple classes regardless of attribute order", () => {
    const html = `<ol><li value="2" class="fb-editor-listitem ${NESTED_LIST_ITEM_CLASS}"><ol></ol></li></ol>`;

    expect(suppressNestedListMarkers(html)).toBe(
      `<ol><li value="2" class="fb-editor-listitem ${NESTED_LIST_ITEM_CLASS}" style="${NESTED_LIST_ITEM_MARKER_STYLE}"><ol></ol></li></ol>`
    );
  });

  test("preserves the value attribute on ordered-list items", () => {
    const html = `<ol><li class="${NESTED_LIST_ITEM_CLASS}" value="3"><ol></ol></li></ol>`;

    expect(suppressNestedListMarkers(html)).toContain('value="3"');
  });

  test("appends to an existing style attribute instead of replacing it", () => {
    const html = `<ul><li class="${NESTED_LIST_ITEM_CLASS}" style="text-align: center"><ul></ul></li></ul>`;

    expect(suppressNestedListMarkers(html)).toBe(
      `<ul><li class="${NESTED_LIST_ITEM_CLASS}" style="text-align: center;${NESTED_LIST_ITEM_MARKER_STYLE}"><ul></ul></li></ul>`
    );
  });

  test("handles single-quoted attributes", () => {
    const html = `<ul><li class='${NESTED_LIST_ITEM_CLASS}'><ul></ul></li></ul>`;

    expect(suppressNestedListMarkers(html)).toBe(
      `<ul><li class='${NESTED_LIST_ITEM_CLASS}' style="${NESTED_LIST_ITEM_MARKER_STYLE}"><ul></ul></li></ul>`
    );
  });

  test("is idempotent when applied twice", () => {
    const html =
      `<ul><li class="${NESTED_LIST_ITEM_CLASS}"><ul></ul></li>` +
      `<li class="${NESTED_LIST_ITEM_CLASS}" style="text-align: right"><ol></ol></li></ul>`;

    const once = suppressNestedListMarkers(html);

    expect(suppressNestedListMarkers(once)).toBe(once);
  });
});
