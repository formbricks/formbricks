import { z } from "zod";
import { type Result, err, ok } from "@formbricks/types/error-handlers";
import { parseJsonBounded } from "../../lib/json-depth";
import { importError, importInfo } from "../../report";
import type { TImportIssue } from "../../types";
import { normalizeQualtricsLanguageCode } from "./language-codes";
import type {
  TQsfBlock,
  TQsfBlockElement,
  TQsfChoice,
  TQsfConfiguration,
  TQsfFlowNode,
  TQsfOptions,
  TQsfQuestion,
  TQsfRandomization,
  TQsfSurvey,
  TQsfTranslation,
  TQsfValidation,
} from "./types";

/**
 * Loose on purpose: Qualtrics publishes no schema and changes shapes across versions. Only the two
 * top-level keys and the element envelope are required; every payload is read defensively.
 */
const ZQsfElement = z.object({
  Element: z.string(),
  PrimaryAttribute: z.unknown().optional(),
  SecondaryAttribute: z.unknown().optional(),
  Payload: z.unknown().optional(),
});

const ZQsfFile = z.object({
  SurveyEntry: z.record(z.string(), z.unknown()),
  SurveyElements: z.array(z.unknown()),
});

const KNOWN_ELEMENTS = new Set(["SQ", "BL", "FL", "SO", "QC", "STAT", "RS", "SCO", "PROJ", "Notes"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))
    return Number(value);
  return null;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** `Choices` is an object keyed by id; `ChoiceOrder` gives the display order (ids as strings or numbers). */
function readChoices(choices: unknown, order: unknown): TQsfChoice[] {
  if (!isRecord(choices)) return [];

  const ids = Array.isArray(order)
    ? order.map((id) => String(id)).filter((id) => Object.hasOwn(choices, id))
    : Object.keys(choices);
  const remaining = Object.keys(choices).filter((id) => !ids.includes(id));

  return [...ids, ...remaining].map((id) => {
    const choice = choices[id];
    const record = isRecord(choice) ? choice : {};
    return {
      id,
      display: str(record.Display) ?? "",
      textEntry: record.TextEntry === "true" || record.TextEntry === true,
    };
  });
}

function readValidation(payload: Record<string, unknown>): TQsfValidation {
  const settings =
    isRecord(payload.Validation) && isRecord(payload.Validation.Settings) ? payload.Validation.Settings : {};
  const force = str(settings.ForceResponse)?.toUpperCase() ?? null;
  return {
    forceResponse: force === "ON" ? "ON" : force === "OFF" ? "OFF" : force === "REQUEST" ? "REQUEST" : null,
    contentType: str(settings.ContentType),
    minChars: num(settings.MinChars),
    maxChars: num(settings.MaxChars),
  };
}

function readConfiguration(payload: Record<string, unknown>): TQsfConfiguration {
  const config = isRecord(payload.Configuration) ? payload.Configuration : {};
  return {
    sliderMin: num(config.CSSliderMin),
    sliderMax: num(config.CSSliderMax),
    gridLines: num(config.GridLines),
    numDecimals: num(config.NumDecimals),
    descriptionOption: str(config.QuestionDescriptionOption),
    raw: config,
  };
}

function readRandomization(payload: Record<string, unknown>): TQsfRandomization | null {
  if (!isRecord(payload.Randomization)) return null;
  return { type: str(payload.Randomization.Type), raw: payload.Randomization };
}

function readTranslationBlock(value: unknown): TQsfTranslation {
  if (!isRecord(value)) return {};
  const translation: TQsfTranslation = {};
  const text = str(value.QuestionText);
  if (text !== null) translation.text = text;

  for (const [source, target] of [
    ["Choices", "choices"],
    ["Answers", "answers"],
  ] as const) {
    if (!isRecord(value[source])) continue;
    const map: Record<string, string> = {};
    for (const [id, choice] of Object.entries(value[source])) {
      const display = isRecord(choice) ? str(choice.Display) : str(choice);
      if (display !== null) map[id] = display;
    }
    translation[target] = map;
  }

  return translation;
}

type TLanguageAccumulator = { known: Set<string>; unknown: Set<string> };

