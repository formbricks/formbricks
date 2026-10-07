import { describe, expect, test } from "vitest";
import { loadQsfFixture } from "./__fixtures__/load-fixture";
import { QsfImportInputError } from "./errors";
import { OBJECT_MEMBER_NAMES } from "./id-registry";
import { QSF_MAX_OPTIONS_PER_QUESTION } from "./limits";
import { readQsf } from "./read-qsf";

const readError = (qsf: Record<string, unknown>): QsfImportInputError => {
  try {
    readQsf(qsf);
  } catch (error) {
    if (error instanceof QsfImportInputError) return error;
    throw error;
  }
  throw new Error("readQsf did not refuse the file");
};

const minimalQsf = (elements: unknown[], entry: Record<string, unknown> = {}) => ({
  SurveyEntry: { SurveyName: "Minimal", SurveyLanguage: "EN", ...entry },
  SurveyElements: elements,
});

const sq = (qid: string, payload: Record<string, unknown> = {}) => ({
  Element: "SQ",
  PrimaryAttribute: qid,
  Payload: { QuestionText: `Text of ${qid}`, QuestionType: "TE", Selector: "SL", ...payload },
});

const bl = (refs: string[]) => ({
  Element: "BL",
  Payload: [
    {
      ID: "BL_1",
      Type: "Default",
      BlockElements: refs.map((ref) => ({ Type: "Question", QuestionID: ref })),
    },
  ],
});

const fl = (flow: unknown[] = [{ Type: "Block", ID: "BL_1" }]) => ({
  Element: "FL",
  Payload: { Flow: flow },
});

