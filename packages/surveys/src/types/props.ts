import { TResponse, TResponseData, TResponseUpdate } from "@formbricks/types/v1/responses";
import { TSurvey } from "@formbricks/types/v1/surveys";

export interface SurveyBaseProps {
  survey: TSurvey;
  brandColor: string;
  formbricksSignature: boolean;
  activeQuestionId?: string;
  onDisplay?: () => void;
  onResponse?: (response: Partial<TResponse>) => void;
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
