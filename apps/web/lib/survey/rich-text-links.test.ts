import { describe, expect, test } from "vitest";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import type { TSurveyEnding } from "@formbricks/types/surveys/types";
import { type TRichTextSurveyContent, addsRichTextLink, getRichTextLinks } from "./rich-text-links";

const withHeadline = (html: string, extra: Record<string, unknown> = {}): TRichTextSurveyContent => ({
  blocks: [
    {
      id: "blk1",
      name: "Block 1",
      elements: [{ id: "q1", type: "openText", headline: { default: html }, required: false, ...extra }],
    },
  ] as unknown as TSurveyBlock[],
  endings: [],
});

describe("getRichTextLinks", () => {
  test.each([
    ["an editor link", '<p>Read <a href="https://example.com/a" target="_blank">this</a></p>'],
    ["an uppercase tag", '<P><A HREF="https://example.com/a">this</A></P>'],
    ["a slash instead of a space", '<p><a/href="https://example.com/a">this</a></p>'],
    ["a > inside a quoted attribute", '<p><a title=">" href="https://example.com/a">this</a></p>'],
    ["an unquoted href", "<p><a href=https://example.com/a>this</a></p>"],
    // The renderer's DOMPurify keeps SVG and MathML, where a link is not an HTML <a href>.
    ["an SVG xlink:href", '<svg><a xlink:href="https://example.com/a"><text y="9">x</text></a></svg>'],
    ["an SVG href", '<svg><a href="https://example.com/a"><text y="9">x</text></a></svg>'],
    ["a MathML href on <math>", '<math href="https://example.com/a"><mi>x</mi></math>'],
    ["a MathML href on a child", '<math><mi href="https://example.com/a">x</mi></math>'],
    [
      "an image-map area",
      '<map name="m"><area href="https://example.com/a" shape="rect" coords="0,0,9,9"></map>',
    ],
    ["a form action", '<form action="https://example.com/a"><button>go</button></form>'],
    // The renderer strips style attributes from the raw string before it parses, which can join the
    // text around one into a link attribute.
    ["an href joined by removing a style", '<p><a hr style="x"ef="https://example.com/a">go</a></p>'],
    ["an href joined across single quotes", "<p><a hr style='x'ef='https://example.com/a'>go</a></p>"],
    ["an href joined before an unquoted value", '<p><a h style="x"ref=https://example.com/a>go</a></p>'],
    [
      "an SVG xlink:href joined by removing a style",
      '<svg><a xlink:hr style="x"ef="https://example.com/a"><text y="9">x</text></a></svg>',
    ],
    [
      "a MathML href joined by removing a style",
      '<math hr style="x"ef="https://example.com/a"><mi>x</mi></math>',
    ],
    [
      "a form action joined by removing a style",
      '<form acti style="x"on="https://example.com/a"><button>go</button></form>',
    ],
  ])("finds %s", (_case, html) => {
    expect(getRichTextLinks(withHeadline(html))).toEqual(new Set(["https://example.com/a"]));
  });

  test.each([
    ["plain rich text", "<p><strong>Bold</strong> question</p>"],
    ["a less-than sign and an <abbr>", "<p>a < b and <abbr>HTML</abbr></p>"],
    ["an anchor without href", '<p><a name="top">top</a></p>'],
    ["an escaped link the editor shows as text", '<p>&lt;a href="https://example.com/a"&gt;</p>'],
    ["a script URL the renderer strips", '<p><a href="javascript:alert(1)">x</a></p>'],
    ["the word href in text", "<p>Type href to see it</p>"],
    ["split attributes the renderer leaves apart", '<p><a hr style=x ef="https://example.com/a">go</a></p>'],
    ["a formaction the renderer strips", '<button formaction="https://example.com/a">go</button>'],
    ["an SVG <use> the renderer strips", '<svg><use href="https://example.com/a.svg#x"></use></svg>'],
  ])("finds no link in %s", (_case, html) => {
    expect(getRichTextLinks(withHeadline(html)).size).toBe(0);
  });

  test("reads every rich-text field in every language", () => {
    const link = (path: string) => `<p><a href="https://example.com/${path}">x</a></p>`;
    const survey: TRichTextSurveyContent = {
      blocks: [
        {
          id: "blk1",
          name: "Block 1",
          elements: [
            {
              id: "q1",
              type: "openText",
              headline: { default: "Plain", de: link("headline-de") },
              subheader: { default: link("subheader") },
              required: false,
            },
            {
              id: "q2",
              type: "date",
              headline: { default: "When?" },
              html: { default: link("date-html") },
              format: "M-d-y",
              required: false,
            },
          ],
        },
      ] as unknown as TSurveyBlock[],
      welcomeCard: {
        enabled: true,
        headline: { default: link("welcome-headline") },
        subheader: { default: link("welcome-subheader") },
        timeToFinish: false,
        showResponseCount: false,
      },
      endings: [
        {
          id: "end1",
          type: "endScreen",
          headline: { default: link("ending-headline") },
          subheader: { default: link("ending-subheader") },
        },
        { id: "end2", type: "redirectToUrl", url: "https://example.com/redirect" },
      ] as TSurveyEnding[],
    };

    expect([...getRichTextLinks(survey)].sort()).toEqual(
      [
        "date-html",
        "ending-headline",
        "ending-subheader",
        "headline-de",
        "subheader",
        "welcome-headline",
        "welcome-subheader",
      ].map((path) => `https://example.com/${path}`)
    );
  });
});

