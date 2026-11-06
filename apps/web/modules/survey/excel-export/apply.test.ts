import { createId } from "@paralleldrive/cuid2";
import { describe, expect, test } from "vitest";
import type { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { V3_SURVEY_MAX_BLOCKS } from "@/app/api/v3/surveys/schemas";
import { SurveyImportInputError } from "@/modules/survey/import/core/errors";
import { openZipArchive } from "@/modules/survey/import/core/zip";
import { EVERY_TEXT_SURVEY } from "@/modules/survey/lib/__fixtures__/every-text-survey";
import { getElementDefaults, universalElementPresets } from "@/modules/survey/lib/elements";
import { editExcelExport, rowOf } from "./__fixtures__/edit-sheet";
import { createIcuTranslate } from "./__fixtures__/translate";
import { type TExcelExportApplied, applyExcelExport } from "./apply";
import { createExcelExportLabels } from "./labels";
import { readExcelExport } from "./read";
import { writeExcelExport } from "./write";

const t = createIcuTranslate("en-US");
const germanT = createIcuTranslate("de-DE");
const SURVEY = EVERY_TEXT_SURVEY as unknown as TSurvey;

// The texts sheet's columns: hidden key, Question ID, Type, English (default), German, Logic.
const EN = 3;
const DE = 4;

const exported = (survey: TSurvey = SURVEY, exportT = t, locale = "en-US") =>
  writeExcelExport({ survey, t: exportT, locale });

/** Import `bytes`, edited by `edit`, into `survey`, as the Excel export lane does. */
const importSheet = (
  edit: (rows: string[][]) => string[][],
  { survey = SURVEY, bytes = exported(survey) }: { survey?: TSurvey; bytes?: Uint8Array } = {}
): TExcelExportApplied =>
  applyExcelExport(survey, {
    read: readExcelExport(openZipArchive(editExcelExport(bytes, edit))),
    labels: createExcelExportLabels([germanT, t]),
    newElement: (type: TSurveyElementTypeEnum) =>
      ({
        ...universalElementPresets,
        ...getElementDefaults(type, undefined, t),
        id: createId(),
        type,
      }) as TSurveyElement,
    t,
    truncatedSuffix: t("workspace.surveys.export.excel.truncated"),
  });

const elementsOf = (survey: TSurvey) => survey.blocks.flatMap((block) => block.elements);
const elementOf = (survey: TSurvey, id: string) => {
  const element = elementsOf(survey).find((candidate) => candidate.id === id);
  if (!element) throw new Error(`No element ${id}`);
  return element as TSurveyElement & Record<string, unknown>;
};
const codes = (applied: TExcelExportApplied) => applied.issues.map((issue) => issue.code);

/** A row added in the sheet: no key, a Question ID, a Type, and its English and German texts. */
const added = (questionId: string, type: string, en: string, de = ""): string[] => [
  "",
  questionId,
  type,
  en,
  de,
  "",
];

describe("applyExcelExport: texts", () => {
  test("changes nothing for a sheet as it was exported", () => {
    const applied = importSheet((rows) => rows);

    expect(applied.survey.blocks).toEqual(SURVEY.blocks);
    expect(applied.survey.welcomeCard).toEqual(SURVEY.welcomeCard);
    expect(applied.issues).toEqual([{ code: "texts_updated", severity: "info", params: { count: 0 } }]);
  });

  test("writes a cell that differs from the survey into its text, in its language", () => {
    const applied = importSheet((rows) => {
      rows[rowOf(rows, "element.open.placeholder")][DE] = "Schreib hier";
      rows[rowOf(rows, "element.single.choice.no.label")][EN] = "Nope";
      return rows;
    });

    expect(elementOf(applied.survey, "open").placeholder).toEqual({
      default: "Type here",
      de: "Schreib hier",
    });
    expect((elementOf(applied.survey, "single").choices as { label: unknown }[])[1].label).toEqual({
      default: "Nope",
      de: "Nein",
    });
    expect(applied.issues[0]).toEqual({ code: "texts_updated", severity: "info", params: { count: 2 } });
  });

  test("leaves a text alone when its cell is emptied, and every text whose row was deleted", () => {
    const applied = importSheet((rows) => {
      rows[rowOf(rows, "element.open.headline")][DE] = "";
      return rows.filter((row) => !row[0].startsWith("element.nps."));
    });

    expect(applied.survey.blocks).toEqual(SURVEY.blocks);
  });

  test("fills a translation the survey did not have", () => {
    const applied = importSheet((rows) => {
      rows[rowOf(rows, "element.pictures.choice.mug-a.imageAltText")][DE] = "Blaue Tasse";
      return rows;
    });

    const choices = elementOf(applied.survey, "pictures").choices as { imageAltText?: unknown }[];
    expect(choices[0].imageAltText).toEqual({ default: "Blue mug", de: "Blaue Tasse" });
  });

  test("stores an edited headline as paragraphs of escaped text, flagging formatting it had", () => {
    const applied = importSheet((rows) => {
      rows[rowOf(rows, "welcomeCard.subheader")][EN] = "Glad <you> are here\nTruly";
      rows[rowOf(rows, "element.open.subheader")][EN] = "Be very honest";
      return rows;
    });

    expect(applied.survey.welcomeCard.subheader).toEqual({
      default: "<p>Glad &lt;you&gt; are here</p><p>Truly</p>",
      de: "<p>Schön, dass du <b>da</b> bist</p>",
    });
    expect(elementOf(applied.survey, "open").subheader).toEqual({
      default: "<p>Be very honest</p>",
      de: "<p>Sei ehrlich</p>",
    });
    // Only the welcome card's text had formatting to lose.
    expect(applied.issues.filter((issue) => issue.code === "sheet_formatting_dropped")).toHaveLength(1);
  });

  test("shows a plain text as typed when it would parse as HTML", () => {
    const applied = importSheet((rows) => {
      rows[rowOf(rows, "element.single.choice.yes.label")][EN] = 'Yes <img src=x onerror="alert(1)">';
      return rows;
    });

    const label = (elementOf(applied.survey, "single").choices as { label: Record<string, string> }[])[0]
      .label.default;
    expect(label).toBe('Yes \uFF1Cimg src=x onerror="alert(1)">');
    expect(codes(applied)).toContain("markup_escaped");
  });

  test("turns an @Label back into the recall it shows", () => {
    const survey = structuredClone(SURVEY);
    const consent = survey.blocks[1].elements.find((element) => element.id === "consent") as unknown as {
      headline: Record<string, string>;
    };
    consent.headline = { default: "Thanks #recall:open/fallback:friend#, agree?", de: "Danke" };

    const applied = importSheet(
      (rows) => {
        rows[rowOf(rows, "element.consent.headline")][EN] = "Thank you @What should we improve?, agree?";
        return rows;
      },
      { survey }
    );

    expect(elementOf(applied.survey, "consent").headline).toEqual({
      default: "Thank you #recall:open/fallback:friend#, agree?",
      de: "Danke",
    });
  });

  test("finds a language column by its header after it was moved, and reports one whose header changed", () => {
    const applied = importSheet((rows) =>
      rows.map((row, index) => {
        const [key, id, type, en, de, logic] = row;
        // German moved before English, and the English header renamed.
        const next = [key, id, type, de, en, logic];
        if (index === 0) next[DE] = "English";
        if (row[0] === "element.open.headline") next[EN] = "Was sollen wir besser machen?";
        return next;
      })
    );

    expect(elementOf(applied.survey, "open").headline).toEqual({
      default: "What should we improve?",
      de: "Was sollen wir besser machen?",
    });
    expect(applied.issues).toContainEqual({
      code: "sheet_language_skipped",
      severity: "warning",
      params: { code: "en", cause: "column_missing" },
    });
  });

  test("skips a row whose text the survey no longer has, and a repeated row", () => {
    const applied = importSheet((rows) => {
      const open = rows[rowOf(rows, "element.open.headline")];
      return [...rows, ["element.gone.headline", "gone", "Free text", "Gone", "", ""], [...open]];
    });

    expect(applied.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "sheet_row_skipped",
          params: expect.objectContaining({ cause: "unknown_key" }),
        }),
        expect.objectContaining({
          code: "sheet_row_skipped",
          params: expect.objectContaining({ cause: "duplicate_key" }),
        }),
      ])
    );
  });

  test("refuses a sheet none of whose rows is a text of the survey", () => {
    const other = {
      ...SURVEY,
      id: "clsurvey0000000000000002",
      welcomeCard: { ...SURVEY.welcomeCard, enabled: false },
      blocks: [],
      endings: [],
    } as unknown as TSurvey;

    expect(() => importSheet((rows) => rows, { survey: other, bytes: exported() })).toThrow(
      SurveyImportInputError
    );
    try {
      importSheet((rows) => rows, { survey: other, bytes: exported() });
    } catch (error) {
      expect((error as SurveyImportInputError).invalidParams[0].code).toBe("excel_export_other_survey");
    }
  });
});

