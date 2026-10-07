import { describe, expect, test } from "vitest";
import { QSF_RECALL_FALLBACK, collectEmbeddedDataReferences, replacePipedText } from "./piped-text";

const context = {
  recallElement: (ref: string) => (ref === "QID1" ? "Q1" : null),
  hiddenField: (name: string) => (name === "firstName" ? "firstname" : null),
};

describe("collectEmbeddedDataReferences", () => {
  test("finds the embedded data names a text pipes in", () => {
    expect(
      collectEmbeddedDataReferences(
        "Hi ${e://Field/firstName}, ${q://QID1/ChoiceTextEntryValue} ${e://Field/plan tier}"
      )
    ).toEqual(["firstName", "plan tier"]);
  });
});

describe("replacePipedText", () => {
  test("recalls an earlier element and a hidden field, with the fixed fallback", () => {
    expect(
      replacePipedText("You said ${q://QID1/ChoiceTextEntryValue}, ${e://Field/firstName}.", context)
    ).toEqual({
      text: `You said #recall:Q1/fallback:${QSF_RECALL_FALLBACK}#, #recall:firstname/fallback:${QSF_RECALL_FALLBACK}#.`,
      removed: 0,
    });
  });

  test("removes what has no equivalent: a later element, an unknown field, other schemes", () => {
    expect(
      replacePipedText(
        "A ${q://QID9/ChoiceTextEntryValue} B ${e://Field/other} C ${lm://Field/1} D ${date://CurrentDate/SL}",
        context
      )
    ).toEqual({ text: "A B C D", removed: 4 });
  });

  test("removes every pipe where recall does not render", () => {
    expect(replacePipedText("Choice ${q://QID1/ChoiceTextEntryValue}", null)).toEqual({
      text: "Choice",
      removed: 1,
    });
  });

  test("breaks up a recall token the file wrote itself, so it never becomes a live reference", () => {
    expect(replacePipedText("Typed #recall:Q1/fallback:x# here", context).text).toBe(
      "Typed # recall:Q1/fallback:x# here"
    );
  });

  test("breaks up a recall token that forms when a pipe between its letters is removed", () => {
    const result = replacePipedText("#rec${lm://x}all:Q1/fallback:FILE TEXT#", context);

    expect(result.text).toBe("# recall:Q1/fallback:FILE TEXT#");
    expect(result.text).not.toContain("#recall:");
  });

  test("keeps file text that runs on from one of its own recalls from reading as another", () => {
    const result = replacePipedText("${q://QID1/ChoiceTextEntryValue}recall:Q9/fallback:FILE#", context);

    expect(result.text).toBe(`#recall:Q1/fallback:${QSF_RECALL_FALLBACK}# recall:Q9/fallback:FILE#`);
    expect(result.text.match(/#recall:/g)).toHaveLength(1);
  });

  test("ignores placeholder characters the file wrote itself", () => {
    expect(replacePipedText("\uE0000\uE001 ${lm://x}", context).text).toBe("0");
  });

  test("keeps the fallback free of what the editor or the token format refuses", () => {
    expect(QSF_RECALL_FALLBACK.length).toBeGreaterThan(0);
    expect(QSF_RECALL_FALLBACK).not.toMatch(/[#\s]/);
  });

  test("stays linear on a long run of unclosed pipes", () => {
    const text = "${q://".repeat(20_000);
    const started = performance.now();

    expect(replacePipedText(text, context).removed).toBe(0);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
