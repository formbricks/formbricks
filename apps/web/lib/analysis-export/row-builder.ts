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

  const usedNames = new Set<string>(EXPORT_COLUMN_NAMES);
  const claim = (name: string): string => {
    usedNames.add(name);
    return name;
  };

  // ---- Response columns ---------------------------------------------------------------------
  type TResponseColumn = { column: TAnalysisColumn; read: (ctx: TRowContext) => TAnalysisCell };
  const responseColumns: TResponseColumn[] = [];
  const addResponseColumn = (
    name: string,
    kind: TAnalysisColumn["kind"],
    read: TResponseColumn["read"]
  ): void => {
    responseColumns.push({ column: { name: claim(name), kind, source: "response" }, read });
  };

  addResponseColumn("response_id", "text", ({ response }) => response.id);
  addResponseColumn("language", "text", ({ languageOut }) => languageOut || null);
  addResponseColumn("outcome", "text", ({ response }) => response.outcome ?? null);
  if (fields.timestamp) {
    addResponseColumn("timestamp", "text", ({ response }) =>
      getFormattedDateTimeString(response.createdAt, timeZone)
    );
  }
  if (fields.finished) addResponseColumn("finished", "flag", ({ response }) => (response.finished ? 1 : 0));
  if (fields.tags) {
    addResponseColumn("tags", "text", ({ response }) => response.tags?.join(", ") || null);
  }
  if (fields.contact) {
    addResponseColumn("user_id", "text", ({ response }) => response.contact?.userId ?? null);
    addResponseColumn("contact_id", "text", ({ response }) => response.contact?.id ?? null);
  }
  if (fields.quotas && isQuotasAllowed) {
    addResponseColumn("quotas", "text", ({ response }) => response.quotas?.join(", ") || null);
  }
  if (fields.verifiedEmail && inputSurvey.isVerifyEmailEnabled) {
    addResponseColumn("verified_email", "text", ({ response }) => {
      const value = response.data.verifiedEmail;
      return isBlank(value) ? null : toText(value);
    });
  }

  // ---- Question columns ---------------------------------------------------------------------
  const plans: TQuestionPlan[] = [];

  for (const element of elements) {
    if (element.type === "cta") continue;
    const code = element.code ?? element.id;
    const question = { id: element.id, code, headline: headlineOf(element) };
    const questionInfo = { ...question, type: element.type };
    const baseColumn = (
      name: string,
      kind: TAnalysisColumn["kind"],
      extra: Partial<TAnalysisColumn> = {}
    ): TAnalysisColumn => ({
      name: claim(name),
      kind,
      source: "question",
      question: questionInfo,
      ...extra,
    });

    const unmapped =
      (ctx: TRowContext, column: string, options: readonly TMatchableOption[]) =>
      (value: string, reason: TUnmappedValue["reason"]) =>
        ctx.report({ column, question, value, reason, options });

    switch (element.type) {
      case "multipleChoiceSingle": {
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
        plans.push({
          columns: otherText ? [main, otherText] : [main],
          fill: (ctx, answer, put) => {
            if (isBlank(answer)) return;
            const text = toText(answer);
            const resolution = resolveAnswerOption({ text, choices, language: ctx.language });
            if (resolution.status === "matched") put(0, codeOf(resolution.choice), text);
            else if (resolution.status === "other") {
              put(0, codeOf(resolution.choice), text);
              put(1, text);
            } else {
              put(0, `${UNMAPPED_PREFIX}${text}`, text);
              unmapped(ctx, main.name, choices)(text, resolution.reason);
            }
          },
        });
        break;
      }

      case "multipleChoiceMulti":
      case "ranking": {
        const isRanking = element.type === "ranking";
        const choices = matchables(element.choices);
        const columns: TAnalysisColumn[] = [];
        const offsetOf = new Map<string, { flag: number; text: number | null }>();
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
        const reportColumn = code;
        plans.push({
          columns,
          fill: (ctx, answer, put) => {
            const entries = (Array.isArray(answer) ? answer : isBlank(answer) ? [] : [answer]).map(toText);
            if (entries.length === 0) return;
            const chosen = new Map<string, { rank: number; texts: string[] }>();
            const other = element.choices.find((choice) => choice.id === OTHER_OPTION_ID);
            const mark = (id: string, rank: number, text?: string): void => {
              const slot = chosen.get(id) ?? { rank, texts: [] };
              if (text) slot.texts.push(text);
              chosen.set(id, slot);
            };
            entries.forEach((entry, index) => {
              if (entry === "" || (other && entry === other.id)) {
                // The "" sentinel (and the legacy `other` id) say Other was ticked; its text follows.
                if (other) mark(other.id, index + 1);
                return;
              }
              const resolution = resolveAnswerOption({ text: entry, choices, language: ctx.language });
              if (resolution.status === "matched") mark(resolution.choice.id, index + 1);
              else if (resolution.status === "other") mark(resolution.choice.id, index + 1, entry);
              else unmapped(ctx, reportColumn, choices)(entry, resolution.reason);
            });
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
          },
        });
        break;
      }

      case "pictureSelection": {
        const choices = element.choices;
        const known = new Set(choices.map((choice) => choice.id));
        const labelOf = (choice: (typeof choices)[number]): string =>
          plainLabel(choice.imageAltText ?? { default: choice.id });
        if (element.allowMulti) {
          const columns = choices.map((choice) =>
            baseColumn(`${code}_${codeOf(choice)}`, "flag", {
              option: { code: codeOf(choice), label: labelOf(choice) },
            })
          );
          plans.push({
            columns,
            fill: (ctx, answer, put) => {
              const ids = (Array.isArray(answer) ? answer : isBlank(answer) ? [] : [answer]).map(toText);
              if (ids.length === 0) return;
              choices.forEach((choice, index) => put(index, ids.includes(choice.id) ? 1 : 0));
              for (const id of ids) {
                if (!known.has(id)) unmapped(ctx, code, [])(id, "no_match");
              }
            },
          });
        } else {
          const main = baseColumn(code, "code", {
            codes: choices.map((choice) => ({ code: codeOf(choice), label: labelOf(choice) })),
          });
          plans.push({
            columns: [main],
            fill: (ctx, answer, put) => {
              if (isBlank(answer)) return;
              const id = Array.isArray(answer) ? toText(answer[0]) : toText(answer);
              const choice = choices.find((c) => c.id === id);
              if (choice) put(0, codeOf(choice), id);
              else {
                put(0, `${UNMAPPED_PREFIX}${id}`, id);
                unmapped(ctx, code, [])(id, "no_match");
              }
            },
          });
        }
        break;
      }

      case "matrix": {
        const columnOptions = matchables(element.columns);
        const codes = element.columns.map((c) => ({ code: codeOf(c), label: plainLabel(c.label) }));
        const columns = element.rows.map((row) =>
          baseColumn(`${code}_${codeOf(row)}`, "code", {
            codes,
            matrixRow: { code: codeOf(row), label: plainLabel(row.label) },
          })
        );
        plans.push({
          columns,
          fill: (ctx, answer, put) => {
            if (!answer || typeof answer !== "object" || Array.isArray(answer)) return;
            const record = answer as Record<string, string>;
            element.rows.forEach((row, index) => {
              const key = matrixRowKeys(row.label, ctx.language).find((k) => record[k] !== undefined);
              const value = key === undefined ? "" : record[key];
              if (isBlank(value)) return;
              const text = toText(value);
              const resolution = resolveAnswerOption({
                text,
                choices: columnOptions,
                language: ctx.language,
              });
              if (resolution.status === "matched") put(index, codeOf(resolution.choice), text);
              else {
                put(index, `${UNMAPPED_PREFIX}${text}`, text);
                unmapped(
                  ctx,
                  columns[index].name,
                  columnOptions
                )(text, resolution.status === "unmapped" ? resolution.reason : "no_match");
              }
            });
          },
        });
        break;
      }

      case "nps":
      case "rating":
      case "csat":
      case "ces": {
        const range = element.type === "nps" ? 10 : element.range;
        const main = baseColumn(code, "number", { scale: { range } });
        plans.push({
          columns: [main],
          fill: (ctx, answer, put) => {
            if (isBlank(answer)) return;
            const number = toNumber(answer);
            if (number !== null) put(0, number);
            else {
              put(0, `${UNMAPPED_PREFIX}${toText(answer)}`, toText(answer));
              unmapped(ctx, code, [])(toText(answer), "not_a_number");
            }
          },
        });
        break;
      }

      case "openText": {
        if (element.inputType === "number") {
          const main = baseColumn(code, "number");
          plans.push({
            columns: [main],
            fill: (ctx, answer, put) => {
              if (isBlank(answer)) return;
              const number = toNumber(answer);
              if (number !== null) put(0, number);
              else {
                put(0, `${UNMAPPED_PREFIX}${toText(answer)}`, toText(answer));
                unmapped(ctx, code, [])(toText(answer), "not_a_number");
              }
            },
          });
          break;
        }
        plans.push({ columns: [baseColumn(code, "text")], fill: textFiller });
        break;
      }

      default:
        // Address, contact info, file upload, date, consent, calendar: the Standard export's cell.
        plans.push({ columns: [baseColumn(code, "text")], fill: textFiller });
    }
  }

  // ---- Embedded Data columns ----------------------------------------------------------------
  type TEmbeddedColumn = {
    column: TAnalysisColumn;
    read: (response: TAnalysisResponse, reserved: Record<string, string | number>) => TAnalysisCell;
  };
  const embeddedColumns: TEmbeddedColumn[] = [];
  const embeddedName = (name: string): string => {
    let candidate = usedNames.has(name) ? `ed_${name}` : name;
    for (let n = 2; usedNames.has(candidate); n++) candidate = `ed_${name}_${n}`;
    return claim(candidate);
  };
  const addEmbedded = (
    name: string,
    label: string,
    type: TEmbeddedDataType,
    origin: "hidden" | "variable" | "metadata",
    read: TEmbeddedColumn["read"]
  ): void => {
    embeddedColumns.push({
      column: {
        name: embeddedName(name),
        kind: type === "number" ? "number" : "text",
        source: "embedded",
        embedded: { type, origin, label },
      },
      read,
    });
  };
  const toCell = (value: string | number | boolean | undefined): TAnalysisCell =>
    value === undefined ? null : typeof value === "boolean" ? String(value) : value;

  if (fields.metadata) {
    for (const entry of getReservedExportEntries(inputSurvey as TSurvey)) {
      addEmbedded(snakeCase(entry.name), entry.name, entry.dataType, "metadata", (_r, reserved) =>
        toCell(coerceToEmbeddedDataType(reserved[entry.name], entry.dataType))
      );
    }
  }
  if (fields.embeddedData) {
    for (const { field, link } of getComputedEmbeddedFields(inputSurvey)) {
      addEmbedded(field.name, field.name, field.dataType, "variable", (response) =>
        toCell(coerceToEmbeddedDataType(response.variables?.[link.storageKey], field.dataType))
      );
    }
    for (const { field, link } of getIngestedEmbeddedFields(inputSurvey)) {
      addEmbedded(field.name, field.name, field.dataType, "hidden", (response) =>
        toCell(coerceToEmbeddedDataType(response.data[link.storageKey], field.dataType))
      );
    }
  }

  // ---- Assemble -----------------------------------------------------------------------------
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

    responseColumns.forEach((entry, index) => {
      const cell = entry.read(ctx);
      if (codes) codes[index] = cell;
      if (labels) labels[index] = cell;
    });

    plans.forEach((plan, planIndex) => {
      const start = planOffsets[planIndex];
      const put: TPut = (offset, code, label = code) => {
        if (codes) codes[start + offset] = code;
        if (labels) labels[start + offset] = label;
      };
      plan.fill(ctx, response.data[questionIdOfPlan[planIndex]], put);
    });

    if (embeddedColumns.length > 0) {
      const reserved =
        reservedEntries.length > 0
          ? projectReservedValues(reservedEntries, {
              ...response,
              surveyId: response.surveyId ?? "",
              updatedAt: response.updatedAt ?? response.createdAt,
              variables: response.variables ?? {},
              ttc: response.ttc ?? {},
              meta: (response.meta ?? {}) as never,
            })
          : {};
      embeddedColumns.forEach((entry, index) => {
        const cell = entry.read(response, reserved);
        if (codes) codes[embeddedStart + index] = cell;
        if (labels) labels[embeddedStart + index] = cell;
      });
    }

    return { responseId: response.id, codes, labels };
  };

  return { columns, buildRow };
};

/** The Standard export's cell for answers that are not options: `processResponseData`'s text. */
const textFiller: TQuestionFiller = (_ctx, answer, put) => {
  if (isBlank(answer)) return;
  const text = Array.isArray(answer)
    ? answer.filter((item) => item !== null && item !== undefined && item !== "").join("; ")
    : typeof answer === "object"
      ? Object.entries(answer)
          .filter(([, value]) => value !== "")
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n")
      : toText(answer);
  if (text !== "") put(0, text);
};
