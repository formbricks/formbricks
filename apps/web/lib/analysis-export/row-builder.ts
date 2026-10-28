/**
 * Turns a survey into the Analysis export's columns, and each response into one row of cells.
 *
 * Pure: no I/O. The survey is read once to build the column plan; `buildRow` then runs per response
 * in a single pass, reporting every Unmapped value as it meets it. See ADR 0015 for why codes come
 * from label text, and `types.ts` for the output contract.
 */
import type { TEmbeddedDataType } from "@formbricks/types/embedded-data";
import {
  coerceToEmbeddedDataType,
  getComputedEmbeddedFields,
  getIngestedEmbeddedFields,
  getSurveyEmbeddedFields,
  projectReservedValues,
} from "@formbricks/types/embedded-data-resolver";
import type { TResponseData, TResponseDataValue } from "@formbricks/types/responses";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { EXPORT_COLUMN_NAMES } from "@formbricks/types/surveys/codes";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import { fillMissingCodes } from "@formbricks/types/surveys/fill-missing-codes";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLanguageCode } from "@/lib/i18n/utils";
import { getReservedExportEntries } from "@/lib/response/utils";
import { getFormattedDateTimeString } from "@/lib/utils/datetime";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { OTHER_OPTION_ID, type TMatchableOption, resolveAnswerOption } from "./option-matcher";
import {
  type TAnalysisCell,
  type TAnalysisColumn,
  type TAnalysisResponseFields,
  type TAnalysisRow,
  type TAnswerDisplay,
  type TUnmappedValue,
  UNMAPPED_PREFIX,
} from "./types";

export type TAnalysisSurvey = Pick<
  TSurvey,
  "blocks" | "languages" | "embeddedFields" | "isVerifyEmailEnabled" | "isCaptureIpEnabled"
>;

/** The slice of a response a row is built from. The reader selects only what the chosen fields need. */
export type TAnalysisResponse = {
  id: string;
  createdAt: Date;
  updatedAt?: Date;
  surveyId?: string;
  finished: boolean;
  language: string | null;
  outcome: string | null;
  data: TResponseData;
  variables?: Record<string, string | number>;
  meta?: Record<string, unknown>;
  ttc?: Record<string, number>;
  tags?: string[];
  quotas?: string[];
  contact?: { id: string; userId?: string } | null;
};

export type TUnmappedReport = {
  column: string;
  question: TUnmappedValue["question"];
  value: string;
  reason: TUnmappedValue["reason"];
  options: readonly TMatchableOption[];
  language: string;
  responseId: string;
};

type TRowContext = {
  response: TAnalysisResponse;
  /** `"default"` or a language code, what the matcher and label lookups take. */
  language: string;
  /** The response language as written to the `language` column and the unmapped list. */
  languageOut: string;
  report: (input: Omit<TUnmappedReport, "language" | "responseId">) => void;
};

/** Fills the cells of one question. `at(i)` is the i-th column the question owns. */
type TQuestionFiller = (ctx: TRowContext, answer: TResponseDataValue | undefined, put: TPut) => void;
type TPut = (columnOffset: number, code: TAnalysisCell, label?: TAnalysisCell) => void;

type TQuestionPlan = { columns: TAnalysisColumn[]; fill: TQuestionFiller };

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

const toText = (value: unknown): string => (typeof value === "string" ? value : String(value));

/** `1,234` style text is not a number to SPSS; only plain finite numbers pass. */
const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const plainLabel = (label: Readonly<Record<string, string>>): string =>
  getTextContent(label.default ?? Object.values(label).find(Boolean) ?? "");

const codeOf = (option: { id: string; code?: string }): string => option.code ?? option.id;

const headlineOf = (element: TSurveyElement): string =>
  getTextContent(element.headline?.default ?? "") || element.id;

const matchables = (options: readonly TMatchableOption[]): TMatchableOption[] => [...options];

/** Every key under which a matrix row's answer may be stored: response language, default, then any. */
const matrixRowKeys = (label: Readonly<Record<string, string>>, language: string): string[] => {
  const keys = [label[language], label.default, ...Object.values(label)];
  return keys.filter((key, i): key is string => !!key && keys.indexOf(key) === i);
};

const snakeCase = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .toLowerCase();

