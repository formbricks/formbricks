import type { TFunction } from "i18next";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { getElementTypeLabel } from "@/modules/survey/lib/element-type-labels";
import { type TSurveyTextProperty, getSurveyTextFieldLabel } from "@/modules/survey/lib/survey-texts";

/**
 * Reading the Excel export's Type cells back (ENG-6809): the names the export gives element types
 * ("Free text", "Single-Select") and fields ("Choice 3", "Row 2", "Lower label") in its own language,
 * so a row a reviewer added can say what it is. English names and the types' own ids (`openText`) are
 * read too, so a row typed by hand in either works whatever language the sheet was exported in.
 */

/** What a Type cell names on a row that is not a question's: a field of the question above it. */
export type TExcelExportField =
  | { kind: "choice" }
  | { kind: "matrixRow" }
  | { kind: "matrixColumn" }
  | { kind: "property"; property: TExcelExportAddableProperty };

/** The fields a row may add to a question, besides its options. */
export type TExcelExportAddableProperty = Extract<
  TSurveyTextProperty,
  "subheader" | "placeholder" | "label" | "lowerLabel" | "upperLabel" | "ctaButtonLabel"
>;

export const EXCEL_EXPORT_ADDABLE_PROPERTIES: readonly TExcelExportAddableProperty[] = [
  "subheader",
  "placeholder",
  "label",
  "lowerLabel",
  "upperLabel",
  "ctaButtonLabel",
];

export interface TExcelExportLabels {
  /** The element type a Type cell names, or `null`. */
  elementType: (cell: string) => TSurveyElementTypeEnum | null;
  /** The field a Type cell names, or `null`. */
  field: (cell: string) => TExcelExportField | null;
}

const normalize = (text: string): string => text.trim().toLocaleLowerCase("en");

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Stands in for the number in "Choice {n}", to split the translated name around it.
const NUMBER_MARK = "\u0001";

/** A matcher for a numbered field's name in one language: "Choice 3", "Auswahl 3", … */
const numberedName = (name: string): RegExp => {
  const [before = "", after = ""] = name.split(NUMBER_MARK);
  return new RegExp(`^${escapeRegExp(normalize(before))}\\s*\\d+\\s*${escapeRegExp(normalize(after))}$`, "u");
};

/**
 * The matchers for the names the export writes in each of `translations`' languages, the export's own
 * first. Built once per import: a few dozen strings.
 */
export const createExcelExportLabels = (translations: readonly TFunction[]): TExcelExportLabels => {
  const types = new Map<string, TSurveyElementTypeEnum>();
  for (const type of Object.values(TSurveyElementTypeEnum)) types.set(normalize(type), type);

  const numbered: { pattern: RegExp; field: TExcelExportField }[] = [];
  const properties = new Map<string, TExcelExportField>();

  for (const t of translations) {
    for (const type of Object.values(TSurveyElementTypeEnum)) {
      const name = normalize(getElementTypeLabel(type, t));
      if (!types.has(name)) types.set(name, type);
    }
    numbered.push(
      { pattern: numberedName(t("common.choice_n", { n: NUMBER_MARK })), field: { kind: "choice" } },
      { pattern: numberedName(t("common.row_n", { n: NUMBER_MARK })), field: { kind: "matrixRow" } },
      { pattern: numberedName(t("common.column_n", { n: NUMBER_MARK })), field: { kind: "matrixColumn" } }
    );
    for (const property of EXCEL_EXPORT_ADDABLE_PROPERTIES) {
      const name = normalize(getSurveyTextFieldLabel({ kind: "property", property }, t));
      if (!properties.has(name)) properties.set(name, { kind: "property", property });
    }
  }

  return {
    elementType: (cell) => types.get(normalize(cell)) ?? null,
    field: (cell) => {
      const name = normalize(cell);
      if (!name) return null;
      return properties.get(name) ?? numbered.find(({ pattern }) => pattern.test(name))?.field ?? null;
    },
  };
};