describe("applyExcelExport: added rows", () => {
  /** The rows with `added` inserted right after the last row of question `afterId`. */
  const insertAfter = (rows: string[][], afterId: string, ...extra: string[][]) => {
    const last = rows.findLastIndex((row) => row[0].startsWith(`element.${afterId}.`));
    return [...rows.slice(0, last + 1), ...extra, ...rows.slice(last + 1)];
  };

  test("adds a question in its own block after the question above it, with its options and translations", () => {
    const applied = importSheet((rows) =>
      insertAfter(
        rows,
        "single",
        added("fav_color", "Single-Select", "Favourite colour?", "Lieblingsfarbe?"),
        added("fav_color", "Choice 1", "Green", "Grün"),
        // Without a Question ID, a field row belongs to the question above it.
        added("", "Choice 2", "Yellow")
      )
    );

    expect(applied.survey.blocks.map((block) => block.id)).toEqual([
      "block-1",
      applied.survey.blocks[1].id,
      ...SURVEY.blocks.slice(1).map((block) => block.id),
    ]);
    expect(applied.survey.blocks[1].elements.map((element) => element.id)).toEqual(["fav_color"]);
    const question = elementOf(applied.survey, "fav_color");
    expect(question.type).toBe("multipleChoiceSingle");
    // One line, as the other imports store a plain headline.
    expect(question.headline).toEqual({ default: "Favourite colour?", de: "Lieblingsfarbe?" });
    expect((question.choices as { label: unknown }[]).map((choice) => choice.label)).toEqual([
      { default: "Green", de: "Grün" },
      { default: "Yellow" },
    ]);
    // The new block is the editor's, and the question gets its codes like any the editor adds.
    expect(applied.survey.blocks[1].buttonLabel).toEqual({ default: "Next" });
    expect(question.code).toEqual(expect.any(String));
    expect(codes(applied)).toEqual(expect.arrayContaining(["sheet_question_added", "sheet_option_added"]));
  });

  test("reads a question type named in the export's language, or by its id", () => {
    const applied = importSheet(
      (rows) =>
        insertAfter(
          rows,
          "open",
          added("q_de", "Freitext", "Noch etwas?"),
          added("q_id", "nps", "How likely?")
        ),
      { bytes: exported(SURVEY, germanT, "de-DE") }
    );

    expect(elementOf(applied.survey, "q_de").type).toBe("openText");
    expect(elementOf(applied.survey, "q_id").type).toBe("nps");
  });

  test("adds an option to an existing question, before its Other option", () => {
    const applied = importSheet((rows) =>
      insertAfter(rows, "single", added("single", "Choice 4", "Maybe", "Vielleicht"))
    );

    expect(
      (elementOf(applied.survey, "single").choices as { id: string; label: unknown }[]).map((c) => c.label)
    ).toEqual([
      { default: "Yes", de: "Ja" },
      { default: "No", de: "Nein" },
      { default: "Maybe", de: "Vielleicht" },
      { default: "Other", de: "Andere" },
    ]);
  });

  test("adds matrix rows and columns, and a field the question did not have", () => {
    const applied = importSheet((rows) =>
      insertAfter(
        rows,
        "matrix",
        added("matrix", "Row 3", "Support"),
        added("matrix", "Column 3", "Great"),
        added("multi", "Subheader", "Pick all that apply\nOr none")
      )
    );

    const matrix = elementOf(applied.survey, "matrix");
    expect((matrix.rows as { label: unknown }[]).at(-1)?.label).toEqual({ default: "Support" });
    expect((matrix.columns as { label: unknown }[]).at(-1)?.label).toEqual({ default: "Great" });
    expect(elementOf(applied.survey, "multi").subheader).toEqual({
      default: "<p>Pick all that apply</p><p>Or none</p>",
    });
  });

  test("skips the rows it cannot read, saying why, and adds nothing for them", () => {
    const applied = importSheet((rows) =>
      insertAfter(
        rows,
        "single",
        added("x1", "Not a type", "Huh?"),
        added("x2", "Picture selection", "Which picture?"),
        added("open", "Free text", "Taken id"),
        added("x3", "Free text", ""),
        added("nowhere", "Choice 1", "Lost option"),
        added("open", "Choice 1", "Not a choice question"),
        added("nps", "Lower label", "Already has one")
      )
    );

    expect(applied.survey.blocks).toEqual(
      expect.arrayContaining(SURVEY.blocks.map((block) => expect.objectContaining({ id: block.id })))
    );
    expect(elementsOf(applied.survey)).toHaveLength(elementsOf(SURVEY).length);
    expect(
      applied.issues.filter((issue) => issue.code === "sheet_row_skipped").map((issue) => issue.params?.cause)
    ).toEqual([
      "unknown_type",
      "unsupported_type",
      "id_taken",
      "no_text",
      "no_question",
      "field_not_in_question",
      "field_taken",
    ]);
  });

  test("leaves out a question that would not be valid, with its block, and keeps the rest", () => {
    // A choice question with no options is not a question the survey can hold.
    const applied = importSheet((rows) =>
      insertAfter(
        rows,
        "single",
        added("empty_choice", "Single-Select", "Pick?"),
        added("ok_text", "Free text", "Fine?")
      )
    );

    expect(elementsOf(applied.survey).map((element) => element.id)).not.toContain("empty_choice");
    expect(elementOf(applied.survey, "ok_text").type).toBe("openText");
    expect(applied.survey.blocks).toHaveLength(SURVEY.blocks.length + 1);
    expect(applied.issues).toContainEqual(
      expect.objectContaining({
        code: "sheet_row_skipped",
        params: expect.objectContaining({ cause: "invalid_question" }),
      })
    );
  });

  test("adds no question past the most blocks a survey holds", () => {
    const full = structuredClone(SURVEY);
    const [first] = full.blocks;
    full.blocks = [
      ...full.blocks,
      ...Array.from({ length: V3_SURVEY_MAX_BLOCKS - full.blocks.length }, (_, index) => ({
        ...structuredClone(first),
        id: `filler-${index}`,
        elements: [],
      })),
    ];

    const applied = importSheet((rows) => [...rows, added("one_more", "Free text", "One more?")], {
      survey: full,
    });

    expect(applied.survey.blocks).toHaveLength(V3_SURVEY_MAX_BLOCKS);
    expect(applied.issues).toContainEqual(
      expect.objectContaining({ code: "sheet_row_skipped", params: expect.objectContaining({ cause: "survey_full" }) })
    );
  });

  test("never removes a question, an option or a text", () => {
    const applied = importSheet((rows) => [rows[0], rows[1]]);

    expect(elementsOf(applied.survey)).toEqual(elementsOf(SURVEY));
  });
});

describe("applyExcelExport: columns", () => {
  test("uses the column order of a sheet whose ID and Type headers were moved", () => {
    const applied = importSheet((rows) =>
      [...rows, added("moved", "Free text", "Moved?")].map(([key, id, type, en, de, logic]) => [
        key,
        type,
        id,
        en,
        de,
        logic,
      ])
    );

    expect(elementOf(applied.survey, "moved").type).toBe("openText");
  });
});
