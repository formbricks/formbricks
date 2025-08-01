import type { TJsEnvironmentStateSurvey, TJsFileUploadParams } from "./js";
import type { TProjectStyling } from "./project";
import type { TResponseData, TResponseHiddenFieldValue, TResponseUpdate } from "./responses";
import type { TUploadFileConfig } from "./storage";
import type { TSurveyStyling } from "./surveys/types";

export interface SurveyBaseProps {
  survey: TJsEnvironmentStateSurvey;
  styling: TSurveyStyling | TProjectStyling;
  isBrandingEnabled: boolean;
  getSetIsError?: (getSetError: (value: boolean) => void) => void;
  getSetIsResponseSendingFinished?: (getSetIsResponseSendingFinished: (value: boolean) => void) => void;
  getSetQuestionId?: (getSetQuestionId: (value: string) => void) => void;
  getSetResponseData?: (getSetResponseData: (value: TResponseData) => void) => void;
  onDisplay?: () => Promise<void>;
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
  ignorePlacementForClickOutside?: boolean;
  hiddenFieldsRecord?: TResponseHiddenFieldValue;
  shouldResetQuestionId?: boolean;
  fullSizeCards?: boolean;
}

export interface SurveyInlineProps extends SurveyBaseProps {
  containerId: string;
}

export interface SurveyModalProps extends SurveyBaseProps {
  clickOutside: boolean;
  darkOverlay: boolean;
  placement: "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center";
}

export interface SurveyContainerProps extends Omit<SurveyBaseProps, "onFileUpload"> {
  appUrl?: string;
  environmentId?: string;
  isPreviewMode?: boolean;
  userId?: string;
  contactId?: string;
  onDisplayCreated?: () => void | Promise<void>;
  onResponseCreated?: () => void | Promise<void>;
  onFileUpload?: (file: TJsFileUploadParams["file"], config?: TUploadFileConfig) => Promise<string>;
  onOpenExternalURL?: (url: string) => void | Promise<void>;
  mode?: "modal" | "inline";
  containerId?: string;
  darkOverlay?: boolean;
  placement?: "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center";
  action?: string;
  singleUseId?: string;
  singleUseResponseId?: string;
  isWebEnvironment?: boolean;
  isSpamProtectionEnabled?: boolean;
  recaptchaSiteKey?: string;
  getRecaptchaToken?: () => Promise<string | null>;
}