function readTranslations(
  payload: Record<string, unknown>,
  languages: TLanguageAccumulator
): Record<string, TQsfTranslation> {
  if (!isRecord(payload.Language)) return {};
  const translations: Record<string, TQsfTranslation> = {};

  for (const [rawCode, block] of Object.entries(payload.Language)) {
    const normalized = normalizeQualtricsLanguageCode(rawCode);
    const key = normalized.ok ? normalized.code : rawCode;
    if (normalized.ok) languages.known.add(normalized.code);
    else languages.unknown.add(rawCode);
    translations[key] = readTranslationBlock(block);
  }

  return translations;
}

function readQuestion(
  element: z.infer<typeof ZQsfElement>,
  languages: TLanguageAccumulator
): TQsfQuestion | null {
  const qid = str(element.PrimaryAttribute);
  const payload = isRecord(element.Payload) ? element.Payload : null;
  if (!qid || !payload) return null;

  return {
    qid,
    exportTag: str(payload.DataExportTag) ?? qid,
    type: str(payload.QuestionType) ?? "Unknown",
    selector: str(payload.Selector),
    subSelector: str(payload.SubSelector),
    text: str(payload.QuestionText) ?? str(element.SecondaryAttribute) ?? "",
    description: str(payload.QuestionDescription) ?? "",
    choices: readChoices(payload.Choices, payload.ChoiceOrder),
    answers: readChoices(payload.Answers, payload.AnswerOrder),
    validation: readValidation(payload),
    configuration: readConfiguration(payload),
    displayLogic: payload.DisplayLogic ?? null,
    skipLogic: payload.SkipLogic ?? null,
    randomization: readRandomization(payload),
    translations: readTranslations(payload, languages),
  };
}

function readBlockElements(value: unknown): TQsfBlockElement[] {
  if (!Array.isArray(value)) return [];
  const elements: TQsfBlockElement[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (entry.Type === "Page Break") {
      elements.push({ kind: "pageBreak" });
    } else if (entry.Type === "Question" && typeof entry.QuestionID === "string") {
      elements.push({ kind: "question", qid: entry.QuestionID });
    }
  }
  return elements;
}

function readBlockType(value: unknown): TQsfBlock["type"] {
  return value === "Trash" ? "Trash" : value === "Default" ? "Default" : "Standard";
}

/** `BL` payload is an array in newer exports and an object keyed by index in older ones. */
function readBlocks(payload: unknown): TQsfBlock[] {
  const entries = Array.isArray(payload) ? payload : isRecord(payload) ? Object.values(payload) : [];
  const blocks: TQsfBlock[] = [];
  for (const entry of entries) {
    if (!isRecord(entry) || typeof entry.ID !== "string") continue;
    blocks.push({
      id: entry.ID,
      description: str(entry.Description) ?? "",
      type: readBlockType(entry.Type),
      elements: readBlockElements(entry.BlockElements),
    });
  }
  return blocks;
}

function readEmbeddedDataFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (isRecord(entry) ? (str(entry.Field) ?? str(entry.Description)) : null))
    .filter((field): field is string => field !== null && field.length > 0);
}

function readFlowNodes(value: unknown, issues: TImportIssue[]): TQsfFlowNode[] {
  if (!Array.isArray(value)) return [];
  const nodes: TQsfFlowNode[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const type = str(entry.Type) ?? "Unknown";
    switch (type) {
      case "Block":
      case "Standard":
        if (typeof entry.ID === "string") nodes.push({ type, id: entry.ID });
        break;
      case "EmbeddedData":
        nodes.push({ type, fields: readEmbeddedDataFields(entry.EmbeddedData) });
        break;
      case "Branch":
        nodes.push({
          type,
          logic: entry.BranchLogic ?? null,
          description: str(entry.Description),
          children: readFlowNodes(entry.Flow, issues),
        });
        break;
      case "EndSurvey":
        nodes.push({ type });
        break;
      case "BlockRandomizer":
      case "Randomizer":
        nodes.push({ type, children: readFlowNodes(entry.Flow, issues) });
        break;
      case "Group":
        nodes.push({
          type,
          description: str(entry.Description),
          children: readFlowNodes(entry.Flow, issues),
        });
        break;
      default:
        nodes.push({ type: "Unknown", rawType: type });
        issues.push(
          importInfo({
            code: "unknown_element",
            sourceRef: "Survey Flow",
            vars: { type },
            message: `Flow element '${type}' is not known and was skipped.`,
          })
        );
    }
  }

  return nodes;
}

