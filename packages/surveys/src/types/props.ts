import { TSurveyWithTriggers } from "@formbricks/types/js";
import { TResponseData, TResponseUpdate } from "@formbricks/types/responses";

export interface SurveyBaseProps {
  survey: TSurveyWithTriggers;
  brandColor: string;
  formbricksSignature: boolean;
  activeQuestionId?: string;
  onDisplay?: () => void;
  onResponse?: (response: TResponseUpdate) => void;
  onFinished?: () => void;
  onClose?: () => void;
  onActiveQuestionChange?: (questionId: string) => void;
  autoFocus?: boolean;
  isRedirectDisabled?: boolean;
  prefillResponseData?: TResponseData;
  showErrorComponent?: boolean;
  errorComponent?: JSX.Element;
}

export interface SurveyInlineProps extends SurveyBaseProps {
  containerId: string;
  getHasFailedResponses?: () => boolean;
  getResponseAccumulator?: () => TResponseUpdate;
}

export interface SurveyModalProps extends SurveyBaseProps {
  clickOutside: boolean;
  darkOverlay: boolean;
  highlightBorderColor: string | null;
  placement: "bottomLeft" | "bottomRight" | "topLeft" | "topRight" | "center";
  getHasFailedResponses?: () => boolean;
  getResponseAccumulator?: () => TResponseUpdate;
}