// The survey resolves `#recall:ID/fallback:TEXT#` before it parses (`replaceRecallInfo`): a text
// variable's value, else the respondent's answer or hidden field, else the fallback.
describe("getRichTextLinks with recall", () => {
  const VARIABLE_ID = "clvar1234567890123456789012";
  const withVariable = (html: string, value: string): TRichTextSurveyContent => ({
    ...withHeadline(html),
    variables: [{ id: VARIABLE_ID, name: "v1", type: "text", value }],
  });

  test("finds an href joined when a token with an empty fallback resolves to nothing", () => {
    const html = '<p><a hr#recall:q9/fallback:#ef="https://example.com/a">go</a></p>';
    expect(getRichTextLinks(withHeadline(html))).toContain("https://example.com/a");
  });

  test("finds an href a text variable's value completes", () => {
    const html = `<p><a h#recall:${VARIABLE_ID}/fallback:x#="https://example.com/a">go</a></p>`;
    expect(getRichTextLinks(withVariable(html, "ref"))).toContain("https://example.com/a");
  });

  test("finds a link that is a text variable's whole value", () => {
    const html = `<p>#recall:${VARIABLE_ID}/fallback:x#</p>`;
    expect(getRichTextLinks(withVariable(html, '<a href="https://example.com/a">y</a>'))).toContain(
      "https://example.com/a"
    );
  });

  test("finds a link that is a token's fallback", () => {
    const html = '<p>#recall:q9/fallback:<a href="https://example.com/a">y</a>#</p>';
    expect(getRichTextLinks(withHeadline(html))).toContain("https://example.com/a");
  });

  test("counts a token inside an opening tag, whose runtime value could make it a link", () => {
    const html = "<p><a #recall:q9/fallback:x#>go</a></p>";
    expect(getRichTextLinks(withHeadline(html)).size).toBe(1);
  });

  test("finds no link in a plain recall token", () => {
    const html = `<p>Hi #recall:q9/fallback:there#, and #recall:${VARIABLE_ID}/fallback:x#</p>`;
    expect(getRichTextLinks(withVariable(html, "friend")).size).toBe(0);
  });

  test("resolves a token that follows more than a hundred others", () => {
    const linkVariableId = "clvar1234567890123456789099";
    const html = `<p>${`#recall:${VARIABLE_ID}/fallback:x# `.repeat(150)}#recall:${linkVariableId}/fallback:x#</p>`;
    const survey: TRichTextSurveyContent = {
      ...withHeadline(html),
      variables: [
        { id: VARIABLE_ID, name: "v1", type: "text", value: "friend" },
        { id: linkVariableId, name: "v2", type: "text", value: '<a href="https://example.com/a">y</a>' },
      ],
    };
    expect(getRichTextLinks(survey)).toContain("https://example.com/a");
  });

  test("counts a variable that recalls itself as a link instead of passing it", () => {
    const token = `#recall:${VARIABLE_ID}/fallback:x#`;
    expect(getRichTextLinks(withVariable(`<p>${token}</p>`, `a ${token}`)).size).toBe(1);
  });

  test("resolves a finite chain of variables deeper than ten, to see a link another token adds", () => {
    const chainIds = Array.from({ length: 12 }, (_, i) => `clchain${String(i).padStart(20, "0")}`);
    const chain = chainIds.map((id, i) => ({
      id,
      name: `c${i}`,
      type: "text" as const,
      value: i < chainIds.length - 1 ? `#recall:${chainIds[i + 1]}/fallback:x#` : "end",
    }));
    const html = `<p>#recall:${chainIds[0]}/fallback:x# #recall:${VARIABLE_ID}/fallback:x#</p>`;
    const withValue = (value: string): TRichTextSurveyContent => ({
      ...withHeadline(html),
      variables: [...chain, { id: VARIABLE_ID, name: "v1", type: "text", value }],
    });

    expect(addsRichTextLink(withValue('<a href="https://example.com/a">y</a>'), withValue("friend"))).toBe(
      true
    );
  });

  test("does not grandfather a self-recalling variable once another variable changes", () => {
    const loopId = "clloop1234567890123456789012";
    const html = `<p>#recall:${loopId}/fallback:x# #recall:${VARIABLE_ID}/fallback:x#</p>`;
    const withValue = (value: string): TRichTextSurveyContent => ({
      ...withHeadline(html),
      variables: [
        { id: loopId, name: "loop", type: "text", value: `a #recall:${loopId}/fallback:x#` },
        { id: VARIABLE_ID, name: "v1", type: "text", value },
      ],
    });

    expect(addsRichTextLink(withValue('<a href="https://example.com/a">y</a>'), withValue("friend"))).toBe(
      true
    );
  });

  // The renderer swaps a token with `String.prototype.replace` and a string, so `$'`, `` $` `` and `$&`
  // in the value expand to the text after the token, before it, and the token itself.
  test("finds a link a $' in a fallback builds from the text after the token", () => {
    const html = `<p>#recall:q9/fallback:<a hr$'#ef="https://example.com/a">x</a></p>`;
    expect(getRichTextLinks(withHeadline(html))).toContain("https://example.com/a");
  });

  test("finds a link a $` in a variable's value builds from the text before the token", () => {
    const html = `ef="https://example.com/a">x</a> #recall:${VARIABLE_ID}/fallback:x#`;
    expect(getRichTextLinks(withVariable(html, "<a hr$`"))).toContain("https://example.com/a");
  });

  test("counts a $& that makes the renderer resolve the same token forever as a link", () => {
    expect(getRichTextLinks(withHeadline("<p>#recall:q9/fallback:$&#</p>")).size).toBe(1);
    expect(getRichTextLinks(withVariable(`<p>#recall:${VARIABLE_ID}/fallback:x#</p>`, "$&")).size).toBe(1);
  });

  test("grandfathers a token in a tag the previous version already had", () => {
    const html = "<p><a #recall:q9/fallback:x#>go</a></p>";
    expect(addsRichTextLink(withHeadline(html), withHeadline(html))).toBe(false);
  });
});

describe("addsRichTextLink", () => {
  const linkTo = (href: string) => withHeadline(`<p><a href="${href}">x</a></p>`);

  test("counts every link of a new survey", () => {
    expect(addsRichTextLink(linkTo("https://example.com/a"))).toBe(true);
    expect(addsRichTextLink(withHeadline("<p>No link</p>"))).toBe(false);
  });

  test("grandfathers a link the previous version had, even when the markup around it changed", () => {
    const previous = linkTo("https://example.com/a");
    const next = withHeadline(
      '<p class="x">Now <b>bold</b>: <a href="https://example.com/a" rel="noopener">x</a></p>'
    );

    expect(addsRichTextLink(next, previous)).toBe(false);
  });

  test("flags a link the previous version did not have", () => {
    expect(addsRichTextLink(linkTo("https://example.com/b"), linkTo("https://example.com/a"))).toBe(true);
  });

  test("allows removing links", () => {
    expect(addsRichTextLink(withHeadline("<p>Gone</p>"), linkTo("https://example.com/a"))).toBe(false);
  });

  test("tolerates a stored survey without blocks, endings or welcome card", () => {
    expect(addsRichTextLink(linkTo("https://example.com/a"), { blocks: null, endings: null })).toBe(true);
  });
});
