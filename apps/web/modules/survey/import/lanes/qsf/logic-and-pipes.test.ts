import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { prepareV3SurveyCreateInput } from "@/app/api/v3/surveys/prepare";
import { describeBooleanExpression, describeQsfLogic } from "./describe-logic";
import { mapEmbeddedDataFieldName } from "./embedded-data";
import { QsfIdRegistry } from "./id-registry";
import { applyPipedTextToDocument, replacePipedText } from "./map-piped-text";
import { type TQsfQuestionMapping, mapQsfQuestion } from "./map-question";
import { buildQsfDocument } from "./map-structure";
import { parseQsf } from "./parse-qsf";
import type { TQsfSurvey } from "./types";

const FIXTURES = join(__dirname, "__fixtures__");

function load(name: string): TQsfSurvey {
  const result = parseQsf(readFileSync(join(FIXTURES, name)));
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.data;
}

function build(model: TQsfSurvey) {
  const ctx = { defaultLanguageCode: model.defaultLanguageCode, languageCodes: model.languageCodes };
  const registry = new QsfIdRegistry(
    model.embeddedDataFields.map((field) => mapEmbeddedDataFieldName(field).fieldId)
  );
  const mapped = new Map<string, TQsfQuestionMapping>();
  for (const [qid, question] of model.questions)
    mapped.set(qid, mapQsfQuestion(question, { ...ctx, idRegistry: registry }));
  return buildQsfDocument(model, mapped, ctx);
}

describe("describeQsfLogic", () => {
  test("lists every skip, display and branch rule in plain language with its QID, plus a summary row", () => {
    const model = load("logic-skip-display-branch.qsf");
    const { issues, count } = describeQsfLogic(model);

    expect(count).toBe(6);
    expect(issues).toHaveLength(7);
    expect(issues.every((issue) => issue.severity === "info" && issue.code === "logic_dropped")).toBe(true);
    expect(issues[0].message).toBe(
      "6 logic rules were not imported. Rebuild them in the editor; each one is listed below."
    );

    const byRef = Object.fromEntries(issues.slice(1).map((issue) => [issue.sourceRef, issue.message]));
    expect(byRef.QID1).toBe("Q1: if 'Do you use our product?' = 'No', skip to the end of the survey");
    expect(byRef.QID2).toBe("Q2 shown only if Q1 'Do you use our product?' = 'Yes'");
    expect(byRef.QID3).toBe("Q3: if 'Which region are you in?' = 'Other', skip to Q5 'Any final comments?'");
    expect(byRef.QID4).toBe("Q4 shown only if region = 'DE'");
    expect(byRef.QID6).toBe("Q6: display logic (could not be read) — check in Qualtrics");
    expect(byRef["EU branch"]).toBe(
      "Branch after 'Usage': if Q3 'Which region are you in?' = 'EU' show 'Compliance'"
    );
  });

  test("a survey without logic yields no rows", () => {
    expect(describeQsfLogic(load("simple.qsf"))).toEqual({ issues: [], count: 0 });
  });

  test("boolean expressions join conjunctions and translate operators", () => {
    const model = load("logic-skip-display-branch.qsf");
    const described = describeBooleanExpression(model, {
      "0": {
        "0": {
          LogicType: "Question",
          QuestionID: "QID1",
          ChoiceLocator: "q://QID1/SelectableChoice/1",
          Operator: "Selected",
        },
        "1": {
          LogicType: "EmbeddedField",
          LeftOperand: "score",
          Operator: "GreaterThan",
          RightOperand: "5",
          Conjuction: "And",
        },
        "2": { LogicType: "Question", QuestionID: "QID5", Operator: "NotEmpty", Conjuction: "Or" },
        Type: "If",
      },
      Type: "BooleanExpression",
    });

    expect(described).toBe(
      "Q1 'Do you use our product?' = 'Yes' and score > '5' or Q5 'Any final comments?' not empty"
    );
    expect(describeBooleanExpression(model, { Type: "BooleanExpression" })).toBeNull();
    expect(describeBooleanExpression(model, "nope")).toBeNull();
  });
});

describe("replacePipedText", () => {
  const ctx = {
    qidToElementId: new Map([["QID1", "Q1"]]),
    hiddenFieldIds: new Set(["firstname", "store_name"]),
  };

  test("maps question and embedded-data pipes to recall and strips the rest", () => {
    expect(
      replacePipedText("Hello ${e://Field/firstName}, you said ${q://QID1/ChoiceTextEntryValue}", ctx)
    ).toEqual({
      text: "Hello #recall:firstname/fallback:#, you said #recall:Q1/fallback:#",
      stripped: [],
    });
    expect(
      replacePipedText("Store ${e://Field/Store-Name} on ${date://CurrentDate/DMY} ${loc://x}", ctx)
    ).toEqual({
      text: "Store #recall:store_name/fallback:# on",
      stripped: ["${date://CurrentDate/DMY}", "${loc://x}"],
    });
  });

  test("a pipe to an unmapped question or unknown field is removed", () => {
    expect(replacePipedText("${q://QID9/ChoiceGroup/SelectedChoices} and ${e://Field/missing}", ctx)).toEqual(
      {
        text: "and",
        stripped: ["${q://QID9/ChoiceGroup/SelectedChoices}", "${e://Field/missing}"],
      }
    );
  });
});

describe("applyPipedTextToDocument", () => {
  test("rewrites every text of the embedded-data fixture and validates with zero invalid params", () => {
    const model = load("embedded-data.qsf");
    const built = build(model);
    const document = built.document!;
    const hiddenFieldIds = new Set((document.hiddenFields as { fieldIds: string[] }).fieldIds);

    const issues = applyPipedTextToDocument(document, {
      qidToElementId: built.qidToElementId,
      hiddenFieldIds,
    });

    const blocks = document.blocks as { elements: { headline: Record<string, string> }[] }[];
    expect(blocks[0].elements[0].headline["en-US"]).toBe(
      "Hello #recall:firstname/fallback:#, how was your visit to #recall:store_name/fallback:#?"
    );
    expect(blocks[0].elements[1].headline["en-US"]).toBe("You said: #recall:Q1/fallback:#. Anything to add?");
    expect(issues).toEqual([
      expect.objectContaining({
        code: "pipe_stripped",
        path: "blocks.0.elements.1.headline",
        vars: { token: "${loc://something}" },
      }),
    ]);

    const preparation = prepareV3SurveyCreateInput({
      workspaceId: "clxx1234567890123456789012",
      ...document,
    });
    expect(preparation.ok, JSON.stringify(preparation.ok ? null : preparation.validation.invalidParams)).toBe(
      true
    );
    expect(JSON.stringify(document)).not.toContain("${");
    expect(JSON.stringify(document)).not.toContain('"logic"');
  });
});
