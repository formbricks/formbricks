/**
 * The SPSS syntax file (`labels.sps`) of an Analysis export. Pure: columns, measured widths and the
 * list of columns that hold UNMAPPED cells go in, text comes out.
 *
 * Rules the file keeps (ticket ENG-6791):
 * - `GET DATA /TYPE=TXT /ENCODING='UTF8' /FIRSTCASE=2` with an explicit `/VARIABLES` list: SPSS never
 *   guesses a type from the first rows, so a code like `01` or a text column cannot be misread.
 * - A column is numeric only when every answer code is a plain integer. A numeric column that holds
 *   UNMAPPED cells is read as text, copied to `<col>_raw`, then converted with `ALTER TYPE`.
 * - Variable labels at most 256 bytes, value labels at most 120, cut on a character boundary; `'` is
 *   doubled, newlines become spaces, every line stays under 250 bytes (long strings are joined with
 *   `+`). User text is only ever inside a quoted label, never in a comment.
 * - No user-missing values: blank is system-missing. `MRSETS` for each multi-select with two or more
 *   option columns. Timestamps are UTC text converted in the file. A `CD` line the analyst edits.
 */
import { SPSS_RESERVED_WORDS } from "@formbricks/types/surveys/codes";
import type { TColumnStats } from "./column-stats";
import { columnLabel } from "./datamap";
import type { TAnalysisColumn, TAnswerDisplay } from "./types";

const VARIABLE_LABEL_MAX_BYTES = 256;
const VALUE_LABEL_MAX_BYTES = 120;
const NAME_MAX_BYTES = 64;
const LINE_MAX_BYTES = 240;
const CHUNK_MAX_BYTES = 100;
const STRING_MAX_WIDTH = 32767;

const bytes = (text: string): number => Buffer.byteLength(text, "utf8");

/** Cuts a text to at most `maxBytes` UTF-8 bytes without splitting a character. */
export const cutToBytes = (text: string, maxBytes: number): string => {
  if (bytes(text) <= maxBytes) return text;
  let used = 0;
  let result = "";
  for (const char of text) {
    const size = bytes(char);
    if (used + size > maxBytes) break;
    used += size;
    result += char;
  }
  return result;
};

// eslint-disable-next-line no-control-regex -- control characters are exactly what is removed
const BREAKS_AND_CONTROLS = /\r\n|[\u0000-\u001f\u007f\u0085\u2028\u2029]/g;

const escapeForSpss = (text: string): string => text.replace(BREAKS_AND_CONTROLS, " ").replaceAll("'", "''");

/** A quoted SPSS string: newlines and control characters become spaces, `'` is doubled. */
export const spssString = (text: string): string => `'${escapeForSpss(text)}'`;

/** The text as quoted pieces whose escaped size is at most `CHUNK_MAX_BYTES`, to be joined with `+`. */
const quotedChunks = (text: string): string[] => {
  const chunks: string[] = [];
  let current = "";
  for (const char of escapeForSpss(text).match(/''|[\s\S]/gu) ?? []) {
    if (bytes(current) + bytes(char) > CHUNK_MAX_BYTES) {
      chunks.push(current);
      current = "";
    }
    current += char;
  }
  chunks.push(current);
  return chunks.map((chunk) => `'${chunk}'`);
};

/** `  <prefix> '<text>'` as one line, or as several lines joined with `+` when it would be too long. */
const labelLines = (indent: string, prefix: string, text: string, separator = " "): string[] => {
  const head = `${indent}${prefix}${separator}`;
  const single = `${head}${spssString(text)}`;
  if (bytes(single) < LINE_MAX_BYTES) return [single];
  const chunks = quotedChunks(text);
  return chunks.map((chunk, index) => {
    const lead = index === 0 ? head : `${indent}  `;
    return `${lead}${chunk}${index < chunks.length - 1 ? " +" : ""}`;
  });
};

