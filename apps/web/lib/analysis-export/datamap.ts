/**
 * The Datamap (GLOSSARY): the codebook that comes with an Analysis export. Long format, one row per
 * column and answer code, one row for a column that has no codes. Pure: it reads the columns the
 * service produced and nothing else, so a column and its row here can never drift apart.
 *
 * Headers are fixed English, whatever the survey language, so a pipeline can rely on them. Question
 * text is the default-language headline in full and repeats on every row, so the sheet filters well.
 * A Base column will go at the far right later; there is none now.
 */
import type { TAnalysisColumn } from "./types";

export const DATAMAP_HEADERS = [
  "Column",
  "Question ID",
  "Question text",
  "Type",
  "Code",
  "Value label",
  "Notes",
] as const;

/** Column, Question ID, Question text, Type, Code, Value label, Notes. `null` is a blank cell. */
export type TDatamapRow = [
  column: string,
  questionId: string | null,
  questionText: string,
  type: string,
  code: string | null,
  valueLabel: string | null,
  notes: string,
];

export type TDatamapOptions = {
  /** Columns that hold at least one `UNMAPPED:` cell (the Unmapped values list says which). */
  unmappedColumns?: ReadonlySet<string>;
};

const BLANK_MEANS = "Blank = not asked or not answered.";
const UNMAPPED_NOTE =
  "A cell that starts with UNMAPPED: holds an answer that matches no option, see the Unmapped values sheet.";

type TInfo = { text: string; detail: string; notes: string; codes?: [string, string][] };

/** The columns the export writes itself, by name. */
const RESPONSE_COLUMNS: Record<string, TInfo> = {
  response_id: { text: "Response ID", detail: "id", notes: "Never blank." },
  language: {
    text: "Language",
    detail: "language code",
    notes: "Blank = not recorded. The language the respondent answered in.",
  },
  outcome: {
    text: "Outcome",
    detail: "outcome",
    notes: "Blank = normal response. lowQuality = marked Low quality.",
  },
  timestamp: {
    text: "Timestamp",
    detail: "timestamp",
    notes: "Never blank. When the response was created, in the time zone written after the time (UTC).",
  },
  finished: {
    text: "Finished",
    detail: "1/0",
    notes: "Never blank.",
    codes: [
      ["1", "Finished"],
      ["0", "Not finished"],
    ],
  },
  tags: { text: "Tags", detail: "list", notes: "Blank = no tags. Tag names are separated by a comma." },
  user_id: { text: "User ID", detail: "id", notes: "Blank = no contact or no user ID." },
  contact_id: { text: "Contact ID", detail: "id", notes: "Blank = no contact." },
  quotas: {
    text: "Quotas",
    detail: "list",
    notes: "Blank = in no quota. Names of the quotas the response counted in, separated by a comma.",
  },
  verified_email: { text: "Verified email", detail: "text", notes: "Blank = no verified email." },
};

const QUESTION_TYPE_NAMES: Record<string, string> = {
  multipleChoiceSingle: "single select",
  multipleChoiceMulti: "multi select",
  pictureSelection: "picture selection",
  ranking: "ranking",
  matrix: "matrix",
  nps: "nps",
  rating: "rating",
  csat: "csat",
  ces: "ces",
  openText: "open text",
  address: "address",
  contactInfo: "contact info",
  fileUpload: "file upload",
  date: "date",
  consent: "consent",
  calendar: "calendar",
};

const EMBEDDED_DETAIL = { string: "text", number: "number", boolean: "true/false", date: "date" } as const;

const scalePoints = (column: TAnalysisColumn): number[] => {
  const range = column.scale?.range ?? 0;
  return column.question?.type === "nps"
    ? Array.from({ length: range + 1 }, (_, point) => point)
    : Array.from({ length: range }, (_, point) => point + 1);
};

