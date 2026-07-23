import { describe, expect, test } from "vitest";
import { suppressNestedListMarkers } from "./preview-email-template-styles";

describe("suppressNestedListMarkers", () => {
  test("adds an inline marker suppression to a nested-list wrapper li", () => {
    const html = '<ul><li class="fb-editor-nested-listitem"><ul><li>child</li></ul></li></ul>';

    expect(suppressNestedListMarkers(html)).toBe(
      '<ul><li class="fb-editor-nested-listitem" style="list-style-type:none"><ul><li>child</li></ul></li></ul>'
    );
  });

  test("leaves list items without the nested class untouched", () => {
    const html = '<ul><li class="fb-editor-listitem" value="1">one</li><li>two</li></ul>';

    expect(suppressNestedListMarkers(html)).toBe(html);
  });

  test("does not match class names that merely contain the nested class as a substring", () => {
    const html = '<ul><li class="fb-editor-nested-listitem-custom">item</li></ul>';

    expect(suppressNestedListMarkers(html)).toBe(html);
  });

  test("matches the nested class among multiple classes regardless of attribute order", () => {
    const html = '<ol><li value="2" class="fb-editor-listitem fb-editor-nested-listitem"><ol></ol></li></ol>';

    expect(suppressNestedListMarkers(html)).toBe(
      '<ol><li value="2" class="fb-editor-listitem fb-editor-nested-listitem" style="list-style-type:none"><ol></ol></li></ol>'
    );
  });

  test("preserves the value attribute on ordered-list items", () => {
    const html = '<ol><li class="fb-editor-nested-listitem" value="3"><ol></ol></li></ol>';

    expect(suppressNestedListMarkers(html)).toContain('value="3"');
  });

  test("appends to an existing style attribute instead of replacing it", () => {
    const html = '<ul><li class="fb-editor-nested-listitem" style="text-align: center"><ul></ul></li></ul>';

    expect(suppressNestedListMarkers(html)).toBe(
      '<ul><li class="fb-editor-nested-listitem" style="text-align: center;list-style-type:none"><ul></ul></li></ul>'
    );
  });

  test("handles single-quoted attributes", () => {
    const html = "<ul><li class='fb-editor-nested-listitem'><ul></ul></li></ul>";

    expect(suppressNestedListMarkers(html)).toBe(
      "<ul><li class='fb-editor-nested-listitem' style=\"list-style-type:none\"><ul></ul></li></ul>"
    );
  });

  test("is idempotent when applied twice", () => {
    const html =
      '<ul><li class="fb-editor-nested-listitem"><ul></ul></li>' +
      '<li class="fb-editor-nested-listitem" style="text-align: right"><ol></ol></li></ul>';

    const once = suppressNestedListMarkers(html);

    expect(suppressNestedListMarkers(once)).toBe(once);
  });

  test("leaves html without list items unchanged", () => {
    const html = "<p>hello <strong>world</strong></p>";

    expect(suppressNestedListMarkers(html)).toBe(html);
  });
});
