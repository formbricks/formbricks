/**
 * The public shapes of the Analysis export service (GLOSSARY "Analysis export").
 *
 * The service produces columns, rows and the Unmapped values list. It writes no file: Excel, the
 * zip CSVs, the Datamap and the SPSS syntax read these types and nothing else.
 */
import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import type { TResponseFilterCriteria } from "@formbricks/types/responses";

/** A cell. `null` is blank: unanswered, not shown, or not applicable. Never `undefined`, never `""`. */
export type TAnalysisCell = string | number | null;

/** Which answer cells a row carries: codes, the answer text, or both (the writer then makes two files). */
export type TAnswerDisplay = "codes" | "text" | "both";

/** Response columns on top of the three that are always there (`response_id`, `language`, `outcome`). */
export type TAnalysisResponseFields = {
  /** `timestamp`, the creation time in the organization's time zone, as the Standard export writes it. */
  timestamp?: boolean;
  /** `finished`: 1 or 0. */
  finished?: boolean;
  /** `tags`: names joined by `, `. */
  tags?: boolean;
  /** `user_id` and `contact_id`. */
  contact?: boolean;
  /** `quotas`: names of the quotas screened in, joined by `, `. Only when `isQuotasAllowed`. */
  quotas?: boolean;
  /** `verified_email`, for surveys that verify email. */
  verifiedEmail?: boolean;
  /** Hidden fields and variables (Embedded Data), typed. */
  embeddedData?: boolean;
  /** Reserved Embedded Data: browser, country, UTM source and the like, typed. */
  metadata?: boolean;
};

export type TAnalysisExportInput = {
  surveyId: string;
  /** The Responses filter. Low quality is left out unless this selects it (`{ outcome: "lowQuality" }`). */
  filter?: TResponseFilterCriteria;
  /** Default `"codes"`. */
  answers?: TAnswerDisplay;
  fields?: TAnalysisResponseFields;
  isQuotasAllowed?: boolean;
  /** IANA zone for `timestamp`. Default `"UTC"`. */
  timeZone?: string;
  /** Responses per database round trip. Default 1000, at most 5000. */
  batchSize?: number;
};

export type TAnalysisColumnKind =
  /** Free text, ids, timestamps, names. */
  | "text"
  /** A number: NPS, rating, CSAT, CES, number input, numeric Embedded Data. */
  | "number"
  /** An answer code (single select, picture selection, one matrix row). Values come from `codes`. */
  | "code"
  /** Multi-select option: 1 chosen, 0 answered without it, blank unanswered. Also `finished`. */
  | "flag"
  /** Ranking option: the rank given, blank if unranked. */
  | "rank"
  /** The text a respondent typed into an Other option. */
  | "other_text";

export type TAnalysisColumn = {
  /** Unique in the export. The question code, `<code>_<optionCode>`, `<code>_<rowCode>`, `response_id`... */
  name: string;
  kind: TAnalysisColumnKind;
  /** Where the column comes from. */
  source: "response" | "question" | "embedded";
  /** Set for `source: "question"`. `headline` is the default-language plain text. */
  question?: { id: string; code: string; type: string; headline: string };
  /** Answer codes a `code` column can hold, in option order. Matrix: the matrix columns. */
  codes?: { code: string; label: string }[];
  /** The option a `flag`, `rank` or `other_text` column stands for. */
  option?: { code: string; label: string };
  /** The matrix row a `code` column stands for. */
  matrixRow?: { code: string; label: string };
  /** Scale questions: the number of points. */
  scale?: { range: number };
  /** Set for `source: "embedded"`. Boolean values are written as `true` / `false`, dates as ISO text. */
  embedded?: { type: TEmbeddedDataType; origin: "hidden" | "variable" | "metadata"; label: string };
};

/** The prefix of a code cell whose text matched no option. The text follows it as given. */
export const UNMAPPED_PREFIX = "UNMAPPED:";

export type TAnalysisRow = {
  responseId: string;
  /** One cell per column, in column order. `null` unless `answers` is `"codes"` or `"both"`. */
  codes: TAnalysisCell[] | null;
  /** The same row with answer text where `codes` holds a code. `null` unless `"text"` or `"both"`. */
  labels: TAnalysisCell[] | null;
};

export type TUnmappedValue = {
  /** The column that would have held the value. Multi-select: the question's code, there is no cell. */
  column: string;
  question: { id: string; code: string; headline: string };
  /** The text as given. */
  value: string;
  responseCount: number;
  /** Response languages, sorted, `default` resolved to the survey's default language code. */
  languages: string[];
  /** `null` when the question has no option to compare with. */
  closest: { code: string | null; label: string; similarity: number } | null;
  reason: "no_match" | "ambiguous" | "not_a_number";
  /** At most `UNMAPPED_RESPONSE_IDS_CAP` ids, oldest export order. See `responseIdsTruncated`. */
  responseIds: string[];
  responseIdsTruncated: boolean;
};

export type TAnalysisExportSummary = {
  /** Rows written, known once `rows()` is drained. */
  rowCount: number;
  unmapped: TUnmappedValue[];
  /** Distinct unmapped values dropped past the cap. 0 in practice; non-zero means the list is partial. */
  unmappedDropped: number;
};

export type TAnalysisExport = {
  columns: TAnalysisColumn[];
  /** Known before any row is read: for the modal's count line. */
  counts: { included: number; lowQualityLeftOut: number };
  /** Responses in batches, newest first. Single use. Drain it before calling `summary()`. */
  rows: () => AsyncGenerator<TAnalysisRow[], void, undefined>;
  summary: () => TAnalysisExportSummary;
};
