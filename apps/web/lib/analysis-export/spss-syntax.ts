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

const sanitizeName = (name: string): string => {
  let result = name
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}_.$#@]/gu, "_")
    .replace(/\.+$/, "");
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
    for (let n = 2; taken.has(candidate.toLowerCase()); n++) {
      const suffix = `_${n}`;
      candidate = `${cutToBytes(base, NAME_MAX_BYTES - suffix.length)}${suffix}`;
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

const planColumn = (
  column: TAnalysisColumn,
  name: string,
  stat: TColumnStats,
  input: TSpssInput,
  allocate: (name: string) => string
): TVariable => {
  const readsCodes = input.display !== "text";
  const hasUnmapped = input.unmappedColumns.has(column.name);
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

  switch (column.kind) {
    case "code": {
      const codes = column.codes ?? [];
      const textWidth = stringWidth(stat.maxTextBytes, ...codes.map(({ code }) => bytes(code)));
      const parsed = codes.map(({ code }) => (PLAIN_INTEGER.test(code) ? Number(code) : null));
      const isNumeric =
        readsCodes &&
        codes.length > 0 &&
        parsed.every((value) => value !== null && Number.isSafeInteger(value)) &&
        new Set(parsed).size === parsed.length;
      if (!isNumeric) {
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
    }
    case "number": {
      const format = numericFormat(stat);
      if (!hasUnmapped) return { ...base, readFormat: format };
      return {
        ...base,
        readFormat: `A${stringWidth(stat.maxTextBytes, stat.maxNumberChars)}`,
        convertFormat: format,
        rawName: allocate(`${column.name}_raw`),
      };
    }
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
  const lines: string[] = [];
  const add = (...more: string[]): void => {
    lines.push(...more);
  };

  add(
    "* Analysis export: SPSS syntax for the CSV file next to this one.",
    "* Set the folder in the CD line below to where you unzipped the export, then run all.",
    "CD 'C:\\path\\to\\the\\unzipped\\export'."
  );
  if (input.display === "both") {
    add("* This syntax reads the codes file. The labels file is for reading, not for SPSS.");
  }
  add("");

  // Read.
  add(
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
    "  ."
  );
  add("");

  // Convert.
  const converted = variables.filter((variable) => variable.convertFormat);
  const timestamps = variables.filter((variable) => variable.timestampName);
  if (converted.length > 0 || timestamps.length > 0) {
    add(
      "* Columns with answers that matched no option are read as text, kept in a _raw column, then converted."
    );
    if (converted.length > 0) {
      // Each UNMAPPED cell that cannot become a number is a warning; SPSS stops at its low default.
      add("SET MXWARNS=10000.");
    }
    for (const variable of converted) {
      if (variable.rawName) {
        add(
          `STRING ${variable.rawName} (${variable.readFormat}).`,
          `COMPUTE ${variable.rawName} = ${variable.name}.`
        );
      }
      add(`ALTER TYPE ${variable.name} (${variable.convertFormat}).`);
    }
    for (const variable of timestamps) {
      add(
        `COMPUTE ${variable.timestampName} = NUMBER(SUBSTR(${variable.name}, 1, 19), YMDHMS19).`,
        `FORMATS ${variable.timestampName} (DATETIME20).`
      );
    }
    add("EXECUTE.", "");
  }

  // Variable labels.
  const labelEntries: [string, string][] = [];
  for (const variable of variables) {
    const label = cutToBytes(columnLabel(variable.column), VARIABLE_LABEL_MAX_BYTES);
    labelEntries.push([variable.name, label]);
    if (variable.rawName) {
      labelEntries.push([variable.rawName, cutToBytes(`${label} (raw text)`, VARIABLE_LABEL_MAX_BYTES)]);
    }
    if (variable.timestampName) {
      labelEntries.push([
        variable.timestampName,
        `Timestamp as a date and time (${input.timeZone ?? "UTC"})`,
      ]);
    }
  }
  const labelBlock = labelEntries.flatMap(([name, label]) => labelLines("  ", name, label));
  add("VARIABLE LABELS", ...labelBlock.slice(0, -1), `${labelBlock.at(-1)}.`, "");

  // Value labels, one block per distinct set of labels.
  const groups = new Map<string, { names: string[]; labels: TValueLabels }>();
  for (const variable of variables) {
    if (!variable.valueLabels) continue;
    const key = JSON.stringify(variable.valueLabels);
    const group = groups.get(key) ?? { names: [], labels: variable.valueLabels };
    group.names.push(variable.name);
    groups.set(key, group);
  }
  for (const { names: groupNames, labels } of groups.values()) {
    const body = valueLabelLines(labels.pairs);
    add("VALUE LABELS", ...wrapWords("  ", groupNames), ...body.slice(0, -1), `${body.at(-1)}.`);
  }
  if (groups.size > 0) add("");

  // Measurement level.
  const byLevel = new Map<TLevel, string[]>();
  for (const variable of variables) {
    byLevel.set(variable.level, [...(byLevel.get(variable.level) ?? []), variable.name]);
    if (variable.timestampName) {
      byLevel.set("SCALE", [...(byLevel.get("SCALE") ?? []), variable.timestampName]);
    }
  }
  const levelParts = [...byLevel.entries()].map(([level, levelNames]) =>
    wrapWords("  ", levelNames, ` (${level})`)
  );
  add("VARIABLE LEVEL");
  levelParts.forEach((part, index) => {
    const partLines = index === 0 ? part : [`  /${part[0].trimStart()}`, ...part.slice(1)];
    add(...partLines);
  });
  lines[lines.length - 1] += ".";
  add("");

  // Multiple response sets.
  const sets = new Map<string, TVariable[]>();
  for (const variable of variables) {
    const question = variable.column.question;
    if (variable.column.kind !== "flag" || !question || !MULTI_SELECT_TYPES.has(question.type)) continue;
    sets.set(question.id, [...(sets.get(question.id) ?? []), variable]);
  }
  const setAllocate = createNameAllocator();
  const setBlocks = [...sets.values()]
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
  if (setBlocks.length > 0) {
    const flat = setBlocks.flat();
    add("MRSETS", ...flat.slice(0, -1), `${flat.at(-1)}.`, "");
  }

  add("EXECUTE.", "");
  return lines.join("\n");
};
