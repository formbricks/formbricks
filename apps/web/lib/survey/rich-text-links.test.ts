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
    // The renderer strips style attributes from the raw string before it parses, which can join the
    // text around one into a link attribute.
    ["an href joined by removing a style", '<p><a hr style="x"ef="https://example.com/a">go</a></p>'],
    ["an href joined across single quotes", "<p><a hr style='x'ef='https://example.com/a'>go</a></p>"],
    ["an href joined before an unquoted value", '<p><a h style="x"ref=https://example.com/a>go</a></p>'],
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
    // The renderer's allow-list (ENG-7270) keeps only the editor's markup, so SVG, MathML, image maps and
    // forms never reach a respondent, and neither do the links inside them.
    [
      "an SVG xlink:href the renderer strips",
      '<svg><a xlink:href="https://example.com/a"><text y="9">x</text></a></svg>',
    ],
    [
      "an SVG href the renderer strips",
      '<svg><a href="https://example.com/a"><text y="9">x</text></a></svg>',
    ],
    ["a MathML href on <math> the renderer strips", '<math href="https://example.com/a"><mi>x</mi></math>'],
    ["a MathML href on a child the renderer strips", '<math><mi href="https://example.com/a">x</mi></math>'],
    [
      "an image-map area the renderer strips",
      '<map name="m"><area href="https://example.com/a" shape="rect" coords="0,0,9,9"></map>',
    ],
    ["a form action the renderer strips", '<form action="https://example.com/a"><button>go</button></form>'],
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

  // The renderer escapes every recalled value and never scans one for tokens again (ENG-7270), so a value
  // adds text, never markup: a link-shaped value or fallback is shown as text and is not a link.
  test.each([
    [
      "a text variable's whole value",
      `<p>#recall:${VARIABLE_ID}/fallback:x#</p>`,
      '<a href="https://example.com/a">y</a>',
    ],
    ["a token's fallback", '<p>#recall:q9/fallback:<a href="https://example.com/a">y</a>#</p>', "friend"],
    [
      "a variable that recalls a variable holding a link",
      `<p>#recall:${VARIABLE_ID}/fallback:x#</p>`,
      `#recall:${VARIABLE_ID}/fallback:x#`,
    ],
  ])("finds no link in %s, which the survey shows as text", (_case, html, value) => {
    expect(getRichTextLinks(withVariable(html, value)).size).toBe(0);
  });

  // The renderer replaces the whole token, fallback included, before it parses, so a value such as
  // `href=https://…` becomes an attribute whatever characters the fallback holds.
  test.each([
    ["a plain fallback", "<p><a #recall:q9/fallback:x#>go</a></p>"],
    ["a fallback holding >", "<p><a #recall:q9/fallback:>#>go</a></p>"],
    ["a fallback holding <", "<p><a #recall:q9/fallback:<#>go</a></p>"],
    ["a fallback holding a lone quote", "<p><a #recall:q9/fallback:'#>go</a></p>"],
    ["a token inside a quoted attribute value", '<p><a title="#recall:q9/fallback:x#">go</a></p>'],
    ["a token that is the tag name", "<p><#recall:q9/fallback:x#>go</p>"],
    // The style stripping removes an unquoted style value whole, while the real value may split it.
    ["a token in an unquoted style value", "<p><a style=#recall:q9/fallback:x#>go</a></p>"],
    [
      "a token in a style value inside a comment",
      "<p>hi</p><!-- <p style=#recall:q9/fallback:x#--> <a>go</a>",
    ],
    [
      "a token in a style value beside a title token",
      "<p><a title=#recall:q9/fallback:x# style=#recall:q9/fallback:y#>go</a></p>",
    ],
    // A value of `--` closes a comment, and a tag name ends a raw-text element, unhiding a static link.
    [
      "a token inside a comment",
      '<p>hi</p><!-- a#recall:q9/fallback:x#> <a href="https://example.com/c">go</a> -->',
    ],
    [
      "a token in a textarea end tag",
      '<p>hi</p><textarea></#recall:q9/fallback:x#> <a href="https://example.com/t">go</a></textarea>',
    ],
    ["a token in a title element", "<p>hi</p><title>#recall:q9/fallback:x#</title>"],
    // A literal marker-shaped text cannot make a token that sits in a tag read as plain text.
    [
      "a marker-shaped literal beside a token in a tag",
      '<p>fbrecallmarker0x</p><a h#recall:q9/fallback:x#="https://example.com">go</a>',
    ],
  ])("counts a token inside markup, whose runtime value could make it a link: %s", (_case, html) => {
    const links = [...getRichTextLinks(withHeadline(html))];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toMatch(/^recall in a tag: #recall:q9/);
  });

  // The editor's own markup: a token there is plain text and must not count as a link.
  test.each([
    ["a list item", "<ul><li>Hi #recall:q9/fallback:there#</li></ul>"],
    ["bold text", "<p><strong>#recall:q9/fallback:there#</strong></p>"],
    ["a heading", "<h2>Hello #recall:q9/fallback:there#</h2>"],
    ["link text", '<p><a href="https://example.com/a">#recall:q9/fallback:there#</a></p>'],
    ["two tokens side by side", "<p>#recall:q9/fallback:a##recall:q8/fallback:b#</p>"],
    ["a token with an nbsp fallback", "<p>Hi #recall:q9/fallback:nbsp#</p>"],
  ])("does not count a token in %s as a link of its own", (_case, html) => {
    expect(
      [...getRichTextLinks(withHeadline(html))].filter((link) => link.startsWith("recall in a tag"))
    ).toEqual([]);
  });

  test("finds no link in a recall token in text without any tags", () => {
    expect(getRichTextLinks(withVariable(`Hi #recall:${VARIABLE_ID}/fallback:x#`, "friend")).size).toBe(0);
  });

  test("finds no link in a plain recall token", () => {
    const html = `<p>Hi #recall:q9/fallback:there#, and #recall:${VARIABLE_ID}/fallback:x#</p>`;
    expect(getRichTextLinks(withVariable(html, "friend")).size).toBe(0);
  });

  test("resolves every token in one pass, however many there are", () => {
    const html = `<p>${`#recall:${VARIABLE_ID}/fallback:x# `.repeat(5_000)}<a href="https://example.com/a">y</a></p>`;
    expect(getRichTextLinks(withVariable(html, "friend"))).toEqual(new Set(["https://example.com/a"]));
  });

  // A string replacement would expand `$'`, `` $` `` and `$&` in a value; the renderer uses a replacer.
  test.each([
    ["a $' in a fallback", `<p>#recall:q9/fallback:<a hr$'#ef="https://example.com/a">x</a></p>`, "friend"],
    [
      "a $` in a variable's value",
      `ef="https://example.com/a">x</a> #recall:${VARIABLE_ID}/fallback:x#`,
      "<a hr$`",
    ],
    ["a $& in a fallback", "<p>#recall:q9/fallback:$&#</p>", "friend"],
  ])("finds no link that %s would build by expanding", (_case, html, value) => {
    expect(getRichTextLinks(withVariable(html, value)).size).toBe(0);
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
