import type { TEnvironmentStateSurvey, TProjectStyling, TSurveyStyling } from "@/types/config";
import type { TResponseData, TResponseUpdate } from "@/types/response";
import type { TFileUploadParams, TUploadFileConfig } from "@/types/storage";

export interface SurveyBaseProps {
  survey: TEnvironmentStateSurvey;
  styling: TSurveyStyling | TProjectStyling;
  isBrandingEnabled: boolean;
  getSetIsError?: (getSetError: (value: boolean) => void) => void;
  getSetIsResponseSendingFinished?: (getSetIsResponseSendingFinished: (value: boolean) => void) => void;
  getSetQuestionId?: (getSetQuestionId: (value: string) => void) => void;
  getSetResponseData?: (getSetResponseData: (value: TResponseData) => void) => void;
  onDisplay?: () => void;
  onResponse?: (response: TResponseUpdate) => void;
  onFinished?: () => void;
  onClose?: () => void;
  onRetry?: () => void;
  autoFocus?: boolean;
  isRedirectDisabled?: boolean;
  prefillResponseData?: TResponseData;
  skipPrefilled?: boolean;
  languageCode: string;
  onFileUpload: (file: TFileUploadParams["file"], config?: TUploadFileConfig) => Promise<string>;
  responseCount?: number;
  isCardBorderVisible?: boolean;
  startAtQuestionId?: string;
  clickOutside?: boolean;
  hiddenFieldsRecord?: TResponseData;
  shouldResetQuestionId?: boolean;
  fullSizeCards?: boolean;
}

export interface SurveyInlineProps extends SurveyBaseProps {
  containerId: string;
}

export type TActionClassPageUrlRule =
  | "exactMatch"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "notMatch"
  | "notContains"
  | "matchesRegex";

export type TActionClassNoCodeConfig =
  | {
      type: "click";
      urlFilters: {
        value: string;
        rule: TActionClassPageUrlRule;
      }[];
      elementSelector: {
        cssSelector?: string | undefined;
        innerHtml?: string | undefined;
      };
    }
  | {
      type: "pageView";
      urlFilters: {
        value: string;
        rule: TActionClassPageUrlRule;
      }[];
    }
  | {
      type: "exitIntent";
      urlFilters: {
        value: string;
        rule: TActionClassPageUrlRule;
      }[];
    }
  | {
      type: "fiftyPercentScroll";
      urlFilters: {
        value: string;
        rule: TActionClassPageUrlRule;
      }[];
    };

export interface TTrackProperties {
  hiddenFields: Record<string, string | number | string[]>;
}