type TQuestionInfo = TUnmappedReport["question"];
type TUnmappedReporter = (value: string, reason: TUnmappedValue["reason"]) => void;
type TElementOf<T extends string> = Extract<TSurveyElement, { type: T }>;

/** What a per-type planner needs to declare its columns and report values it cannot map. */
type TQuestionEnv = {
  code: string;
  question: TQuestionInfo;
  baseColumn: (
    name: string,
    kind: TAnalysisColumn["kind"],
    extra?: Partial<TAnalysisColumn>
  ) => TAnalysisColumn;
};

const unmappedReporter =
  (
    ctx: TRowContext,
    question: TQuestionInfo,
    column: string,
    options: readonly TMatchableOption[]
  ): TUnmappedReporter =>
  (value, reason) =>
    ctx.report({ column, question, value, reason, options });

const unmappedCell = (text: string): string => `${UNMAPPED_PREFIX}${text}`;

/** An answer as a list of texts: an array as is, a single value wrapped, a blank as none. */
const toTextList = (answer: TResponseDataValue | undefined): string[] => {
  if (Array.isArray(answer)) return answer.map(toText);
  return isBlank(answer) ? [] : [toText(answer)];
};

/** The Standard export's cell for answers that are not options: `processResponseData`'s text. */
const textOfAnswer = (answer: NonNullable<TResponseDataValue>): string => {
  if (Array.isArray(answer)) {
    return answer.filter((item) => item !== null && item !== undefined && item !== "").join("; ");
  }
  if (typeof answer === "object") {
    return Object.entries(answer)
      .filter(([, value]) => value !== "")
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
  }
  return toText(answer);
};

const textFiller: TQuestionFiller = (_ctx, answer, put) => {
  if (isBlank(answer)) return;
  const text = textOfAnswer(answer as NonNullable<TResponseDataValue>);
  if (text !== "") put(0, text);
};

const fillNumberAnswer =
  ({ code, question }: TQuestionEnv): TQuestionFiller =>
  (ctx, answer, put) => {
    if (isBlank(answer)) return;
    const number = toNumber(answer);
    if (number !== null) {
      put(0, number);
      return;
    }
    const text = toText(answer);
    put(0, unmappedCell(text), text);
    unmappedReporter(ctx, question, code, [])(text, "not_a_number");
  };

// ---- Per-type question plans ------------------------------------------------------------------

const planSingleChoice = (
  element: TElementOf<"multipleChoiceSingle">,
  { code, question, baseColumn }: TQuestionEnv
): TQuestionPlan => {
  const other = element.choices.find((choice) => choice.id === OTHER_OPTION_ID);
  const choices = matchables(element.choices);
  const main = baseColumn(code, "code", {
    codes: element.choices.map((c) => ({ code: codeOf(c), label: plainLabel(c.label) })),
  });
  const otherText = other
    ? baseColumn(`${code}_text`, "other_text", {
        option: { code: codeOf(other), label: plainLabel(other.label) },
      })
    : null;
  return {
    columns: otherText ? [main, otherText] : [main],
    fill: (ctx, answer, put) => {
      if (isBlank(answer)) return;
      const text = toText(answer);
      const resolution = resolveAnswerOption({ text, choices, language: ctx.language });
      if (resolution.status === "matched") {
        put(0, codeOf(resolution.choice), text);
      } else if (resolution.status === "other") {
        put(0, codeOf(resolution.choice), text);
        put(1, text);
      } else {
        put(0, unmappedCell(text), text);
        unmappedReporter(ctx, question, main.name, choices)(text, resolution.reason);
      }
    },
  };
};

type TChosen = Map<string, { rank: number; texts: string[] }>;