/** Words laid out on lines under the limit. */
const wrapWords = (indent: string, words: readonly string[], suffix = ""): string[] => {
  const lines: string[] = [];
  let line = indent;
  for (const word of words) {
    const candidate = line === indent ? `${line}${word}` : `${line} ${word}`;
    if (bytes(candidate) >= LINE_MAX_BYTES && line !== indent) {
      lines.push(line);
      line = `${indent}${word}`;
    } else {
      line = candidate;
    }
  }
  lines.push(line + suffix);
  return lines;
};

// ---- Names ----------------------------------------------------------------------------------

const RESERVED = new Set(SPSS_RESERVED_WORDS.map((word) => word.toLowerCase()));

/**
 * `comment` and its abbreviations: PSPP reads a line that starts with one as the COMMENT command, so
 * a variable of that name at the start of a line silently ends the command and drops the variable
 * (seen with a question coded `comment`, which is a valid code). Such a name gets a `_` suffix.
 */
const COMMENT_WORD = /^comm(e(n(t)?)?)?$/;

/** A linear scan: `/\.+$/` backtracks quadratically on a long run of dots that does not end the text. */
const trimTrailingDots = (text: string): string => {
  let end = text.length;
  while (end > 0 && text[end - 1] === ".") end -= 1;
  return text.slice(0, end);
};

