import type { TJsEnvironmentStateSurvey, TProjectStyling, TSurveyStyling } from "./config";
import type { TResponseData, TResponseUpdate } from "./response";
import type { TJsFileUploadParams, TUploadFileConfig } from "./storage";

export interface SurveyBaseProps {
  survey: TJsEnvironmentStateSurvey;
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
  onFileUpload: (file: TJsFileUploadParams["file"], config?: TUploadFileConfig) => Promise<string>;
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
