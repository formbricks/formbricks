import type { TQsfPlannedQuestion } from "./plan-checks";
import type { TQsfPlanContactField } from "./plan-schema";

/*
 * The Qualtrics import's draft document (ENG-3654), as types only: the stream's event types and the
 * dialog import them, so this module must hold no runtime code and import nothing but types.
 */

/** Text keyed by language code, default language first. */
export type TQsfLocaleText = Record<string, string>;

export interface TDraftElementBase {
  id: string;
  headline: TQsfLocaleText;
  required: boolean;
  isDraft: true;
}

export interface TDraftChoice {
  id: string;
  label: TQsfLocaleText;
}

export interface TDraftToggleInput {
  show: boolean;
  required: boolean;
  placeholder: TQsfLocaleText;
}

export type TQsfDraftElement = TDraftElementBase &
  (
    | {
        type: "openText";
        inputType: TQsfPlannedQuestion["inputType"];
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
        scale: NonNullable<TQsfPlannedQuestion["scale"]>;
        range: number;
        isColorCodingEnabled: false;
      }
    | { type: "date"; format: NonNullable<TQsfPlannedQuestion["format"]> }
    | { type: "fileUpload"; allowMultipleFiles: false }
    | ({ type: "contactInfo" } & Record<TQsfPlanContactField, TDraftToggleInput>)
    | { type: "consent"; label: TQsfLocaleText }
    | { type: "cta"; buttonExternal: false }
  );

export type TQsfDraftEnding =
  | { id: string; type: "endScreen"; headline: TQsfLocaleText; subheader?: TQsfLocaleText }
  | { id: string; type: "redirectToUrl"; url: string; label: string };

/**
 * The create document the import builds: what the stream's `done` event carries, and what the dialog
 * sends to `POST /api/v3/surveys` unchanged. It is the request body before parsing — locale-keyed
 * texts, no defaults filled in — so not the parsed `TV3CreateSurveyBody`; and typed here because the
 * schema's own input type, `TV3CreateSurveyRequestBody`, is `unknown`.
 */
export interface TQsfDraftDocument {
  workspaceId: string;
  name: string;
  type: "link";
  status: "draft";
  defaultLanguage: string;
  languages: { code: string; default: boolean; enabled: boolean }[];
  blocks: { id: string; name: string; elements: TQsfDraftElement[] }[];
  endings: TQsfDraftEnding[];
  hiddenFields: { enabled: boolean; fieldIds: string[] };
  /**
   * Set, both true, on a draft in more than one language: Qualtrics shows its respondents a language
   * menu and opens a survey in the browser's language, and imported surveys keep doing so (#9508's
   * fields). Left out on a one-language draft, v3's default. See `withLanguageSettings`.
   */
  showLanguageSwitch?: true;
  autoSelectLanguage?: true;
}