/** Resolves each ticked entry to its choice, remembering the rank and any Other text. */
const collectChosen = ({
  entries,
  choices,
  other,
  language,
  report,
}: {
  entries: string[];
  choices: TMatchableOption[];
  other: { id: string } | undefined;
  language: string;
  report: TUnmappedReporter;
}): TChosen => {
  const chosen: TChosen = new Map();
  const mark = (id: string, rank: number, text?: string): void => {
    const slot = chosen.get(id) ?? { rank, texts: [] };
    if (text) slot.texts.push(text);
    chosen.set(id, slot);
  };
  entries.forEach((entry, index) => {
    const rank = index + 1;
    if (entry === "" || entry === other?.id) {
      // The "" sentinel (and the legacy `other` id) say Other was ticked; its text follows.
      if (other) mark(other.id, rank);
      return;
    }
    const resolution = resolveAnswerOption({ text: entry, choices, language });
    if (resolution.status === "matched") mark(resolution.choice.id, rank);
    else if (resolution.status === "other") mark(resolution.choice.id, rank, entry);
    else report(entry, resolution.reason);
  });
  return chosen;
};

type TChoiceOffsets = Map<string, { flag: number; text: number | null }>;

const writeChosen = (offsetOf: TChoiceOffsets, chosen: TChosen, isRanking: boolean, put: TPut): void => {
  for (const [id, offsets] of offsetOf) {
    const slot = chosen.get(id);
    if (isRanking) {
      if (slot) put(offsets.flag, slot.rank);
    } else {
      // Answered, so an option not chosen is a 0 rather than blank.
      put(offsets.flag, slot ? 1 : 0);
    }
    if (offsets.text !== null && slot && slot.texts.length > 0) {
      put(offsets.text, slot.texts.join("; "));
    }
  }
};

const planMultiChoice = (
  element: TElementOf<"multipleChoiceMulti" | "ranking">,
  { code, question, baseColumn }: TQuestionEnv
): TQuestionPlan => {
  const isRanking = element.type === "ranking";
  const choices = matchables(element.choices);
  const other = element.choices.find((choice) => choice.id === OTHER_OPTION_ID);
  const columns: TAnalysisColumn[] = [];
  const offsetOf: TChoiceOffsets = new Map();
  for (const choice of element.choices) {
    const option = { code: codeOf(choice), label: plainLabel(choice.label) };
    const flag =
      columns.push(baseColumn(`${code}_${option.code}`, isRanking ? "rank" : "flag", { option })) - 1;
    let text: number | null = null;
    if (choice.id === OTHER_OPTION_ID) {
      text = columns.push(baseColumn(`${code}_${option.code}_text`, "other_text", { option })) - 1;
    }
    offsetOf.set(choice.id, { flag, text });
  }
  return {
    columns,
    fill: (ctx, answer, put) => {
      const entries = toTextList(answer);
      if (entries.length === 0) return;
      const report = unmappedReporter(ctx, question, code, choices);
      const chosen = collectChosen({ entries, choices, other, language: ctx.language, report });
      writeChosen(offsetOf, chosen, isRanking, put);
    },
  };
};

const planPictureSelection = (
  element: TElementOf<"pictureSelection">,
  { code, question, baseColumn }: TQuestionEnv
): TQuestionPlan => {
  const choices = element.choices;
  const labelOf = (choice: (typeof choices)[number]): string =>
    plainLabel(choice.imageAltText ?? { default: choice.id });

  if (!element.allowMulti) {
    const main = baseColumn(code, "code", {
      codes: choices.map((choice) => ({ code: codeOf(choice), label: labelOf(choice) })),
    });
    return {
      columns: [main],
      fill: (ctx, answer, put) => {
        if (isBlank(answer)) return;
        const id = Array.isArray(answer) ? toText(answer[0]) : toText(answer);
        const choice = choices.find((c) => c.id === id);
        if (choice) {
          put(0, codeOf(choice), id);
          return;
        }
        put(0, unmappedCell(id), id);
        unmappedReporter(ctx, question, code, [])(id, "no_match");
      },
    };
  }

  const known = new Set(choices.map((choice) => choice.id));
  const columns = choices.map((choice) =>
    baseColumn(`${code}_${codeOf(choice)}`, "flag", {
      option: { code: codeOf(choice), label: labelOf(choice) },
    })
  );
  return {
    columns,
    fill: (ctx, answer, put) => {
      const ids = toTextList(answer);
      if (ids.length === 0) return;
      choices.forEach((choice, index) => put(index, ids.includes(choice.id) ? 1 : 0));
      const report = unmappedReporter(ctx, question, code, []);
      for (const id of ids) {
        if (!known.has(id)) report(id, "no_match");
      }
    },
  };
};

