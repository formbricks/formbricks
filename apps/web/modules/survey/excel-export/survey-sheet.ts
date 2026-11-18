import type { TFunction } from "i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/utils";
import type { TSurvey, TSurveyStatus } from "@formbricks/types/surveys/types";

/**
 * The Excel export's "Survey" sheet (ADR 0027): what the survey is, for the people reading the
 * Questions sheet — one property per row, in the exporter's language. It is for reading only: the
 * import never reads it (the survey id it checks is in the very hidden meta sheet), so an edit here
 * changes nothing. New properties are new rows.
 *
 * Nothing in it identifies a person: the file goes to reviewers outside the organization.
 */

const statusLabel = (status: TSurveyStatus, t: TFunction): string => {
  switch (status) {
    case "draft":
      return t("common.draft");
    case "inProgress":
      return t("common.in_progress");
    case "paused":
      return t("common.paused");
    case "completed":
      return t("common.completed");
  }
};

const typeLabel = (type: TSurvey["type"], t: TFunction): string =>
  type === "app" ? t("common.app") : t("common.link");

/** A language as the Questions sheet's headers name it: "German (de-DE)". */
const languageLabel = (code: string, alias: string | null, locale: string): string =>
  `${getLanguageLabel(code, locale) ?? alias ?? code} (${code})`;

/** When the file was made, to the minute, in UTC: the same for every reader, wherever they are. */
const formatExportedAt = (exportedAt: Date): string =>
  `${exportedAt.toISOString().slice(0, 16).replace("T", " ")} UTC`;

/**
 * The Survey sheet's rows, its header first. `t` and `locale` are the exporting user's; the values are
 * the survey's own.
 */
export const getSurveySheetRows = ({
  survey,
  t,
  locale,
  exportedAt,
}: {
  survey: TSurvey;
  t: TFunction;
  locale: string;
  exportedAt: Date;
}): string[][] => {
  const languages = [...survey.languages].sort(
    (a, b) => Number(b.default) - Number(a.default) || a.language.code.localeCompare(b.language.code, "en")
  );
  const defaultLanguage = languages.find((language) => language.default);
  const questions = survey.blocks.reduce((count, block) => count + block.elements.length, 0);

  return [
    [t("workspace.surveys.export.excel.property_column"), t("workspace.surveys.export.excel.value_column")],
    [t("common.survey_id"), survey.id],
    [t("common.name"), survey.name],
    [t("common.type"), typeLabel(survey.type, t)],
    [t("common.status"), statusLabel(survey.status, t)],
    ...(defaultLanguage
      ? [
          [
            t("workspace.surveys.export.excel.default_language"),
            languageLabel(defaultLanguage.language.code, defaultLanguage.language.alias, locale),
          ],
          [
            t("workspace.surveys.export.excel.languages"),
            languages.map(({ language }) => languageLabel(language.code, language.alias, locale)).join(", "),
          ],
        ]
      : []),
    [t("common.questions"), String(questions)],
    [t("workspace.surveys.export.excel.exported_at"), formatExportedAt(exportedAt)],
  ];
};
