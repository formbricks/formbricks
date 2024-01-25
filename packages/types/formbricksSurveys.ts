import { TResponseData, TResponseUpdate } from "./responses";
import { TUploadFileConfig } from "./storage";
import { TSurvey } from "./surveys";

export interface SurveyBaseProps {
  survey: TSurvey;
  isBrandingEnabled: boolean;
  activeQuestionId?: string;
  getSetIsError?: (getSetError: (value: boolean) => void) => void;
  onDisplay?: () => void;
  onResponse?: (response: TResponseUpdate) => void;
  onFinished?: () => void;
  onClose?: () => void;
  onActiveQuestionChange?: (questionId: string) => void;
  onRetry?: () => void;
  autoFocus?: boolean;
  isRedirectDisabled?: boolean;
  prefillResponseData?: TResponseData;
  language: string;
  onFileUpload: (file: File, config?: TUploadFileConfig) => Promise<string>;
  responseCount?: number;
}

export interface SurveyInlineProps extends SurveyBaseProps {
  containerId: string;
}

export interface SurveyModalProps extends SurveyBaseProps {
  clickOutside: boolean;
  darkOverlay: boolean;
  highlightBorderColor: string | null;
  placement: "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center";
}