/** The text a matrix row was answered with, or null when that row is blank. */
const matrixRowAnswer = (
  record: Record<string, string>,
  row: { label: Readonly<Record<string, string>> },
  language: string
): string | null => {
  const key = matrixRowKeys(row.label, language).find((k) => record[k] !== undefined);
  const value = key === undefined ? "" : record[key];
  return isBlank(value) ? null : toText(value);
};

const planMatrix = (
  element: TElementOf<"matrix">,
  { code, question, baseColumn }: TQuestionEnv
): TQuestionPlan => {
  const columnOptions = matchables(element.columns);
  const codes = element.columns.map((c) => ({ code: codeOf(c), label: plainLabel(c.label) }));
  const columns = element.rows.map((row) =>
    baseColumn(`${code}_${codeOf(row)}`, "code", {
      codes,
      matrixRow: { code: codeOf(row), label: plainLabel(row.label) },
    })
  );
  return {
    columns,
    fill: (ctx, answer, put) => {
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) return;
      const record = answer as Record<string, string>;
      element.rows.forEach((row, index) => {
        const text = matrixRowAnswer(record, row, ctx.language);
        if (text === null) return;
        const resolution = resolveAnswerOption({ text, choices: columnOptions, language: ctx.language });
        if (resolution.status === "matched") {
          put(index, codeOf(resolution.choice), text);
          return;
        }
        put(index, unmappedCell(text), text);
        const reason = resolution.status === "unmapped" ? resolution.reason : "no_match";
        unmappedReporter(ctx, question, columns[index].name, columnOptions)(text, reason);
      });
    },
  };
};

const planScale = (
  element: TElementOf<"nps" | "rating" | "csat" | "ces">,
  env: TQuestionEnv
): TQuestionPlan => {
  const range = element.type === "nps" ? 10 : element.range;
  return {
    columns: [env.baseColumn(env.code, "number", { scale: { range } })],
    fill: fillNumberAnswer(env),
  };
};

const planOpenText = (element: TElementOf<"openText">, env: TQuestionEnv): TQuestionPlan => {
  if (element.inputType === "number") {
    return { columns: [env.baseColumn(env.code, "number")], fill: fillNumberAnswer(env) };
  }
  return planText(env);
};

/** Address, contact info, file upload, date, consent, calendar: the Standard export's cell. */
const planText = (env: TQuestionEnv): TQuestionPlan => ({
  columns: [env.baseColumn(env.code, "text")],
  fill: textFiller,
});

const planQuestion = (element: TSurveyElement, env: TQuestionEnv): TQuestionPlan => {
  switch (element.type) {
    case "multipleChoiceSingle":
      return planSingleChoice(element, env);
    case "multipleChoiceMulti":
    case "ranking":
      return planMultiChoice(element, env);
    case "pictureSelection":
      return planPictureSelection(element, env);
    case "matrix":
      return planMatrix(element, env);
    case "nps":
    case "rating":
    case "csat":
    case "ces":
      return planScale(element, env);
    case "openText":
      return planOpenText(element, env);
    default:
      return planText(env);
  }
};

// ---- Column names -----------------------------------------------------------------------------

/** Tracks claimed column names so an Embedded Data column never collides with an earlier one. */
const createNameRegistry = () => {
  const usedNames = new Set<string>(EXPORT_COLUMN_NAMES);
  const claim = (name: string): string => {
    usedNames.add(name);
    return name;
  };
  const claimEmbedded = (name: string): string => {
    let candidate = usedNames.has(name) ? `ed_${name}` : name;
    let suffix = 2;
    while (usedNames.has(candidate)) {
      candidate = `ed_${name}_${suffix}`;
      suffix += 1;
    }
    return claim(candidate);
  };
  return { claim, claimEmbedded };
};

type TNameRegistry = ReturnType<typeof createNameRegistry>;

// ---- Response columns -------------------------------------------------------------------------

type TResponseColumn = { column: TAnalysisColumn; read: (ctx: TRowContext) => TAnalysisCell };

const joinOrNull = (items: string[] | undefined): string | null => items?.join(", ") || null;

const readVerifiedEmail = ({ response }: TRowContext): TAnalysisCell => {
  const value = response.data.verifiedEmail;
  return isBlank(value) ? null : toText(value);
};

