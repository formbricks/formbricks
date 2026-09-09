import type { TImportIssue } from "../../types";

/**
 * The normalized model the QSF mappers work on. Qualtrics exports vary across versions and
 * every field here is what the parser could recover; mappers treat everything as optional.
 */

export type TQsfChoice = {
  id: string;
  display: string;
  /** `TextEntry: "true"` — the "Other (please specify)" pattern. */
  textEntry: boolean;
};

export type TQsfValidation = {
  forceResponse: "ON" | "OFF" | "REQUEST" | null;
  contentType: string | null;
  minChars: number | null;
  maxChars: number | null;
};

export type TQsfConfiguration = {
  sliderMin: number | null;
  sliderMax: number | null;
  gridLines: number | null;
  numDecimals: number | null;
  descriptionOption: string | null;
  raw: Record<string, unknown>;
};

export type TQsfRandomization = {
  type: string | null;
  raw: Record<string, unknown>;
};

export type TQsfTranslation = {
  text?: string;
  choices?: Record<string, string>;
  answers?: Record<string, string>;
};

export type TQsfQuestion = {
  qid: string;
  exportTag: string;
  type: string;
  selector: string | null;
  subSelector: string | null;
  /** Raw HTML as Qualtrics stores it. */
  text: string;
  description: string;
  choices: TQsfChoice[];
  answers: TQsfChoice[];
  validation: TQsfValidation;
  configuration: TQsfConfiguration;
  displayLogic: unknown;
  skipLogic: unknown;
  randomization: TQsfRandomization | null;
  /** Keyed by the normalized BCP-47 code (or the raw Qualtrics code when unknown). */
  translations: Record<string, TQsfTranslation>;
};

export type TQsfBlockElement = { kind: "question"; qid: string } | { kind: "pageBreak" };

export type TQsfBlock = {
  id: string;
  description: string;
  type: "Standard" | "Default" | "Trash";
  elements: TQsfBlockElement[];
};

export type TQsfFlowNode =
  | { type: "Block"; id: string }
  | { type: "EmbeddedData"; fields: string[] }
  | { type: "Branch"; logic: unknown; children: TQsfFlowNode[]; description: string | null }
  | { type: "EndSurvey" }
  | { type: "BlockRandomizer"; children: TQsfFlowNode[] }
  | { type: "Randomizer"; children: TQsfFlowNode[] }
  | { type: "Group"; children: TQsfFlowNode[]; description: string | null }
  | { type: "Standard"; id: string }
  | { type: "Unknown"; rawType: string };

export type TQsfOptions = {
  backButton: boolean | null;
  progressBar: string | null;
  eosMessage: string | null;
  eosRedirectUrl: string | null;
  nextButtonLabel: string | null;
  previousButtonLabel: string | null;
  partialData: string | null;
};

export type TQsfSurvey = {
  name: string;
  surveyId: string | null;
  /** Normalized BCP-47 code of `SurveyEntry.SurveyLanguage`, or the raw code when unknown. */
  defaultLanguageCode: string;
  /** Every language code found on any question translation, normalized, default excluded. */
  languageCodes: string[];
  /** Raw Qualtrics codes the normalizer did not recognize (reported as `language_unknown`). */
  unknownLanguageCodes: string[];
  questions: Map<string, TQsfQuestion>;
  blocks: TQsfBlock[];
  flow: TQsfFlowNode[];
  options: TQsfOptions;
  embeddedDataFields: string[];
  issues: TImportIssue[];
};
