import { describe, expect, test } from "vitest";
import { surveyFlowFixture } from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { getFormulaReferences, segmentFormulaText } from "./expression-formula";
import { getFormulaSegmentChip, getReferenceChipKind, toPlainText } from "./reference-chips";

const references = getFormulaReferences(surveyFlowFixture);
const chipsOf = (text: string) =>
  segmentFormulaText(text, references).flatMap((segment) =>
    segment.kind === "reference" ? [getFormulaSegmentChip(segment, surveyFlowFixture)] : []
  );

describe("getFormulaSegmentChip: a formula's references as chips (ENG-6950)", () => {
  test("a question with its type, a hidden field, an Embedded Data field and survey info", () => {
    expect(chipsOf("concat(@sat_netflix, @seg, @segment, @language)")).toEqual([
      { kind: "question", label: "sat_netflix", elementType: "rating" },
      { kind: "hiddenField", label: "seg" },
      { kind: "field", label: "segment" },
      { kind: "reserved", label: "language" },
    ]);
  });

  test("a reference nothing answers to is missing", () => {
    expect(chipsOf("@gone + 1")).toEqual([{ kind: "question", label: "gone", missing: true }]);
  });
});

describe("getReferenceChipKind", () => {
  test("maps each stored operand type", () => {
    expect(getReferenceChipKind("element")).toBe("question");
    expect(getReferenceChipKind("hiddenField")).toBe("hiddenField");
    expect(getReferenceChipKind("variable")).toBe("field");
    expect(getReferenceChipKind("reserved")).toBe("reserved");
  });
});

describe("toPlainText", () => {
  test("reads each reference as its plain form", () => {
    expect(
      toPlainText([
        { kind: "text", text: "If " },
        { kind: "reference", chip: { kind: "question", label: "hours" }, plain: "“hours”" },
        { kind: "text", text: " > 20" },
      ])
    ).toBe("If “hours” > 20");
  });
});