const describe = (column: TAnalysisColumn): TInfo & { type: string } => {
  if (column.source === "response") {
    const info = RESPONSE_COLUMNS[column.name] ?? {
      text: column.name,
      detail: "text",
      notes: "Blank = not available.",
    };
    return { ...info, type: "response info" };
  }

  if (column.source === "embedded" && column.embedded) {
    const { type, origin, label } = column.embedded;
    return {
      type: origin === "metadata" ? "response info" : "embedded data",
      text: label,
      detail: EMBEDDED_DETAIL[type],
      notes: `Blank = not provided.${type === "date" ? " Written as ISO 8601 text." : ""}`,
    };
  }

  const question = column.question;
  const text = question?.headline ?? column.name;
  const typeName = QUESTION_TYPE_NAMES[question?.type ?? ""] ?? question?.type ?? "question";
  const option = column.option?.label ?? "";

  const matrixRowNote = column.matrixRow ? ` Matrix row: ${column.matrixRow.label}.` : "";

  switch (column.kind) {
    case "code":
      return {
        type: typeName,
        text,
        detail: "code",
        notes: `${BLANK_MEANS}${matrixRowNote}`,
        codes: (column.codes ?? []).map(({ code, label }) => [code, label]),
      };
    case "flag":
      return {
        type: typeName,
        text,
        detail: "1/0",
        notes: `${BLANK_MEANS} 0 = answered without this option.`,
        codes: [
          ["1", `Selected: ${option}`],
          ["0", `Not selected: ${option}`],
        ],
      };
    case "rank":
      return {
        type: typeName,
        text,
        detail: "rank",
        notes: `${BLANK_MEANS} The rank given to ${option}, 1 is first.`,
      };
    case "other_text":
      return { type: "other text", text, detail: "text", notes: `${BLANK_MEANS} What was typed into Other.` };
    case "number": {
      if (column.scale) {
        const points = scalePoints(column);
        const lowest = points[0];
        const highest = points.at(-1);
        const detail = question?.type === "nps" ? `${lowest}-${highest}` : `${column.scale.range}-point`;
        return {
          type: typeName,
          text,
          detail,
          notes: BLANK_MEANS,
          codes: points.map((point): [string, string] => [
            String(point),
            scalePointLabel(point, lowest, highest),
          ]),
        };
      }
      return { type: "numeric", text, detail: "number", notes: BLANK_MEANS };
    }
    default:
      return { type: typeName, text, detail: "text", notes: BLANK_MEANS };
  }
};

const scalePointLabel = (point: number, lowest: number, highest: number | undefined): string => {
  if (point === lowest) return "Lowest";
  return point === highest ? "Highest" : "";
};

/**
 * What a column is, in words: the SPSS variable label and the Datamap's question text for response
 * columns. An option, a matrix row or an Other text is told apart from its question by a suffix.
 */
export const columnLabel = (column: TAnalysisColumn): string => {
  const base = describe(column).text;
  if (column.matrixRow) return `${base} - ${column.matrixRow.label}`;
  if (column.kind === "other_text" && column.option) return `${base} - ${column.option.label} (text)`;
  if ((column.kind === "flag" || column.kind === "rank") && column.option && column.question) {
    return `${base} - ${column.option.label}`;
  }
  return base;
};

export const buildDatamap = (
  columns: readonly TAnalysisColumn[],
  { unmappedColumns }: TDatamapOptions = {}
): TDatamapRow[] =>
  columns.flatMap((column) => {
    const info = describe(column);
    const notes =
      unmappedColumns?.has(column.name) && column.kind !== "flag" && column.kind !== "rank"
        ? `${info.notes} ${UNMAPPED_NOTE}`
        : info.notes;
    const common = [
      column.name,
      column.question?.id ?? null,
      info.text,
      `${info.type} . ${info.detail}`,
    ] as const;
    if (!info.codes || info.codes.length === 0) {
      return [[...common, null, null, notes] as TDatamapRow];
    }
    return info.codes.map(
      ([code, label]) => [...common, code, label === "" ? null : label, notes] as TDatamapRow
    );
  });
