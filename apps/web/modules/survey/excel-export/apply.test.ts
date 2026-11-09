import { createId } from "@paralleldrive/cuid2";
import { describe, expect, test } from "vitest";
import type { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { V3_SURVEY_MAX_BLOCKS } from "@/app/api/v3/surveys/schemas";
import { SurveyImportInputError } from "@/modules/survey/import/core/errors";
import { EVERY_TEXT_SURVEY } from "@/modules/survey/lib/__fixtures__/every-text-survey";
import { getElementDefaults, universalElementPresets } from "@/modules/survey/lib/element-presets";
import { editExcelExport, rowOf } from "./__fixtures__/edit-sheet";
import { readExportBytes } from "./__fixtures__/read-export";
import { createIcuTranslate } from "./__fixtures__/translate";
import { type TExcelExportApplied, applyExcelExport } from "./apply";
import { createExcelExportLabels } from "./labels";
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
): Promise<TExcelExportApplied> =>
  applyExcelExport(survey, {
    read: readExportBytes(editExcelExport(bytes, edit)),
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
  test("changes nothing for a sheet as it was exported", async () => {
    const applied = await importSheet((rows) => rows);

    expect(applied.survey.blocks).toEqual(SURVEY.blocks);
    expect(applied.survey.welcomeCard).toEqual(SURVEY.welcomeCard);
    expect(applied.issues).toEqual([{ code: "texts_updated", severity: "info", params: { count: 0 } }]);
  });

  test("writes a cell that differs from the survey into its text, in its language", async () => {
    const applied = await importSheet((rows) => {
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

  test("leaves a text alone when its cell is emptied, and every text whose row was deleted", async () => {
    const applied = await importSheet((rows) => {
      rows[rowOf(rows, "element.open.headline")][DE] = "";
      return rows.filter((row) => !row[0].startsWith("element.nps."));
    });

    expect(applied.survey.blocks).toEqual(SURVEY.blocks);
  });

  test("fills a translation the survey did not have", async () => {
    const applied = await importSheet((rows) => {
      rows[rowOf(rows, "element.pictures.choice.mug-a.imageAltText")][DE] = "Blaue Tasse";
      return rows;
    });

    const choices = elementOf(applied.survey, "pictures").choices as { imageAltText?: unknown }[];
    expect(choices[0].imageAltText).toEqual({ default: "Blue mug", de: "Blaue Tasse" });
  });

  test("stores an edited headline as paragraphs of escaped text, flagging formatting it had", async () => {
    const applied = await importSheet((rows) => {
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

  test("shows a plain text as typed when it would parse as HTML", async () => {
    const applied = await importSheet((rows) => {
      rows[rowOf(rows, "element.single.choice.yes.label")][EN] = 'Yes <img src=x onerror="alert(1)">';
      return rows;
    });

    const label = (elementOf(applied.survey, "single").choices as { label: Record<string, string> }[])[0]
      .label.default;
    expect(label).toBe('Yes \uFF1Cimg src=x onerror="alert(1)">');
    expect(codes(applied)).toContain("markup_escaped");
  });

  test("turns back the first 64 distinct @Labels of a text into recalls, and leaves any past them as typed", async () => {
    const survey = structuredClone(SURVEY);
    // Padded, so no label is the start of another: past the cap, a label that starts with one within it
    // would take that one's recall (see RECALL_LABELS_MAX).
    const ids = Array.from({ length: 65 }, (_, index) => `field${String(index).padStart(2, "0")}`);
    survey.hiddenFields = { enabled: true, fieldIds: ids };
    const consent = survey.blocks[1].elements.find((element) => element.id === "consent") as unknown as {
      headline: Record<string, string>;
    };
    consent.headline = { default: ids.map((id) => `#recall:${id}/fallback:x#`).join(" "), de: "Danke" };

    const applied = await importSheet(
      (rows) => {
        rows[rowOf(rows, "element.consent.headline")][EN] += " edited";
        return rows;
      },
      { survey }
    );

    const stored = (elementOf(applied.survey, "consent").headline as Record<string, string>).default;
    const restored = [...stored.matchAll(/#recall:(field\d+)\//g)].map(([, id]) => id);
    expect(restored).toEqual(ids.slice(0, 64));
    expect(stored).toContain(" @field64 edited");
    expect(stored.endsWith(" edited")).toBe(true);
  });

  test("turns an @Label back into the recall it shows", async () => {
    const survey = structuredClone(SURVEY);
    const consent = survey.blocks[1].elements.find((element) => element.id === "consent") as unknown as {
      headline: Record<string, string>;
    };
    consent.headline = { default: "Thanks #recall:open/fallback:friend#, agree?", de: "Danke" };

    const applied = await importSheet(
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

  test("finds a language column by its header after it was moved, and reports one whose header changed", async () => {
    const applied = await importSheet((rows) =>
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

  test("skips a row whose text the survey no longer has, and a repeated row", async () => {
    const applied = await importSheet((rows) => {
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

  test("refuses another survey's sheet even when both have a welcome card, whose keys hold no id", async () => {
    const other = {
      ...SURVEY,
      id: "clsurvey0000000000000002",
      blocks: [],
      endings: [],
    } as unknown as TSurvey;

    await expect(
      importSheet(
        (rows) => {
          rows[rowOf(rows, "welcomeCard.headline")][EN] = "Hijacked";
          return rows;
        },
        { survey: other, bytes: exported() }
      )
    ).rejects.toThrow(SurveyImportInputError);
  });

  test("counts a text changed in two languages once", async () => {
    const applied = await importSheet((rows) => {
      rows[rowOf(rows, "element.open.placeholder")][EN] = "Write here";
      rows[rowOf(rows, "element.open.placeholder")][DE] = "Schreib hier";
      return rows;
    });

    expect(applied.issues[0]).toEqual({ code: "texts_updated", severity: "info", params: { count: 1 } });
  });

  test("leaves a text the export cut to fit its cell as it is, saying it can't come back from the sheet", async () => {
    const long = structuredClone(SURVEY);
    const open = long.blocks[0].elements.find((element) => element.id === "open") as TSurveyElement & {
      placeholder: Record<string, string>;
    };
    const whole = "x".repeat(40_000);
    open.placeholder = { default: whole, de: "Schreib" };

    const applied = await importSheet(
      (rows) => {
        rows[rowOf(rows, "element.open.placeholder")][EN] = "Short again";
        rows[rowOf(rows, "element.open.placeholder")][DE] = "Kurz";
        return rows;
      },
      { survey: long }
    );

    expect(elementOf(applied.survey, "open").placeholder).toEqual({ default: whole, de: "Kurz" });
    expect(applied.issues).toContainEqual({
      code: "sheet_text_not_imported",
      severity: "warning",
      params: expect.objectContaining({ language: "en", cause: "cut_on_export" }),
    });
  });

  test("refuses a sheet none of whose rows is a text of the survey", async () => {
    const other = {
      ...SURVEY,
      id: "clsurvey0000000000000002",
      welcomeCard: { ...SURVEY.welcomeCard, enabled: false },
      blocks: [],
      endings: [],
    } as unknown as TSurvey;

    await expect(importSheet((rows) => rows, { survey: other, bytes: exported() })).rejects.toMatchObject({
      invalidParams: [expect.objectContaining({ code: "excel_export_other_survey" })],
    });
  });
});

describe("applyExcelExport: added rows", () => {
  /** The rows with `added` inserted right after the last row of question `afterId`. */
  const insertAfter = (rows: string[][], afterId: string, ...extra: string[][]) => {
    const last = rows.findLastIndex((row) => row[0].startsWith(`element.${afterId}.`));
    return [...rows.slice(0, last + 1), ...extra, ...rows.slice(last + 1)];
  };

  test("adds a question in its own block after the question above it, with its options and translations", async () => {
    const applied = await importSheet((rows) =>
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

  test("reads a question type named in the export's language, or by its id", async () => {
    const applied = await importSheet(
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

  test("adds an option to an existing question, before its Other option", async () => {
    const applied = await importSheet((rows) =>
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

  test("adds matrix rows and columns, and a field the question did not have", async () => {
    const applied = await importSheet((rows) =>
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

  test("skips the rows it cannot read, saying why, and adds nothing for them", async () => {
    const applied = await importSheet((rows) =>
      insertAfter(
        rows,
        "single",
        added("x1", "Not a type", "Huh?"),
        added("x2", "Picture selection", "Which picture?"),
        added("__proto__", "Free text", "Not an id"),
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
      "id_invalid",
      "id_taken",
      "no_text",
      "no_question",
      "field_not_in_question",
      "field_taken",
    ]);
  });

  test("leaves out a question that would not be valid, with its block, and keeps the rest", async () => {
    // A choice question with no options is not a question the survey can hold.
    const applied = await importSheet((rows) =>
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

  test("puts back only the addition that would break a question the survey had, keeping the question's edited texts", async () => {
    // A ranking question holds at most 25 options: the 24th added is one too many.
    const applied = await importSheet((rows) => {
      rows[rowOf(rows, "element.ranking.headline")][DE] = "Ordne neu";
      return insertAfter(
        rows,
        "ranking",
        ...Array.from({ length: 24 }, (_, index) =>
          added("ranking", `Choice ${index + 3}`, `Option ${index}`)
        )
      );
    });

    const ranking = elementOf(applied.survey, "ranking");
    expect((ranking.headline as Record<string, string>).de).toBe("Ordne neu");
    expect(ranking.choices).toHaveLength(25);
    expect(applied.issues[0]).toEqual({ code: "texts_updated", severity: "info", params: { count: 1 } });
    expect(applied.issues.filter((issue) => issue.code === "sheet_option_added")).toHaveLength(23);
    expect(applied.issues).toContainEqual(
      expect.objectContaining({
        code: "sheet_row_skipped",
        params: expect.objectContaining({ cause: "invalid_question" }),
      })
    );
  });

  test("writes the edits below an added question into their own texts, not into the question that moved there", async () => {
    // The new question's block goes in front of block-2, so every block-2 text moves one block down.
    const applied = await importSheet((rows) => {
      const edited = insertAfter(rows, "single", added("inserted", "Free text", "Inserted?", "Eingefügt?"));
      edited[rowOf(edited, "element.multi.headline")][EN] = "Which ones?";
      edited[rowOf(edited, "element.multi.headline")][DE] = "Welche?";
      edited[rowOf(edited, "element.nps.lowerLabel")][DE] = "Gar nicht";
      edited[rowOf(edited, "element.rating.lowerLabel")][DE] = "Mies";
      return edited;
    });

    expect(elementOf(applied.survey, "inserted").headline).toEqual({
      default: "Inserted?",
      de: "Eingefügt?",
    });
    expect(elementOf(applied.survey, "multi").headline).toEqual({ default: "Which ones?", de: "Welche?" });
    expect((elementOf(applied.survey, "nps").lowerLabel as Record<string, string>).de).toBe("Gar nicht");
    expect((elementOf(applied.survey, "rating").lowerLabel as Record<string, string>).de).toBe("Mies");
    expect(applied.issues[0]).toEqual({ code: "texts_updated", severity: "info", params: { count: 3 } });
  });

  test("writes an Other edit below an added option into Other, not into the option that took its place", async () => {
    const applied = await importSheet((rows) => {
      const no = rowOf(rows, "element.single.choice.no.label");
      const edited = [
        ...rows.slice(0, no + 1),
        added("single", "Choice 3", "Maybe", "Vielleicht"),
        ...rows.slice(no + 1),
      ];
      edited[rowOf(edited, "element.single.choice.other.label")][EN] = "Something else";
      edited[rowOf(edited, "element.single.choice.other.label")][DE] = "Etwas anderes";
      return edited;
    });

    expect(
      (elementOf(applied.survey, "single").choices as { id: string; label: unknown }[]).map(
        ({ id, label }) => (id === "other" ? { id, label } : label)
      )
    ).toEqual([
      { default: "Yes", de: "Ja" },
      { default: "No", de: "Nein" },
      { default: "Maybe", de: "Vielleicht" },
      { id: "other", label: { default: "Something else", de: "Etwas anderes" } },
    ]);
  });

  test("keeps writing a question's texts after one of its additions was undone", async () => {
    // The 24th added option is one too many for a ranking question; the option rows below it still apply.
    const applied = await importSheet((rows) => {
      const headline = rowOf(rows, "element.ranking.headline");
      const edited = [
        ...rows.slice(0, headline + 1),
        ...Array.from({ length: 24 }, (_, index) =>
          added("ranking", `Choice ${index + 3}`, `Option ${index}`)
        ),
        ...rows.slice(headline + 1),
      ];
      const firstChoice = edited.findIndex((row) => row[0].startsWith("element.ranking.choice."));
      edited[firstChoice][DE] = "Erste";
      return edited;
    });

    const ranking = elementOf(applied.survey, "ranking");
    expect(ranking.choices).toHaveLength(25);
    expect((ranking.choices as { label: Record<string, string> }[])[0].label.de).toBe("Erste");
    expect(applied.issues[0]).toEqual({ code: "texts_updated", severity: "info", params: { count: 1 } });
  });

  test("adds no question past the most blocks a survey holds", async () => {
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

    const applied = await importSheet((rows) => [...rows, added("one_more", "Free text", "One more?")], {
      survey: full,
    });

    expect(applied.survey.blocks).toHaveLength(V3_SURVEY_MAX_BLOCKS);
    expect(applied.issues).toContainEqual(
      expect.objectContaining({
        code: "sheet_row_skipped",
        params: expect.objectContaining({ cause: "survey_full" }),
      })
    );
  });

  test("never removes a question, an option or a text", async () => {
    const applied = await importSheet((rows) => [rows[0], rows[rowOf(rows, "element.open.headline")]]);

    expect(elementsOf(applied.survey)).toEqual(elementsOf(SURVEY));
  });
});

describe("applyExcelExport: columns", () => {
  test("uses the column order of a sheet whose ID and Type headers were moved", async () => {
    const applied = await importSheet((rows) =>
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
