import { describe, expect, test } from "vitest";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { EVERY_TEXT_SURVEY } from "@/modules/survey/lib/__fixtures__/every-text-survey";
import { fitCell, toReadableText, toXmlSafeText } from "./cell-text";

const SUFFIX = "… [truncated]";

describe("toReadableText", () => {
  test("flattens rich text to its words, one line per paragraph, entities decoded", () => {
    expect(
      toReadableText({
        text: '<p class="fb-editor-paragraph" dir="ltr"><span>Tom &amp; Jerry</span></p><p><br></p><p><br></p><p>Second <b>line</b></p><ul><li>a</li><li>b</li></ul>',
        isRichText: true,
        survey: EVERY_TEXT_SURVEY,
        languageCode: "default",
      })
    ).toBe("Tom & Jerry\n\nSecond line\na\nb");
  });

  test("leaves plain text as written, markup-looking characters included", () => {
    expect(
      toReadableText({
        text: "<b> is not bold here",
        isRichText: false,
        survey: EVERY_TEXT_SURVEY,
        languageCode: "default",
      })
    ).toBe("<b> is not bold here");
  });

  test("shows a recall token as @Label, with the label in the column's language", () => {
    const text = "<p>You picked #recall:single/fallback:something# today</p>";
    const read = (languageCode: string) =>
      toReadableText({ text, isRichText: true, survey: EVERY_TEXT_SURVEY as TSurvey, languageCode });

    expect(read("default")).toBe("You picked @Pick one today");
    expect(read("de")).toBe("You picked @Wähle eins today");
  });
});

describe("fitCell", () => {
  test("keeps a text that fits exactly", () => {
    const text = "x".repeat(32_767);
    expect(fitCell(text, SUFFIX)).toBe(text);
  });

  test("cuts a text one character too long to 32,767 characters ending in the suffix", () => {
    const cell = fitCell("x".repeat(32_768), SUFFIX);
    expect(cell).toHaveLength(32_767);
    expect(cell.endsWith(`x${SUFFIX}`)).toBe(true);
  });

  test("drops an emoji at the cut whole rather than leaving half of it", () => {
    const keep = 32_767 - SUFFIX.length - 1;
    const cell = fitCell(`${"x".repeat(keep)}😀${"y".repeat(100)}`, SUFFIX);
    expect(cell).toBe(`${"x".repeat(keep)}${SUFFIX}`);
  });
});

describe("toXmlSafeText", () => {
  test("drops control characters and lone surrogates, keeping tabs, line breaks and emoji", () => {
    expect(toXmlSafeText("a\u0000b\u0007c\td\ne\r￾f\uD800g😀")).toBe("abc\td\ne\rfg😀");
  });
});
