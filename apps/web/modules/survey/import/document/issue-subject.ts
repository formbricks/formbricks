import { cutText } from "@/lib/utils/cut-text";
import type { TSurveyImportIssuePlace } from "../types";
import type { TDocumentModel } from "./model";
import { type TDocumentPlannedEntry, collapseWhitespace } from "./plan-checks";

/** The most characters of a question's text a report line quotes. */
export const REPORTED_QUESTION_TEXT_CHARS = 60;

/**
 * Where a line of the file is, from its key: `R5` is row 5 of a sheet, `P12` paragraph 12 of a text,
 * `T1R2` row 2 of its first table. Undefined for a key of no such shape.
 */
export const readDocumentPlace = (lineKey: string): TSurveyImportIssuePlace | undefined => {
  const match = /^(?:R(?<row>\d+)|P(?<paragraph>\d+)|T(?<table>\d+)R(?<tableRow>\d+))$/.exec(lineKey);
  if (!match?.groups) return undefined;
  const { row, paragraph, table, tableRow } = match.groups;
  if (row !== undefined) return { kind: "row", row: Number(row) };
  if (paragraph !== undefined) return { kind: "paragraph", paragraph: Number(paragraph) };
  return { kind: "table_row", table: Number(table), row: Number(tableRow) };
};

const quoted = (text: string | undefined): string | undefined => {
  const collapsed = collapseWhitespace(text ?? "");
  return collapsed === "" ? undefined : cutText(collapsed, REPORTED_QUESTION_TEXT_CHARS, "…");
};

/**
 * What a report line names its question by (ENG-7070): where it starts in the file, the ID the file
 * gives it, and its text, so the user can find it without reading keys like `R5`. The text is the
 * question's headline in the default language, or, for a question the import could not read (a skipped
 * one has no headline), the file's own line.
 */
export const describeDocumentQuestion = (
  ref: string,
  {
    entries,
    model,
    defaultLanguage,
  }: {
    entries: ReadonlyArray<Pick<TDocumentPlannedEntry, "ref" | "label" | "headline">>;
    model: Pick<TDocumentModel, "lines">;
    defaultLanguage: string;
  }
): { label?: string; place?: TSurveyImportIssuePlace; questionText?: string } => {
  const entry = entries.find((candidate) => candidate.ref === ref);
  const place = readDocumentPlace(ref);
  const questionText =
    quoted(entry?.headline.get(defaultLanguage)) ??
    quoted(
      model.lines
        .find((line) => line.key === ref)
        ?.cells.map((cell) => cell.text)
        .join(" ")
    );
  return {
    ...(entry?.label ? { label: entry.label } : {}),
    ...(place ? { place } : {}),
    ...(questionText ? { questionText } : {}),
  };
};
