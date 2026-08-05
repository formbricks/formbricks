import { describe, expect, test } from "vitest";
import {
  NESTED_LIST_ITEM_CLASS,
  NESTED_LIST_ITEM_MARKER_STYLE,
} from "@/modules/ui/components/editor/lib/example-theme";
import { suppressNestedListMarkers } from "./preview-email-template-styles";

const marker = `style="${NESTED_LIST_ITEM_MARKER_STYLE}"`;

describe("suppressNestedListMarkers", () => {
  test.each([
    [
      "a nested-list wrapper li",
      `<ul><li class="${NESTED_LIST_ITEM_CLASS}"><ul><li>child</li></ul></li></ul>`,
      `<ul><li class="${NESTED_LIST_ITEM_CLASS}" ${marker}><ul><li>child</li></ul></li></ul>`,
    ],
    [
      "the nested class among multiple classes, whatever the attribute order",
      `<ol><li value="2" class="fb-editor-listitem ${NESTED_LIST_ITEM_CLASS}"><ol></ol></li></ol>`,
      `<ol><li value="2" class="fb-editor-listitem ${NESTED_LIST_ITEM_CLASS}" ${marker}><ol></ol></li></ol>`,
    ],
    [
      "a wrapper li without dropping its ordered-list value",
      `<ol><li class="${NESTED_LIST_ITEM_CLASS}" value="3"><ol></ol></li></ol>`,
      `<ol><li class="${NESTED_LIST_ITEM_CLASS}" value="3" ${marker}><ol></ol></li></ol>`,
    ],
    [
      "a wrapper li by appending to its existing style instead of replacing it",
      `<ul><li class="${NESTED_LIST_ITEM_CLASS}" style="text-align: center"><ul></ul></li></ul>`,
      `<ul><li class="${NESTED_LIST_ITEM_CLASS}" style="text-align: center;${NESTED_LIST_ITEM_MARKER_STYLE}"><ul></ul></li></ul>`,
    ],
    [
      "a wrapper li with single-quoted attributes",
      `<ul><li class='${NESTED_LIST_ITEM_CLASS}'><ul></ul></li></ul>`,
      `<ul><li class='${NESTED_LIST_ITEM_CLASS}' ${marker}><ul></ul></li></ul>`,
    ],
  ])("suppresses the marker on %s", (_case, html, expected) => {
    expect(suppressNestedListMarkers(html)).toBe(expected);
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

  test("is idempotent when applied twice", () => {
    const html =
      `<ul><li class="${NESTED_LIST_ITEM_CLASS}"><ul></ul></li>` +
      `<li class="${NESTED_LIST_ITEM_CLASS}" style="text-align: right"><ol></ol></li></ul>`;

    const once = suppressNestedListMarkers(html);

    expect(suppressNestedListMarkers(once)).toBe(once);
  });
});
