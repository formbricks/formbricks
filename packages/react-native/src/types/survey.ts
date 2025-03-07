import { type TJsFileUploadParams } from "../../../types/js";
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
  darkOverlay?: boolean;
  hiddenFieldsRecord?: TResponseData;
  shouldResetQuestionId?: boolean;
  fullSizeCards?: boolean;
}

export interface SurveyInlineProps extends SurveyBaseProps {
  containerId: string;
  placement: "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center";
}

export interface SurveyContainerProps extends Omit<SurveyBaseProps, "onFileUpload"> {
  apiHost?: string;
  environmentId?: string;
  userId?: string;
  contactId?: string;
  onDisplayCreated?: () => void | Promise<void>;
  onResponseCreated?: () => void | Promise<void>;
  onFileUpload?: (file: TJsFileUploadParams["file"], config?: TUploadFileConfig) => Promise<string>;
  onOpenExternalURL?: (url: string) => void | Promise<void>;
  mode?: "modal" | "inline";
  containerId?: string;
  clickOutside?: boolean;
  darkOverlay?: boolean;
  placement?: "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center";
  action?: string;
  singleUseId?: string;
  singleUseResponseId?: string;
}