const buildResponseColumns = ({
  fields,
  isVerifyEmailEnabled,
  isQuotasAllowed,
  timeZone,
  claim,
}: {
  fields: TAnalysisResponseFields;
  isVerifyEmailEnabled: boolean;
  isQuotasAllowed: boolean;
  timeZone: string;
  claim: TNameRegistry["claim"];
}): TResponseColumn[] => {
  const columns: TResponseColumn[] = [];
  const add = (name: string, kind: TAnalysisColumn["kind"], read: TResponseColumn["read"]): void => {
    columns.push({ column: { name: claim(name), kind, source: "response" }, read });
  };

  add("response_id", "text", ({ response }) => response.id);
  add("language", "text", ({ languageOut }) => languageOut || null);
  add("outcome", "text", ({ response }) => response.outcome ?? null);
  if (fields.timestamp) {
    add("timestamp", "text", ({ response }) => getFormattedDateTimeString(response.createdAt, timeZone));
  }
  if (fields.finished) add("finished", "flag", ({ response }) => (response.finished ? 1 : 0));
  if (fields.tags) add("tags", "text", ({ response }) => joinOrNull(response.tags));
  if (fields.contact) {
    add("user_id", "text", ({ response }) => response.contact?.userId ?? null);
    add("contact_id", "text", ({ response }) => response.contact?.id ?? null);
  }
  if (fields.quotas && isQuotasAllowed) {
    add("quotas", "text", ({ response }) => joinOrNull(response.quotas));
  }
  if (fields.verifiedEmail && isVerifyEmailEnabled) add("verified_email", "text", readVerifiedEmail);
  return columns;
};

// ---- Embedded Data columns --------------------------------------------------------------------

type TEmbeddedColumn = {
  column: TAnalysisColumn;
  read: (response: TAnalysisResponse, reserved: Record<string, string | number>) => TAnalysisCell;
};

const toCell = (value: string | number | boolean | undefined): TAnalysisCell => {
  if (value === undefined) return null;
  return typeof value === "boolean" ? String(value) : value;
};

const buildEmbeddedColumns = ({
  survey,
  fields,
  claimEmbedded,
}: {
  survey: TAnalysisSurvey;
  fields: TAnalysisResponseFields;
  claimEmbedded: TNameRegistry["claimEmbedded"];
}): TEmbeddedColumn[] => {
  const columns: TEmbeddedColumn[] = [];
  const add = (
    name: string,
    label: string,
    type: TEmbeddedDataType,
    origin: "hidden" | "variable" | "metadata",
    read: TEmbeddedColumn["read"]
  ): void => {
    columns.push({
      column: {
        name: claimEmbedded(name),
        kind: type === "number" ? "number" : "text",
        source: "embedded",
        embedded: { type, origin, label },
      },
      read,
    });
  };

  if (fields.metadata) {
    for (const entry of getReservedExportEntries(survey as TSurvey)) {
      add(snakeCase(entry.name), entry.name, entry.dataType, "metadata", (_r, reserved) =>
        toCell(coerceToEmbeddedDataType(reserved[entry.name], entry.dataType))
      );
    }
  }
  if (fields.embeddedData) {
    for (const { field, link } of getComputedEmbeddedFields(survey)) {
      add(field.name, field.name, field.dataType, "variable", (response) =>
        toCell(coerceToEmbeddedDataType(response.variables?.[link.storageKey], field.dataType))
      );
    }
    for (const { field, link } of getIngestedEmbeddedFields(survey)) {
      add(field.name, field.name, field.dataType, "hidden", (response) =>
        toCell(coerceToEmbeddedDataType(response.data[link.storageKey], field.dataType))
      );
    }
  }
  return columns;
};

// ---- Question columns -------------------------------------------------------------------------

const buildQuestionPlans = (elements: TSurveyElement[], claim: TNameRegistry["claim"]): TQuestionPlan[] =>
  elements
    .filter((element) => element.type !== "cta")
    .map((element) => {
      const code = element.code ?? element.id;
      const question = { id: element.id, code, headline: headlineOf(element) };
      const questionInfo = { ...question, type: element.type };
      const baseColumn: TQuestionEnv["baseColumn"] = (name, kind, extra = {}) => ({
        name: claim(name),
        kind,
        source: "question",
        question: questionInfo,
        ...extra,
      });
      return planQuestion(element, { code, question, baseColumn });
    });