const sanitizeName = (name: string): string => {
  let result = trimTrailingDots(name.normalize("NFC").replace(/[^\p{L}\p{N}_.$#@]/gu, "_"));
  if (result === "" || !/^[\p{L}@#$]/u.test(result)) result = `v_${result}`;
  result = cutToBytes(result, NAME_MAX_BYTES);
  const lower = result.toLowerCase();
  return RESERVED.has(lower) || COMMENT_WORD.test(lower) ? `${result}_` : result;
};

/** Hands out valid, unique (ignoring case) SPSS variable names. */
const createNameAllocator = () => {
  const taken = new Set<string>();
  return (wanted: string): string => {
    const base = sanitizeName(wanted);
    let candidate = base;
    let attempt = 2;
    while (taken.has(candidate.toLowerCase())) {
      const suffix = `_${attempt}`;
      candidate = `${cutToBytes(base, NAME_MAX_BYTES - suffix.length)}${suffix}`;
      attempt += 1;
    }
    taken.add(candidate.toLowerCase());
    return candidate;
  };
};

/** SPSS variable names for export column names, same order: valid, at most 64 bytes, unique. */
export const assignSpssNames = (columnNames: readonly string[]): string[] => {
  const allocate = createNameAllocator();
  return columnNames.map(allocate);
};

// ---- Plan -------------------------------------------------------------------------------------

export type TSpssInput = {
  columns: readonly TAnalysisColumn[];
  /** What the CSV the syntax reads holds: with "both" it reads `codes.csv`; with "text" every answer is text. */
  display: TAnswerDisplay;
  /** One entry per column, measured while the rows were written. */
  stats: readonly TColumnStats[];
  /** Columns that hold `UNMAPPED:` cells. */
  unmappedColumns: ReadonlySet<string>;
  /** The zone the Timestamp column is written in, for its label. Default UTC. */
  timeZone?: string;
};

type TLevel = "NOMINAL" | "ORDINAL" | "SCALE";
type TValueLabels = { numeric: boolean; pairs: [string, string][] };

type TVariable = {
  column: TAnalysisColumn;
  name: string;
  /** Format in `GET DATA`: `A12` or `F3.0`. */
  readFormat: string;
  /** Set when the column is read as text and then converted: the `ALTER TYPE` format. */
  convertFormat: string | null;
  rawName: string | null;
  level: TLevel;
  valueLabels: TValueLabels | null;
  timestampName: string | null;
};

const PLAIN_INTEGER = /^-?\d+$/;

const stringWidth = (...widths: number[]): number => Math.min(Math.max(1, ...widths), STRING_MAX_WIDTH);

const numericFormat = (stat: TColumnStats, forceInteger = false): string => {
  if (stat.maxNumberChars === 0) return "F8.0";
  const decimals = forceInteger ? 0 : Math.min(stat.maxDecimals, 16);
  return `F${stat.maxNumberChars + (decimals > 0 && stat.maxNumberChars <= decimals + 1 ? 1 : 0)}.${decimals}`;
};

const FLAG_LABELS: Record<string, [string, string][]> = {
  finished: [
    ["1", "Finished"],
    ["0", "Not finished"],
  ],
};
const DEFAULT_FLAG_LABELS: [string, string][] = [
  ["1", "Selected"],
  ["0", "Not selected"],
];

const levelOf = (column: TAnalysisColumn): TLevel => {
  switch (column.kind) {
    case "rank":
      return "ORDINAL";
    case "number":
      return column.scale ? "ORDINAL" : "SCALE";
    default:
      return "NOMINAL";
  }
};

const isNumericCodeList = (parsed: (number | null)[]): boolean =>
  parsed.length > 0 &&
  parsed.every((value) => value !== null && Number.isSafeInteger(value)) &&
  new Set(parsed).size === parsed.length;

type TPlanSource = {
  base: TVariable;
  stat: TColumnStats;
  readsCodes: boolean;
  hasUnmapped: boolean;
  allocate: (name: string) => string;
};

const planCodeColumn = ({ base, stat, readsCodes, hasUnmapped, allocate }: TPlanSource): TVariable => {
  const column = base.column;
  const codes = column.codes ?? [];
  const textWidth = stringWidth(stat.maxTextBytes, ...codes.map(({ code }) => bytes(code)));
  const parsed = codes.map(({ code }) => (PLAIN_INTEGER.test(code) ? Number(code) : null));
  if (!readsCodes || !isNumericCodeList(parsed)) {
    return {
      ...base,
      readFormat: `A${textWidth}`,
      valueLabels: readsCodes
        ? { numeric: false, pairs: codes.map(({ code, label }) => [spssStringKey(code), label]) }
        : null,
    };
  }
  // Wide enough for the code as written: reading "01" with F1.0 would take only its first character.
  const width = Math.max(...codes.map(({ code }) => code.length));
  return {
    ...base,
    readFormat: hasUnmapped ? `A${textWidth}` : `F${width}.0`,
    convertFormat: hasUnmapped ? `F${width}.0` : null,
    rawName: hasUnmapped ? allocate(`${column.name}_raw`) : null,
    valueLabels: {
      numeric: true,
      pairs: codes.map(({ label }, index) => [String(parsed[index]), label]),
    },
  };
};

const planNumberColumn = ({ base, stat, hasUnmapped, allocate }: TPlanSource): TVariable => {
  const format = numericFormat(stat);
  if (!hasUnmapped) return { ...base, readFormat: format };
  return {
    ...base,
    readFormat: `A${stringWidth(stat.maxTextBytes, stat.maxNumberChars)}`,
    convertFormat: format,
    rawName: allocate(`${base.column.name}_raw`),
  };
};

const planColumn = (
  column: TAnalysisColumn,
  name: string,
  stat: TColumnStats,
  input: TSpssInput,
  allocate: (name: string) => string
): TVariable => {
  const base: TVariable = {
    column,
    name,
    readFormat: `A${stringWidth(stat.maxTextBytes)}`,
    convertFormat: null,
    rawName: null,
    level: levelOf(column),
    valueLabels: null,
    timestampName: null,
  };
  const source: TPlanSource = {
    base,
    stat,
    readsCodes: input.display !== "text",
    hasUnmapped: input.unmappedColumns.has(column.name),
    allocate,
  };

  switch (column.kind) {
    case "code":
      return planCodeColumn(source);
    case "number":
      return planNumberColumn(source);
    case "flag":
      return {
        ...base,
        readFormat: numericFormat(stat, true),
        valueLabels: { numeric: true, pairs: FLAG_LABELS[column.name] ?? DEFAULT_FLAG_LABELS },
      };
    case "rank":
      return { ...base, readFormat: numericFormat(stat, true) };
    default:
      return {
        ...base,
        timestampName:
          column.source === "response" && column.name === "timestamp" ? allocate("timestamp_dt") : null,
      };
  }
};

/** A text code as the key of a text value label: quoted like any string. */
const spssStringKey = (code: string): string => spssString(code);

const valueLabelLines = (pairs: readonly [string, string][]): string[] =>
  pairs.flatMap(([key, label]) => labelLines("  ", key, cutToBytes(label, VALUE_LABEL_MAX_BYTES)));

// ---- The file ---------------------------------------------------------------------------------

const MULTI_SELECT_TYPES = new Set(["multipleChoiceMulti", "pictureSelection"]);

/** Ends a statement: the last line gets the closing period. */
const terminate = (statementLines: string[]): string[] => [
  ...statementLines.slice(0, -1),
  `${statementLines.at(-1)}.`,
];

const headerSection = (display: TAnswerDisplay): string[] => [
  "* Analysis export: SPSS syntax for the CSV file next to this one.",
  "* Set the folder in the CD line below to where you unzipped the export, then run all.",
  String.raw`CD 'C:\path\to\the\unzipped\export'.`,
  ...(display === "both"
    ? ["* This syntax reads the codes file. The labels file is for reading, not for SPSS."]
    : []),
  "",
];

const readSection = (variables: readonly TVariable[], file: string): string[] => [
  "GET DATA",
  "  /TYPE=TXT",
  `  /FILE='${file}'`,
  "  /ENCODING='UTF8'",
  "  /DELCASE=LINE",
  '  /DELIMITERS=","',
  `  /QUALIFIER='"'`,
  "  /ARRANGEMENT=DELIMITED",
  "  /FIRSTCASE=2",
  "  /VARIABLES=",
  ...variables.map((variable) => `    ${variable.name} ${variable.readFormat}`),
  "  .",
  "",
];

const convertSection = (variables: readonly TVariable[]): string[] => {
  const converted = variables.filter((variable) => variable.convertFormat);
  const timestamps = variables.filter((variable) => variable.timestampName);
  if (converted.length === 0 && timestamps.length === 0) return [];

  const lines = [
    "* Columns with answers that matched no option are read as text, kept in a _raw column, then converted.",
  ];
  // Each UNMAPPED cell that cannot become a number is a warning; SPSS stops at its low default.
  if (converted.length > 0) lines.push("SET MXWARNS=10000.");
  for (const variable of converted) {
    if (variable.rawName) {
      lines.push(
        `STRING ${variable.rawName} (${variable.readFormat}).`,
        `COMPUTE ${variable.rawName} = ${variable.name}.`
      );
    }
    lines.push(`ALTER TYPE ${variable.name} (${variable.convertFormat}).`);
  }
  for (const variable of timestamps) {
    lines.push(
      `COMPUTE ${variable.timestampName} = NUMBER(SUBSTR(${variable.name}, 1, 19), YMDHMS19).`,
      `FORMATS ${variable.timestampName} (DATETIME20).`
    );
  }
  lines.push("EXECUTE.", "");
  return lines;
};

const variableLabelEntries = (variables: readonly TVariable[], timeZone: string): [string, string][] => {
  const entries: [string, string][] = [];
  for (const variable of variables) {
    const label = cutToBytes(columnLabel(variable.column), VARIABLE_LABEL_MAX_BYTES);
    entries.push([variable.name, label]);
    if (variable.rawName) {
      entries.push([variable.rawName, cutToBytes(`${label} (raw text)`, VARIABLE_LABEL_MAX_BYTES)]);
    }
    if (variable.timestampName) {
      entries.push([variable.timestampName, `Timestamp as a date and time (${timeZone})`]);
    }
  }
  return entries;
};

const variableLabelsSection = (variables: readonly TVariable[], timeZone: string): string[] => {
  const block = variableLabelEntries(variables, timeZone).flatMap(([name, label]) =>
    labelLines("  ", name, label)
  );
  return ["VARIABLE LABELS", ...terminate(block), ""];
};

/** Value labels, one block per distinct set of labels. */
const valueLabelsSection = (variables: readonly TVariable[]): string[] => {
  const groups = new Map<string, { names: string[]; labels: TValueLabels }>();
  for (const variable of variables) {
    if (!variable.valueLabels) continue;
    const key = JSON.stringify(variable.valueLabels);
    const group = groups.get(key) ?? { names: [], labels: variable.valueLabels };
    group.names.push(variable.name);
    groups.set(key, group);
  }
  if (groups.size === 0) return [];
  const blocks = [...groups.values()].flatMap(({ names, labels }) => [
    "VALUE LABELS",
    ...wrapWords("  ", names),
    ...terminate(valueLabelLines(labels.pairs)),
  ]);
  return [...blocks, ""];
};

const measurementLevelSection = (variables: readonly TVariable[]): string[] => {
  const byLevel = new Map<TLevel, string[]>();
  const addToLevel = (level: TLevel, name: string): void => {
    byLevel.set(level, [...(byLevel.get(level) ?? []), name]);
  };
  for (const variable of variables) {
    addToLevel(variable.level, variable.name);
    if (variable.timestampName) addToLevel("SCALE", variable.timestampName);
  }
  const parts = [...byLevel.entries()].map(([level, names]) => wrapWords("  ", names, ` (${level})`));
  const lines = ["VARIABLE LEVEL"];
  parts.forEach((part, index) => {
    lines.push(...(index === 0 ? part : [`  /${part[0].trimStart()}`, ...part.slice(1)]));
  });
  lines[lines.length - 1] += ".";
  lines.push("");
  return lines;
};

/** Variables of each multi-select question, keyed by question id. */
const groupMultiSelectFlags = (variables: readonly TVariable[]): Map<string, TVariable[]> => {
  const sets = new Map<string, TVariable[]>();
  for (const variable of variables) {
    const question = variable.column.question;
    if (variable.column.kind !== "flag" || !question || !MULTI_SELECT_TYPES.has(question.type)) continue;
    sets.set(question.id, [...(sets.get(question.id) ?? []), variable]);
  }
  return sets;
};

const multipleResponseSection = (variables: readonly TVariable[]): string[] => {
  const setAllocate = createNameAllocator();
  const setBlocks = [...groupMultiSelectFlags(variables).values()]
    .filter((members) => members.length >= 2)
    .map((members) => {
      const question = members[0].column.question;
      const setName = `$${setAllocate(question?.code ?? "set")}`;
      const label = cutToBytes(question?.headline ?? "", VARIABLE_LABEL_MAX_BYTES);
      return [
        `  /MDGROUP NAME=${setName}`,
        ...labelLines("    ", "LABEL=", label, ""),
        "    VARIABLES=",
        ...wrapWords(
          "      ",
          members.map((member) => member.name)
        ),
        "    VALUE=1",
      ];
    });
  if (setBlocks.length === 0) return [];
  return ["MRSETS", ...terminate(setBlocks.flat()), ""];
};

export const buildSpssSyntax = (input: TSpssInput): string => {
  const allocate = createNameAllocator();
  const names = input.columns.map((column) => allocate(column.name));
  const variables = input.columns.map((column, index) =>
    planColumn(
      column,
      names[index],
      input.stats[index] ?? { maxTextBytes: 0, maxNumberChars: 0, maxDecimals: 0 },
      input,
      allocate
    )
  );
  const file = input.display === "both" ? "codes.csv" : "data.csv";

  return [
    ...headerSection(input.display),
    ...readSection(variables, file),
    ...convertSection(variables),
    ...variableLabelsSection(variables, input.timeZone ?? "UTC"),
    ...valueLabelsSection(variables),
    ...measurementLevelSection(variables),
    ...multipleResponseSection(variables),
    "EXECUTE.",
    "",
  ].join("\n");
};