function readOptions(payload: unknown): TQsfOptions {
  const record = isRecord(payload) ? payload : {};
  const bool = (value: unknown): boolean | null =>
    value === "true" || value === true ? true : value === "false" || value === false ? false : null;
  const nonEmpty = (value: unknown): string | null => {
    const text = str(value);
    return text && text.trim().length > 0 ? text : null;
  };
  return {
    backButton: bool(record.BackButton),
    progressBar: str(record.ProgressBarDisplay),
    eosMessage: nonEmpty(record.EOSMessage),
    eosRedirectUrl: nonEmpty(record.EOSRedirectURL),
    nextButtonLabel: nonEmpty(record.NextButton),
    previousButtonLabel: nonEmpty(record.PreviousButton),
    partialData: str(record.PartialData),
  };
}

function collectEmbeddedDataFields(nodes: TQsfFlowNode[], into: string[]): void {
  for (const node of nodes) {
    if (node.type === "EmbeddedData") {
      for (const field of node.fields) if (!into.includes(field)) into.push(field);
    } else if ("children" in node) {
      collectEmbeddedDataFields(node.children, into);
    }
  }
}

/**
 * Read a `.qsf` file into the typed model. Never throws on content: a file that is not JSON or not a
 * QSF comes back as issues; unknown element types are noted and skipped.
 */
export function parseQsf(input: Buffer | string): Result<TQsfSurvey, TImportIssue[]> {
  const text = stripBom(typeof input === "string" ? input : input.toString("utf8"));

  const parsed = parseJsonBounded(text);
  if (!parsed) {
    return err([importError({ code: "invalid_document", vars: { detail: "The file is not valid JSON." } })]);
  }
  const raw: unknown = parsed.value;

  const file = ZQsfFile.safeParse(raw);
  if (!file.success) {
    return err([
      importError({
        code: "invalid_document",
        vars: {
          detail:
            "The file is not a Qualtrics survey export: 'SurveyEntry' and 'SurveyElements' are missing.",
        },
      }),
    ]);
  }

  const issues: TImportIssue[] = [];
  const languages: TLanguageAccumulator = { known: new Set(), unknown: new Set() };
  const questions = new Map<string, TQsfQuestion>();
  let blocks: TQsfBlock[] = [];
  let flow: TQsfFlowNode[] = [];
  let options = readOptions(null);

  for (const rawElement of file.data.SurveyElements) {
    const element = ZQsfElement.safeParse(rawElement);
    if (!element.success) {
      issues.push(
        importInfo({
          code: "unknown_element",
          vars: { type: "?" },
          message: "A survey element could not be read and was skipped.",
        })
      );
      continue;
    }

    switch (element.data.Element) {
      case "SQ": {
        const question = readQuestion(element.data, languages);
        if (question) questions.set(question.qid, question);
        break;
      }
      case "BL":
        blocks = readBlocks(element.data.Payload);
        break;
      case "FL":
        flow = readFlowNodes(isRecord(element.data.Payload) ? element.data.Payload.Flow : [], issues);
        break;
      case "SO":
        options = readOptions(element.data.Payload);
        break;
      default:
        if (!KNOWN_ELEMENTS.has(element.data.Element)) {
          issues.push(
            importInfo({
              code: "unknown_element",
              vars: { type: element.data.Element },
              message: `Survey element '${element.data.Element}' is not known and was skipped.`,
            })
          );
        }
    }
  }

  const rawDefault = str(file.data.SurveyEntry.SurveyLanguage) ?? "EN";
  const normalizedDefault = normalizeQualtricsLanguageCode(rawDefault);
  const defaultLanguageCode = normalizedDefault.ok ? normalizedDefault.code : rawDefault;
  if (!normalizedDefault.ok) languages.unknown.add(rawDefault);

  const embeddedDataFields: string[] = [];
  collectEmbeddedDataFields(flow, embeddedDataFields);

  for (const code of languages.unknown) {
    issues.push(importInfo({ code: "language_unknown", vars: { code } }));
  }

  return ok({
    name: str(file.data.SurveyEntry.SurveyName) ?? "Imported Qualtrics survey",
    surveyId: str(file.data.SurveyEntry.SurveyID),
    defaultLanguageCode,
    languageCodes: Array.from(languages.known)
      .filter((code) => code !== defaultLanguageCode)
      .sort(),
    unknownLanguageCodes: Array.from(languages.unknown).sort(),
    questions,
    blocks,
    flow,
    options,
    embeddedDataFields,
    issues,
  });
}