const projectReserved = (
  response: TAnalysisResponse,
  reservedEntries: ReturnType<typeof getReservedExportEntries>
): Record<string, string | number> => {
  if (reservedEntries.length === 0) return {};
  return projectReservedValues(reservedEntries, {
    ...response,
    surveyId: response.surveyId ?? "",
    updatedAt: response.updatedAt ?? response.createdAt,
    variables: response.variables ?? {},
    ttc: response.ttc ?? {},
    meta: (response.meta ?? {}) as never,
  });
};

export const createAnalysisRowBuilder = ({
  survey: inputSurvey,
  answers,
  fields,
  isQuotasAllowed = false,
  timeZone = "UTC",
}: {
  survey: TAnalysisSurvey;
  answers: TAnswerDisplay;
  fields: TAnalysisResponseFields;
  isQuotasAllowed?: boolean;
  timeZone?: string;
}) => {
  const embeddedFields = getSurveyEmbeddedFields(inputSurvey);
  const blocks: TSurveyBlock[] = fillMissingCodes(
    inputSurvey.blocks,
    embeddedFields.map(({ field }) => field.name)
  );
  const elements = getElementsFromBlocks(blocks);
  const languages = inputSurvey.languages ?? [];
  const defaultLanguageCode = languages.find((language) => language.default)?.language.code ?? null;
  const wantCodes = answers !== "text";
  const wantLabels = answers !== "codes";

  const { claim, claimEmbedded } = createNameRegistry();
  const responseColumns = buildResponseColumns({
    fields,
    isVerifyEmailEnabled: !!inputSurvey.isVerifyEmailEnabled,
    isQuotasAllowed,
    timeZone,
    claim,
  });
  const plans = buildQuestionPlans(elements, claim);
  const embeddedColumns = buildEmbeddedColumns({ survey: inputSurvey, fields, claimEmbedded });

  const columns: TAnalysisColumn[] = [
    ...responseColumns.map((entry) => entry.column),
    ...plans.flatMap((plan) => plan.columns),
    ...embeddedColumns.map((entry) => entry.column),
  ];

  let cursor = responseColumns.length;
  const planOffsets = plans.map((plan) => {
    const start = cursor;
    cursor += plan.columns.length;
    return start;
  });
  const embeddedStart = cursor;
  const widths = columns.length;
  const questionIdOfPlan = elements.filter((element) => element.type !== "cta").map((element) => element.id);
  const reservedEntries = fields.metadata ? getReservedExportEntries(inputSurvey as TSurvey) : [];

  const buildRow = (
    response: TAnalysisResponse,
    onUnmapped: (report: TUnmappedReport) => void
  ): TAnalysisRow => {
    const language = getLanguageCode(languages, response.language);
    const languageOut = language === "default" ? (defaultLanguageCode ?? response.language ?? "") : language;
    const codes: TAnalysisCell[] | null = wantCodes ? new Array<TAnalysisCell>(widths).fill(null) : null;
    const labels: TAnalysisCell[] | null = wantLabels ? new Array<TAnalysisCell>(widths).fill(null) : null;
    const ctx: TRowContext = {
      response,
      language,
      languageOut,
      report: (input) => onUnmapped({ ...input, language: languageOut, responseId: response.id }),
    };
    const setCell = (index: number, code: TAnalysisCell, label: TAnalysisCell = code): void => {
      if (codes) codes[index] = code;
      if (labels) labels[index] = label;
    };

    responseColumns.forEach((entry, index) => setCell(index, entry.read(ctx)));

    plans.forEach((plan, planIndex) => {
      const start = planOffsets[planIndex];
      const put: TPut = (offset, code, label = code) => setCell(start + offset, code, label);
      plan.fill(ctx, response.data[questionIdOfPlan[planIndex]], put);
    });

    if (embeddedColumns.length > 0) {
      const reserved = projectReserved(response, reservedEntries);
      embeddedColumns.forEach((entry, index) =>
        setCell(embeddedStart + index, entry.read(response, reserved))
      );
    }

    return { responseId: response.id, codes, labels };
  };

  return { columns, buildRow };
};
