import type { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import type {
  TSurveyDateElement,
  TSurveyOpenTextElementInputType,
  TSurveyRatingElement,
} from "@formbricks/types/surveys/elements";
import type { TSurveyImportPipelineIssue } from "./report";

/*
 * The draft document every import lane builds (ENG-3654, ENG-6846), as types only: the stream's event
 * types and the dialog import them, so this module must hold no runtime code and import nothing but
 * types.
 */

/** The fields a contact info element asks for. */
export type TSurveyImportContactField = "firstName" | "lastName" | "email" | "phone" | "company";

/** Text keyed by language code, default language first. */
export type TSurveyImportLocaleText = Record<string, string>;

export interface TDraftElementBase {
  id: string;
  headline: TSurveyImportLocaleText;
  required: boolean;
  isDraft: true;
}

export interface TDraftChoice {
  id: string;
  label: TSurveyImportLocaleText;
}

export interface TDraftToggleInput {
  show: boolean;
  required: boolean;
  placeholder: TSurveyImportLocaleText;
}

export type TSurveyImportDraftElement = TDraftElementBase &
  (
    | {
        type: "openText";
        inputType: TSurveyOpenTextElementInputType;
        longAnswer: boolean;
        charLimit: { enabled: false };
      }
    | {
        type: "multipleChoiceSingle" | "multipleChoiceMulti";
        choices: TDraftChoice[];
        shuffleOption: "none" | "all" | "exceptLast";
        displayType: "list" | "dropdown";
      }
    | { type: "ranking"; choices: TDraftChoice[]; shuffleOption: "none" | "all" }
    | { type: "matrix"; rows: TDraftChoice[]; columns: TDraftChoice[]; shuffleOption: "none" }
    | { type: "nps"; isColorCodingEnabled: false }
    | {
        type: "rating" | "csat" | "ces";
        scale: TSurveyRatingElement["scale"];
        range: number;
        isColorCodingEnabled: false;
        /** The scale's end labels, when the file names them (a document import's). */
        lowerLabel?: TSurveyImportLocaleText;
        upperLabel?: TSurveyImportLocaleText;
      }
    | { type: "date"; format: TSurveyDateElement["format"] }
    | { type: "fileUpload"; allowMultipleFiles: false }
    | ({ type: "contactInfo" } & Record<TSurveyImportContactField, TDraftToggleInput>)
    | { type: "consent"; label: TSurveyImportLocaleText }
    | { type: "cta"; buttonExternal: false }
  );

export type TSurveyImportDraftEnding =
  | { id: string; type: "endScreen"; headline: TSurveyImportLocaleText; subheader?: TSurveyImportLocaleText }
  | { id: string; type: "redirectToUrl"; url: string; label: string };

/**
 * A block of the draft. Only a document import writes logic (ENG-6852): its routing, turned into jumps
 * whose conditions name elements and choices by the draft's own ids.
 */
export interface TSurveyImportDraftBlock {
  id: string;
  name: string;
  elements: TSurveyImportDraftElement[];
  logic?: TSurveyBlockLogic[];
  logicFallback?: string;
}

/**
 * The create document the import builds: what the stream's `done` event carries, and what the dialog
 * sends to `POST /api/v3/surveys` unchanged. It is the request body before parsing — locale-keyed
 * texts, no defaults filled in — so not the parsed `TV3CreateSurveyBody`; and typed here because the
 * schema's own input type, `TV3CreateSurveyRequestBody`, is `unknown`.
 */
export interface TSurveyImportDraft {
  workspaceId: string;
  name: string;
  type: "link";
  status: "draft";
  defaultLanguage: string;
  languages: { code: string; default: boolean; enabled: boolean }[];
  blocks: TSurveyImportDraftBlock[];
  endings: TSurveyImportDraftEnding[];
  /** The welcome card, when the file has one (a document import's welcome text). */
  welcomeCard?: { enabled: true; headline: TSurveyImportLocaleText; subheader?: TSurveyImportLocaleText };
  hiddenFields: { enabled: boolean; fieldIds: string[] };
  /**
   * Set, both true, on a draft in more than one language: an imported multi-language survey shows its
   * respondents a language menu and opens in the browser's language, as a Qualtrics survey does
   * (#9508's fields). Left out on a one-language draft, v3's default. See `withLanguageSettings`.
   */
  showLanguageSwitch?: true;
  autoSelectLanguage?: true;
}

/**
 * A draft a lane copies from the file rather than assembling it: a Formbricks file's survey (ENG-6850),
 * as the create request body takes it — locale-keyed texts, any element type, app surveys with their
 * triggers and targeting. Only what the import itself sets is typed; the rest is the file's, held to
 * the create's own checks before the dialog sees it.
 */
export type TSurveyImportFileDraft = Record<string, unknown> & {
  workspaceId: string;
  name: string;
  status: "draft";
  blocks: ReadonlyArray<{ elements: ReadonlyArray<unknown> }>;
};

/** What an import lane hands the dialog to review and create: assembled, or copied from the file. */
export type TSurveyImportPayload = TSurveyImportDraft | TSurveyImportFileDraft;

/** A lane's assembled draft, with the report lines assembly wrote. */
export interface TSurveyImportAssembly {
  document: TSurveyImportDraft;
  issues: TSurveyImportPipelineIssue[];
  /**
   * The source question (the lane's own id) behind each element, by block and element index, to map a
   * problem with an element back to the question.
   */
  elementRefs: string[][];
}