describe("readQsf", () => {
  test("reads questions in flow order, one page per page break", () => {
    const survey = readQsf(loadQsfFixture("logic-skip-display-branch.qsf"));

    expect(survey.pages.map((page) => page.questionRefs)).toEqual([
      ["QID1", "QID2"],
      ["QID3"],
      ["QID4"],
      ["QID5", "QID6"],
    ]);
    expect([...survey.questions.values()].map((question) => question.position)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(survey.embeddedDataNames).toEqual(["region"]);
  });

  test("follows the flow, not the block list, and reports questions the flow never shows", () => {
    const survey = readQsf(loadQsfFixture("pages-and-blocks.qsf"));

    // Block B comes first in the flow; the trashed question is not worth a line, the orphan is.
    expect(survey.pages.map((page) => page.questionRefs)).toEqual([["QID3"], ["QID1"], ["QID2"]]);
    expect(survey.issues).toEqual([
      { code: "question_skipped", severity: "info", questionTag: "Q5", params: { cause: "not_in_flow" } },
    ]);
    // The randomizer becomes a rule on the first page it shuffles.
    expect(survey.pages[1].logic).toEqual([{ kind: "randomizer", conditions: [] }]);
  });

  test("compacts display, skip and branch logic to refs, choice keys and operators", () => {
    const survey = readQsf(loadQsfFixture("logic-skip-display-branch.qsf"));
    const qid1 = survey.questions.get("QID1");
    const qid3 = survey.questions.get("QID3");

    expect(qid1?.logic).toEqual([
      {
        kind: "skip",
        conditions: [{ questionRef: "QID1", choiceKey: qid1?.choices[1].key, operator: "Selected" }],
        destination: "end_of_survey",
      },
    ]);
    expect(survey.questions.get("QID4")?.logic).toEqual([
      { kind: "display", conditions: [{ field: "region", operator: "EqualTo", value: "DE" }] },
    ]);
    // A branch is read before the question it tests, and still gets that question's choice key.
    expect(survey.pages[2].logic).toEqual([
      {
        kind: "branch",
        conditions: [{ questionRef: "QID3", choiceKey: qid3?.choices[0].key, operator: "Selected" }],
      },
    ]);
  });

  test("reads choices in ChoiceOrder, with text entry and exclusive flags", () => {
    const survey = readQsf(loadQsfFixture("simple.qsf"));
    const qid1 = survey.questions.get("QID1");
    const qid5 = survey.questions.get("QID5");

    expect(qid1?.choices.map((choice) => survey.texts.get(choice.key)?.byLanguage.get("en-US"))).toEqual([
      "Search engine",
      "A friend",
      "Other",
    ]);
    expect(qid1?.choices.map((choice) => choice.textEntry)).toEqual([false, false, true]);
    expect(qid1?.forceResponse).toBe("ON");
    expect(qid5?.choices.at(-1)?.exclusive).toBe(true);
    expect(qid5?.randomized).toBe(true);
    expect(survey.endMessageKey).not.toBeNull();
  });

  test("reads the legacy block payload, an object keyed by index", () => {
    const survey = readQsf(loadQsfFixture("legacy-object-payload.qsf"));

    expect(survey.defaultLanguage).toBe("de-DE");
    expect(survey.pages.map((page) => page.questionRefs)).toEqual([["QID1", "QID2"]]);
  });

  test("normalizes languages, keeps translations by text key and reports the unknown ones once", () => {
    const survey = readQsf(loadQsfFixture("labels-and-languages.qsf"));
    const qid1 = survey.questions.get("QID1");

    expect(survey.defaultLanguage).toBe("en-US");
    expect(survey.languages).toEqual(["de-DE", "zh-Hans-CN", "zh-Hant-TW"]);
    expect(survey.texts.get(qid1?.textKey ?? "")?.byLanguage.get("zh-Hans-CN")).toBe("您更喜欢哪种饮料？");
    expect(survey.texts.get(qid1?.choices[0].key ?? "")?.byLanguage.get("de-DE")).toBe("Tee");
    expect(survey.issues).toEqual([
      { code: "language_skipped", severity: "warning", params: { code: "XX" } },
    ]);
  });

  test("falls back to en-US for a default language Formbricks does not know, and says so", () => {
    const survey = readQsf(minimalQsf([sq("QID1"), bl(["QID1"]), fl()], { SurveyLanguage: "KLINGON" }));

    expect(survey.defaultLanguage).toBe("en-US");
    expect(survey.issues).toContainEqual({
      code: "language_skipped",
      severity: "warning",
      params: { fallback: "en-US" },
    });
  });

  test("collects embedded data names from the flow and from piped text, once each", () => {
    const survey = readQsf(loadQsfFixture("embedded-data.qsf"));

    expect(survey.embeddedDataNames).toEqual(["firstName", "Store-Name", "userId", "plan tier"]);
  });

  test("keeps the first 200 embedded data names and reports the rest, instead of refusing the file", () => {
    const fields = Array.from({ length: 205 }, (_, index) => ({ Field: `field_${index + 1}` }));
    const survey = readQsf(
      minimalQsf([
        sq("QID1", { QuestionText: "Hi ${e://Field/piped_extra}" }),
        bl(["QID1"]),
        fl([
          { Type: "EmbeddedData", EmbeddedData: fields },
          { Type: "Block", ID: "BL_1" },
        ]),
      ])
    );

    expect(survey.embeddedDataNames).toHaveLength(200);
    expect(survey.embeddedDataNames.at(-1)).toBe("field_200");
    expect(survey.issues).toContainEqual({
      code: "field_dropped",
      severity: "warning",
      params: { count: 6 },
    });
  });

  test("ignores a message library reference as the end message", () => {
    const survey = readQsf(
      minimalQsf([sq("QID1"), bl(["QID1"]), fl(), { Element: "SO", Payload: { EOSMessage: "MS_abc123" } }])
    );

    expect(survey.endMessageKey).toBeNull();
  });

  describe("refuses a file it cannot read with a 422 naming where", () => {
    test("anything that is not a Qualtrics export", () => {
      expect(readError(loadQsfFixture("not-a-qsf.json")).invalidParams.map((param) => param.name)).toEqual([
        "qsf.SurveyEntry",
        "qsf.SurveyElements",
      ]);
    });

    test("an export with no question in its flow", () => {
      expect(readError(minimalQsf([sq("QID1"), bl(["QID1"]), fl([])])).invalidParams).toEqual([
        { name: "qsf.SurveyElements", reason: "The survey has no questions in its survey flow" },
      ]);
    });

    test("a flow nested deeper than 64 levels, without recursing into it", () => {
      expect(readError(loadQsfFixture("deep-flow.qsf")).invalidParams[0]).toEqual({
        name: "qsf.SurveyElements.2.Payload.Flow",
        reason: "The survey flow is nested deeper than 64 levels",
      });
    });

    test("more questions than the import takes", () => {
      expect(readError(loadQsfFixture("over-limit.qsf")).invalidParams[0].reason).toContain(
        "more than 200 questions"
      );
    });

    test("more choices on one question than the import takes", () => {
      const choices = Object.fromEntries(
        Array.from({ length: QSF_MAX_OPTIONS_PER_QUESTION + 1 }, (_, i) => [
          String(i + 1),
          { Display: `C${i}` },
        ])
      );
      const error = readError(
        minimalQsf([sq("QID1", { QuestionType: "MC", Choices: choices }), bl(["QID1"]), fl()])
      );

      expect(error.invalidParams[0]).toEqual({
        name: "qsf.SurveyElements.0.Payload.Choices",
        reason: `A question has more than ${QSF_MAX_OPTIONS_PER_QUESTION} choices`,
      });
    });

    test("more languages than a survey can have", () => {
      const codes = ["AR", "BG", "CS", "DA", "DE", "EL", "ES", "ET", "FI", "FR", "HE", "HI", "HR", "HU"];
      const regions = ["", "-AT", "-CH", "-BE"];
      const language = Object.fromEntries(
        codes.flatMap((code) => regions.map((region) => [`${code}${region}`, { QuestionText: "x" }]))
      );
      const error = readError(minimalQsf([sq("QID1", { Language: language }), bl(["QID1"]), fl()]));

      expect(error.invalidParams[0].reason).toContain("more than 50 languages");
    });

    test.each([
      ["two block lists", [sq("QID1"), bl(["QID1"]), bl(["QID1"]), fl()], "qsf.SurveyElements.2"],
      ["two flows", [sq("QID1"), bl(["QID1"]), fl(), fl()], "qsf.SurveyElements.3"],
      ["two questions with one id", [sq("QID1"), sq("QID1"), bl(["QID1"]), fl()], "qsf.SurveyElements.1"],
    ])("%s", (_case, elements, name) => {
      expect(readError(minimalQsf(elements)).invalidParams[0].name).toBe(name);
    });
  });

  describe("a file naming things after Object.prototype members", () => {
    test("is read without polluting Object.prototype, and refuses the names it cannot use", () => {
      const before = Object.getOwnPropertyNames(Object.prototype).sort();
      const qsf = loadQsfFixture("pollution.qsf");

      const survey = readQsf(qsf);

      expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(before);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();

      // `__proto__` and `constructor` as question ids are refused with a line each.
      expect([...survey.questions.keys()]).toEqual(["QID1", "QID2", "QID3", "QID4"]);
      expect(survey.issues.filter((issue) => issue.code === "question_skipped")).toHaveLength(2);
      // So are the two choice ids, while the real choices keep their order.
      const qid1 = survey.questions.get("QID1");
      expect(qid1?.choices.map((choice) => survey.texts.get(choice.key)?.byLanguage.get("en-US"))).toEqual([
        "Yes",
        "No",
      ]);
      expect(survey.issues.filter((issue) => issue.code === "choice_dropped")).toHaveLength(2);
      // And the language codes: no translation is kept under them, the real one is.
      expect(survey.languages).toEqual(["de-DE"]);
      expect(survey.issues).toContainEqual({ code: "language_skipped", severity: "warning" });
    });

    test("never turns one into a text key or a language", () => {
      const survey = readQsf(loadQsfFixture("pollution.qsf"));
      const keys = [...survey.texts.keys()];
      const languages = [survey.defaultLanguage, ...survey.languages];

      for (const name of [...keys, ...languages]) {
        expect(OBJECT_MEMBER_NAMES.has(name.toLowerCase())).toBe(false);
      }
      expect(keys.every((key) => /^[tcabs]\d+$/.test(key))).toBe(true);
    });
  });
});
