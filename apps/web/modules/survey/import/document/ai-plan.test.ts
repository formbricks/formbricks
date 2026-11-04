import { describe, expect, test } from "vitest";
import { documentQuestionRefs } from "./ai-plan";

const entry = (ref: string, kind = "openText") => ({
  ref,
  kind,
  idCell: null,
  sectionCell: null,
  required: false,
  headline: [{ language: "en-US", cell: `A${ref.slice(1)}`, text: null }],
  subheader: [],
  options: [],
  columns: [],
  lowerLabel: [],
  upperLabel: [],
  dropdown: false,
  inputType: "text",
  scale: null,
  range: null,
  format: null,
  rules: [],
  logicNotes: [],
});

const answer = (asked: string[], questions: unknown[], skipped: { ref: string; reason: string }[] = []) => ({
  refs: new Set(asked),
  object: { defaultLanguage: "en-US", languages: ["en-US"], titleCell: null, questions, skipped },
});

describe("documentQuestionRefs", () => {
  test("counts the lines an answer starts a question on", () => {
    expect(documentQuestionRefs(answer(["R1", "R2"], [entry("R1"), entry("R2", "nps")]))).toEqual([
      "R1",
      "R2",
    ]);
  });

  test("leaves out what the checks would not read as a question", () => {
    const counted = documentQuestionRefs(
      answer(
        ["R1", "R2", "R3", "R4", "R5"],
        [
          entry("R1", "welcome"),
          entry("R2", "ending"),
          // Twice: the checks fail the line as a duplicate.
          entry("R3"),
          entry("R3"),
          // Placed and skipped: the checks fail it.
          entry("R4"),
          // Not a line this call was asked about.
          entry("R9"),
          // Does not parse.
          { ref: "R5", kind: "openText" },
        ],
        [{ ref: "R4", reason: "A note" }]
      )
    );

    expect(counted).toEqual([]);
  });

  test("counts nothing from an answer that is not a plan", () => {
    expect(documentQuestionRefs({ refs: new Set(["R1"]), object: { questions: "R1" } })).toEqual([]);
  });
});
