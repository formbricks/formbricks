import { describe, expect, test } from "vitest";
import { REPORTED_QUESTION_TEXT_CHARS, describeDocumentQuestion, readDocumentPlace } from "./issue-subject";
import type { TDocumentPlannedEntry } from "./plan-checks";

type TEntry = Pick<TDocumentPlannedEntry, "ref" | "label" | "headline">;

const entry = (ref: string, headline: string | null, label: string | null = null): TEntry => ({
  ref,
  label,
  headline: new Map(headline === null ? [] : [["en-US", headline]]),
});

const model = {
  lines: [
    {
      key: "R5",
      cells: [
        { key: "A5", text: "Q5" },
        { key: "B5", text: "Draw your  favourite\nshelf" },
      ],
    },
  ],
};

describe("readDocumentPlace", () => {
  test.each([
    ["R5", { kind: "row", row: 5 }],
    ["P12", { kind: "paragraph", paragraph: 12 }],
    ["T1R2", { kind: "table_row", table: 1, row: 2 }],
  ])("reads %s", (key, place) => {
    expect(readDocumentPlace(key)).toEqual(place);
  });

  test.each(["", "Q5", "R", "R5C2", "T1", "xR5", "R5 "])("gives nothing for %j", (key) => {
    expect(readDocumentPlace(key)).toBeUndefined();
  });
});

describe("describeDocumentQuestion", () => {
  const from = (entries: TEntry[]) => ({ entries, model, defaultLanguage: "en-US" });

  test("names a question by its place and its headline in the default language", () => {
    expect(describeDocumentQuestion("R5", from([entry("R5", "How often do you visit?")]))).toEqual({
      place: { kind: "row", row: 5 },
      questionText: "How often do you visit?",
    });
  });

  test("adds the ID the file gives the question", () => {
    expect(describeDocumentQuestion("R5", from([entry("R5", "How often?", "03")]))).toMatchObject({
      label: "03",
    });
  });

  test("names a question the import could not read by the file's own line", () => {
    // A skipped question has no entry, or one with no headline: its line is all there is to go by.
    const expected = { place: { kind: "row", row: 5 }, questionText: "Q5 Draw your favourite shelf" };
    expect(describeDocumentQuestion("R5", from([]))).toEqual(expected);
    expect(describeDocumentQuestion("R5", from([entry("R5", null)]))).toEqual(expected);
  });

  test("cuts a long text, and never splits an emoji", () => {
    const long = `${"a".repeat(REPORTED_QUESTION_TEXT_CHARS - 2)}😀 and more`;
    const { questionText } = describeDocumentQuestion("R5", from([entry("R5", long)]));
    expect(questionText).toBe(`${"a".repeat(REPORTED_QUESTION_TEXT_CHARS - 2)}…`);
  });

  test("gives nothing for a line it cannot place and has no text for", () => {
    expect(describeDocumentQuestion("X1", from([]))).toEqual({});
  });
});
