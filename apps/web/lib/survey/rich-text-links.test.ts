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
